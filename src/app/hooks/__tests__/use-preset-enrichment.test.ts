/**
 * Tests for usePresetEnrichment — the React hook that subscribes to
 * game-store, detects new hero preset loads, runs preset-enricher in the
 * background, and merges the diff with field-level user-edit protection.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { GameConfig } from '@/engine/core';
import type { ConfigChange } from '@/agent/conversation-defs';
import type { EnrichmentResult, PresetMeta } from '@/agent/preset-enricher';

// ── Mocks ──

let lastSignal: AbortSignal | null = null;
let enrichResolver: ((v: EnrichmentResult | null) => void) | null = null;
const enrichSpy = vi.fn();

vi.mock('@/agent/preset-enricher', async () => {
  const actual = await vi.importActual<typeof import('@/agent/preset-enricher')>(
    '@/agent/preset-enricher',
  );
  return {
    ...actual,
    enrichWithSkill: (
      _cfg: GameConfig,
      _meta: PresetMeta,
      sig: AbortSignal,
    ) => {
      lastSignal = sig;
      enrichSpy();
      return new Promise((resolve) => {
        enrichResolver = resolve;
      });
    },
  };
});

// Import AFTER mocks
import { usePresetEnrichment } from '../use-preset-enrichment';
import { useGameStore } from '@/store/game-store';

// ── Fixtures ──

function makeHeroConfig(overrides: Partial<GameConfig['meta']> = {}): GameConfig {
  return {
    version: '1.0.0',
    meta: {
      name: 'Catch Fruit',
      description: '',
      thumbnail: null,
      createdAt: '',
      theme: 'fruit',
      heroPresetId: 'hero-catch-fruit',
      gameType: 'catch',
      concept: 'basket under falling fruit',
      ...overrides,
    },
    canvas: { width: 1080, height: 1920 },
    modules: [
      { id: 'gameflow_1', type: 'GameFlow', enabled: true, params: {} },
      { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: 30 } },
      {
        id: 'spawner_1',
        type: 'Spawner',
        enabled: true,
        params: { frequency: 1.0, spawnInterval: 800 },
      },
      { id: 'scorer_1', type: 'Scorer', enabled: true, params: {} },
    ],
    assets: {},
  };
}

function makeNonPresetConfig(): GameConfig {
  const cfg = makeHeroConfig();
  delete cfg.meta.heroPresetId;
  delete cfg.meta.concept;
  return cfg;
}

// ── Tests ──

describe('usePresetEnrichment', () => {
  beforeEach(() => {
    enrichSpy.mockClear();
    enrichResolver = null;
    lastSignal = null;
    useGameStore.setState({ config: null, configVersion: 0, userEdits: {} });
  });

  afterEach(() => {
    if (enrichResolver) {
      enrichResolver(null);
      enrichResolver = null;
    }
  });

  it('does not trigger enrichment when config is null', () => {
    renderHook(() => usePresetEnrichment());
    expect(enrichSpy).not.toHaveBeenCalled();
  });

  it('does not trigger enrichment for non-preset configs', () => {
    useGameStore.getState().setConfig(makeNonPresetConfig());
    renderHook(() => usePresetEnrichment());
    expect(enrichSpy).not.toHaveBeenCalled();
  });

  it('triggers enrichment when a hero preset config is loaded', async () => {
    renderHook(() => usePresetEnrichment());
    act(() => {
      useGameStore.getState().setConfig(makeHeroConfig());
    });

    await waitFor(() => expect(enrichSpy).toHaveBeenCalledTimes(1));
  });

  it('marks config.meta.presetEnriched = "pending" while enrichment runs', async () => {
    renderHook(() => usePresetEnrichment());
    act(() => {
      useGameStore.getState().setConfig(makeHeroConfig());
    });
    await waitFor(() => expect(enrichSpy).toHaveBeenCalledTimes(1));

    const meta = useGameStore.getState().config!.meta;
    expect(meta.presetEnriched).toBe('pending');
  });

  it('applies the diff and sets presetEnriched = true on success', async () => {
    renderHook(() => usePresetEnrichment());
    act(() => {
      useGameStore.getState().setConfig(makeHeroConfig());
    });
    await waitFor(() => expect(enrichSpy).toHaveBeenCalledTimes(1));

    const changes: ConfigChange[] = [{ action: 'set_duration', duration: 60 }];
    await act(async () => {
      enrichResolver!({ changes, startedAt: Date.now() - 1000 });
      await Promise.resolve();
    });

    await waitFor(() => {
      const state = useGameStore.getState();
      expect(state.config!.meta.presetEnriched).toBe(true);
      const timer = state.config!.modules.find((m) => m.type === 'Timer');
      expect(timer!.params.duration).toBe(60);
    });
  });

  it('skips fields edited by the user during enrichment (field-level merge)', async () => {
    renderHook(() => usePresetEnrichment());
    act(() => {
      useGameStore.getState().setConfig(makeHeroConfig());
    });
    await waitFor(() => expect(enrichSpy).toHaveBeenCalledTimes(1));

    // Simulate user editing spawner.frequency during enrichment.
    act(() => {
      useGameStore
        .getState()
        .applyUserConfigChange('modules[spawner_1].params.frequency', 5.0);
    });

    const changes: ConfigChange[] = [
      { action: 'set_duration', duration: 60 },
      {
        action: 'set_param',
        module_type: 'Spawner',
        param_key: 'frequency',
        param_value: 2.0,
      },
    ];
    await act(async () => {
      enrichResolver!({ changes, startedAt: Date.now() - 1000 });
      await Promise.resolve();
    });

    await waitFor(() => {
      const state = useGameStore.getState();
      expect(state.config!.meta.presetEnriched).toBe(true);
      const spawner = state.config!.modules.find((m) => m.id === 'spawner_1');
      expect(spawner!.params.frequency).toBe(5.0); // user wins
      const timer = state.config!.modules.find((m) => m.type === 'Timer');
      expect(timer!.params.duration).toBe(60); // enricher wins
    });
  });

  it('sets presetEnriched = "failed" when enricher returns null', async () => {
    renderHook(() => usePresetEnrichment());
    act(() => {
      useGameStore.getState().setConfig(makeHeroConfig());
    });
    await waitFor(() => expect(enrichSpy).toHaveBeenCalledTimes(1));

    await act(async () => {
      enrichResolver!(null);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useGameStore.getState().config!.meta.presetEnriched).toBe(
        'failed',
      );
    });
  });

  it('cancelEnrichment aborts signal and marks as cancelled', async () => {
    const { result } = renderHook(() => usePresetEnrichment());
    act(() => {
      useGameStore.getState().setConfig(makeHeroConfig());
    });
    await waitFor(() => expect(enrichSpy).toHaveBeenCalledTimes(1));
    expect(lastSignal!.aborted).toBe(false);

    act(() => {
      result.current.cancelEnrichment();
    });

    expect(lastSignal!.aborted).toBe(true);
    await waitFor(() => {
      expect(useGameStore.getState().config!.meta.presetEnriched).toBe(
        'cancelled',
      );
    });
  });

  it('does not retrigger enrichment when config changes within the same preset', async () => {
    renderHook(() => usePresetEnrichment());
    act(() => {
      useGameStore.getState().setConfig(makeHeroConfig());
    });
    await waitFor(() => expect(enrichSpy).toHaveBeenCalledTimes(1));

    // Simulating a user edit — config changes but presetEnriched is still 'pending'
    act(() => {
      useGameStore
        .getState()
        .applyUserConfigChange('meta.theme', 'space');
    });

    // No new enrichment should fire
    expect(enrichSpy).toHaveBeenCalledTimes(1);
  });

  it('retriggers enrichment when a NEW hero preset is loaded after completion', async () => {
    renderHook(() => usePresetEnrichment());

    act(() => {
      useGameStore.getState().setConfig(makeHeroConfig());
    });
    await waitFor(() => expect(enrichSpy).toHaveBeenCalledTimes(1));

    await act(async () => {
      enrichResolver!({ changes: [], startedAt: Date.now() });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(useGameStore.getState().config!.meta.presetEnriched).toBe(true);
    });

    // Load a different preset
    act(() => {
      const cfg = makeHeroConfig({
        heroPresetId: 'hero-shooter-wave',
        presetEnriched: undefined,
      });
      useGameStore.getState().setConfig(cfg);
    });

    await waitFor(() => expect(enrichSpy).toHaveBeenCalledTimes(2));
  });

  it('exposes progress state (idle → running → done)', async () => {
    const { result } = renderHook(() => usePresetEnrichment());
    expect(result.current.state).toBe('idle');

    act(() => {
      useGameStore.getState().setConfig(makeHeroConfig());
    });
    await waitFor(() => expect(result.current.state).toBe('running'));

    await act(async () => {
      enrichResolver!({ changes: [], startedAt: Date.now() });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.state).toBe('done'));
  });
});
