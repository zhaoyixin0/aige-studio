// src/agent/__tests__/infer-game-type.test.ts
//
// Verifies that ConversationAgent.inferGameType() can recover the original
// gameType from configs produced by runPresetToConfig() for:
//   1. All hero-skeleton presets (strict — must all resolve correctly)
//   2. All expert presets (best-effort — records identification rate)
//
// Expert presets may use niche gameTypes (slingshot, avatar-frame, bouncing,
// etc.) that inferGameType does not natively recognize. The fast-path via
// config.meta.gameType should handle them when the facade injects it.

import { describe, it, expect } from 'vitest';
import { ConversationAgent } from '../conversation-agent';
import {
  runPresetToConfig,
  _resetRegistry,
} from '@/engine/systems/recipe-runner/facade';
import type { GameConfig } from '@/engine/core/types';

interface AgentInternals {
  inferGameType: (config: GameConfig) => string;
}

function makeEmptyConfig(): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: '', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules: [],
    assets: {},
  };
}

function getAgent(): AgentInternals {
  return new ConversationAgent() as unknown as AgentInternals;
}

// ── Hero presets ────────────────────────────────────────────────
const heroFiles = import.meta.glob(
  '/src/knowledge/recipes-runner/*.preset.json',
  { eager: true, import: 'default' },
);

interface HeroEntry {
  readonly presetId: string;
  readonly gameType: string;
}

const heroEntries: HeroEntry[] = Object.values(heroFiles)
  .map((raw) => raw as Record<string, unknown>)
  .filter((r) => r.kind === 'hero-skeleton')
  .map((r) => ({
    presetId: String(r.id),
    gameType: String(r.gameType),
  }));

// ── Expert presets ──────────────────────────────────────────────
const expertFiles = import.meta.glob(
  '/src/knowledge/recipes-runner/experts/expert-*.preset.json',
  { eager: true, import: 'default' },
);

interface ExpertEntry {
  readonly presetId: string;
  readonly gameType: string;
}

const expertEntries: ExpertEntry[] = Object.entries(expertFiles)
  .map(([, raw]) => raw as Record<string, unknown>)
  .filter(
    (r) =>
      typeof r.id === 'string' &&
      typeof r.gameType === 'string' &&
      r.id !== 'expert-index',
  )
  .map((r) => ({
    presetId: String(r.id),
    gameType: String(r.gameType),
  }));

describe('inferGameType — hero preset coverage', () => {
  it('recognises every hero-skeleton preset', () => {
    _resetRegistry();
    expect(heroEntries.length).toBeGreaterThan(0);

    const agent = getAgent();
    const failures: string[] = [];

    for (const entry of heroEntries) {
      let inferred = '';
      try {
        const result = runPresetToConfig(
          { presetId: entry.presetId },
          makeEmptyConfig(),
        );
        inferred = agent.inferGameType(result.config);
      } catch (err) {
        failures.push(`${entry.presetId}: threw ${(err as Error).message}`);
        continue;
      }
      if (inferred !== entry.gameType) {
        failures.push(
          `${entry.presetId}: expected ${entry.gameType}, got ${inferred}`,
        );
      }
    }

    expect(failures).toEqual([]);
  });
});

describe('inferGameType — expert preset coverage (best-effort)', () => {
  it('reports identification rate across all expert presets', () => {
    _resetRegistry();
    expect(expertEntries.length).toBeGreaterThan(0);

    const agent = getAgent();
    const recognised: string[] = [];
    const missed: Array<{
      presetId: string;
      expected: string;
      got: string;
    }> = [];
    const errored: string[] = [];

    for (const entry of expertEntries) {
      let config: GameConfig;
      try {
        config = runPresetToConfig(
          { presetId: entry.presetId },
          makeEmptyConfig(),
        ).config;
      } catch (err) {
        errored.push(`${entry.presetId}: ${(err as Error).message}`);
        continue;
      }

      const inferred = agent.inferGameType(config);
      if (inferred === entry.gameType) {
        recognised.push(entry.presetId);
      } else {
        missed.push({
          presetId: entry.presetId,
          expected: entry.gameType,
          got: inferred,
        });
      }
    }

    // Assertion: at least 50% of expert presets are recognised. This is a
    // coverage floor — expert presets with niche gameTypes may fall through
    // to the 'catch' default and that is acceptable.
    const total = expertEntries.length;
    const recognisedCount = recognised.length;
    const rate = recognisedCount / total;

    // Log summary for manual inspection (exposed via test output)
    (globalThis as unknown as { __inferReport?: unknown }).__inferReport = {
      total,
      recognised: recognisedCount,
      missed: missed.length,
      errored: errored.length,
      rate,
    };

    expect(total).toBeGreaterThanOrEqual(50);
    expect(errored.length).toBe(0);
    // With meta.gameType fast-path injected by the facade, all expert presets
    // that declare a gameType field round-trip losslessly.
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });
});

describe('inferGameType — meta.gameType fast path', () => {
  it('returns config.meta.gameType when present', () => {
    const agent = getAgent();
    const config = makeEmptyConfig();
    const withMeta: GameConfig = {
      ...config,
      meta: { ...config.meta, gameType: 'slingshot' },
    };

    expect(agent.inferGameType(withMeta)).toBe('slingshot');
  });

  it('ignores meta.gameType when empty string', () => {
    const agent = getAgent();
    const config = makeEmptyConfig();
    const withEmpty: GameConfig = {
      ...config,
      meta: { ...config.meta, gameType: '' },
    };

    expect(agent.inferGameType(withEmpty)).toBe('catch');
  });
});
