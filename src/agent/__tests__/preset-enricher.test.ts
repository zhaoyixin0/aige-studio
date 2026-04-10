/**
 * Tests for preset-enricher — the async "skill pass" that makes stylistic
 * (not structural) tweaks to a freshly loaded hero preset config.
 *
 * The 4 guardrails under test:
 *   1. Whitelist — add/remove_module restricted to ENRICHABLE_MODULES
 *   2. Validation — diff must not introduce validation errors
 *   3. Size cap — diff truncated to max 8 changes
 *   4. Idempotency — skip if config.meta.presetEnriched is already true
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameConfig } from '@/engine/core';
import type { ConfigChange } from '@/agent/conversation-defs';

// ── Mocks ──

const mockCreate = vi.fn();

vi.mock('@/services/claude-proxy', () => ({
  createClaudeClient: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('../skill-loader.ts', () => ({
  SkillLoader: class {
    loadForConversation() {
      return Promise.resolve('# catch game skill\n- spawn good items from top');
    }
    loadExpertCardRich() {
      return Promise.resolve('# expert card\nsignatureParams: spawnInterval=600');
    }
  },
}));

vi.mock('@/engine/core/config-validator.ts', () => ({
  validateConfig: vi.fn(() => ({
    errors: [],
    warnings: [],
    fixes: [],
    isPlayable: true,
  })),
}));

// ── Import AFTER mocks so the mocks take effect ──

import { enrichWithSkill, type PresetMeta } from '../preset-enricher';
import { validateConfig } from '@/engine/core/config-validator.ts';

// ── Fixtures ──

const BASE_CONFIG: GameConfig = {
  version: '1.0.0',
  meta: {
    name: 'Catch Fruit',
    description: '',
    thumbnail: null,
    createdAt: '',
    theme: 'fruit',
  },
  canvas: { width: 1080, height: 1920 },
  modules: [
    { id: 'gameflow_1', type: 'GameFlow', enabled: true, params: {} },
    { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: 30 } },
    { id: 'spawner_1', type: 'Spawner', enabled: true, params: { spawnInterval: 800 } },
    { id: 'scorer_1', type: 'Scorer', enabled: true, params: {} },
    { id: 'touchinput_1', type: 'TouchInput', enabled: true, params: {} },
    { id: 'collision_1', type: 'Collision', enabled: true, params: { rules: [] } },
    { id: 'lives_1', type: 'Lives', enabled: true, params: { max: 3 } },
  ],
  assets: {
    player: { type: 'sprite', src: '' },
    good_1: { type: 'sprite', src: '' },
  },
};

const PRESET_META: PresetMeta = {
  heroPresetId: 'hero-catch-fruit',
  gameType: 'catch',
  concept: '玩家头顶篮子接住从天而降的水果',
  signatureGoods: ['red apple', 'yellow banana'],
};

function makeToolUse(input: Record<string, unknown>) {
  return {
    content: [
      {
        type: 'tool_use',
        name: 'refine_preset',
        input,
      },
    ],
  };
}

function signal(aborted = false): AbortSignal {
  const ctrl = new AbortController();
  if (aborted) ctrl.abort();
  return ctrl.signal;
}

// ── Tests ──

describe('enrichWithSkill', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    vi.mocked(validateConfig).mockReturnValue({
      errors: [],
      warnings: [],
      fixes: [],
      isPlayable: true,
    });
  });

  it('returns null when config.meta.presetEnriched is already true', async () => {
    const cfg: GameConfig = {
      ...BASE_CONFIG,
      meta: {
        ...BASE_CONFIG.meta,
        presetEnriched: true,
      } as GameConfig['meta'],
    };
    const result = await enrichWithSkill(cfg, PRESET_META, signal());
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns null when signal is aborted before call', async () => {
    const result = await enrichWithSkill(BASE_CONFIG, PRESET_META, signal(true));
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns changes with startedAt on successful tool_use response', async () => {
    mockCreate.mockResolvedValueOnce(
      makeToolUse({
        changes: [
          { action: 'set_duration', duration: 45 },
          { action: 'set_param', module_type: 'Spawner', param_key: 'spawnInterval', param_value: 600 },
        ],
      }),
    );

    const result = await enrichWithSkill(BASE_CONFIG, PRESET_META, signal());
    expect(result).not.toBeNull();
    expect(result!.changes).toHaveLength(2);
    expect(typeof result!.startedAt).toBe('number');
    expect(result!.changes[0]).toMatchObject({ action: 'set_duration', duration: 45 });
  });

  it('guardrail 1: filters out add_module of CORE module (Spawner)', async () => {
    mockCreate.mockResolvedValueOnce(
      makeToolUse({
        changes: [
          { action: 'add_module', module_type: 'Spawner' },
          { action: 'set_duration', duration: 45 },
        ],
      }),
    );

    const result = await enrichWithSkill(BASE_CONFIG, PRESET_META, signal());
    expect(result).not.toBeNull();
    expect(result!.changes).toHaveLength(1);
    expect(result!.changes[0].action).toBe('set_duration');
  });

  it('guardrail 1: filters out remove_module of CORE module (GameFlow)', async () => {
    mockCreate.mockResolvedValueOnce(
      makeToolUse({
        changes: [
          { action: 'remove_module', module_type: 'GameFlow' },
          { action: 'set_theme', theme: 'space' },
        ],
      }),
    );

    const result = await enrichWithSkill(BASE_CONFIG, PRESET_META, signal());
    expect(result).not.toBeNull();
    expect(result!.changes).toHaveLength(1);
    expect(result!.changes[0].action).toBe('set_theme');
  });

  it('guardrail 1: allows add_module for ENRICHABLE modules (ParticleVFX, SoundFX)', async () => {
    mockCreate.mockResolvedValueOnce(
      makeToolUse({
        changes: [
          { action: 'add_module', module_type: 'ParticleVFX' },
          { action: 'add_module', module_type: 'SoundFX' },
        ],
      }),
    );

    const result = await enrichWithSkill(BASE_CONFIG, PRESET_META, signal());
    expect(result).not.toBeNull();
    expect(result!.changes).toHaveLength(2);
  });

  it('guardrail 1: filters out add_module for UNKNOWN module types (conservative)', async () => {
    mockCreate.mockResolvedValueOnce(
      makeToolUse({
        changes: [
          { action: 'add_module', module_type: 'SomeWeirdModule' },
          { action: 'set_duration', duration: 45 },
        ],
      }),
    );

    const result = await enrichWithSkill(BASE_CONFIG, PRESET_META, signal());
    expect(result).not.toBeNull();
    expect(result!.changes).toHaveLength(1);
    expect(result!.changes[0].action).toBe('set_duration');
  });

  it('guardrail 2: rejects entire diff when validation produces errors', async () => {
    mockCreate.mockResolvedValueOnce(
      makeToolUse({
        changes: [{ action: 'set_duration', duration: 45 }],
      }),
    );
    vi.mocked(validateConfig).mockReturnValueOnce({
      errors: [
        {
          severity: 'error',
          category: 'event-chain-break',
          moduleId: 'scorer_1',
          message: 'mock error',
        },
      ],
      warnings: [],
      fixes: [],
      isPlayable: false,
    });

    const result = await enrichWithSkill(BASE_CONFIG, PRESET_META, signal());
    expect(result).toBeNull();
  });

  it('guardrail 3: truncates diff to max 8 changes', async () => {
    const many: ConfigChange[] = Array.from({ length: 15 }, (_, i) => ({
      action: 'set_param',
      module_type: 'Spawner',
      param_key: `key${i}`,
      param_value: i,
    }));
    mockCreate.mockResolvedValueOnce(makeToolUse({ changes: many }));

    const result = await enrichWithSkill(BASE_CONFIG, PRESET_META, signal());
    expect(result).not.toBeNull();
    expect(result!.changes.length).toBeLessThanOrEqual(8);
  });

  it('passes abort signal through to claude client', async () => {
    mockCreate.mockResolvedValueOnce(makeToolUse({ changes: [] }));
    const sig = signal();
    await enrichWithSkill(BASE_CONFIG, PRESET_META, sig);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const secondArg = mockCreate.mock.calls[0][1];
    expect(secondArg).toEqual(expect.objectContaining({ signal: sig }));
  });

  it('returns null on claude client error (graceful degradation)', async () => {
    mockCreate.mockRejectedValueOnce(new Error('network fail'));
    const result = await enrichWithSkill(BASE_CONFIG, PRESET_META, signal());
    expect(result).toBeNull();
  });

  it('returns null when response contains no tool_use block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I refuse' }],
    });
    const result = await enrichWithSkill(BASE_CONFIG, PRESET_META, signal());
    expect(result).toBeNull();
  });

  it('returns empty changes array when tool_use input has no changes field', async () => {
    mockCreate.mockResolvedValueOnce(makeToolUse({}));
    const result = await enrichWithSkill(BASE_CONFIG, PRESET_META, signal());
    // No crash — returns null or empty; we accept either as "nothing to apply"
    if (result !== null) {
      expect(result.changes).toEqual([]);
    }
  });
});

// ── H1: normaliseChanges field validation tests ──

import { normaliseChanges, isChangeAllowed } from '../preset-enricher';

describe('normaliseChanges — H1 field validation', () => {
  it('strips non-string module_type to undefined', () => {
    const result = normaliseChanges({
      changes: [
        { action: 'set_param', module_type: 123, param_key: 'speed', param_value: 5 },
      ],
    });
    // Entry is kept but module_type is sanitised to undefined
    expect(result).toHaveLength(1);
    expect(result[0].module_type).toBeUndefined();
  });

  it('strips non-number duration to undefined', () => {
    const result = normaliseChanges({
      changes: [
        { action: 'set_duration', duration: 'not-a-number' },
      ],
    });
    // Entry is kept but duration is sanitised to undefined
    expect(result).toHaveLength(1);
    expect(result[0].duration).toBeUndefined();
  });

  it('rejects unknown action strings', () => {
    const result = normaliseChanges({
      changes: [
        { action: 'delete_all_modules' },
        { action: 'execute_code', code: 'alert(1)' },
      ],
    });
    expect(result).toHaveLength(0);
  });

  it('accepts valid entries and constructs new objects', () => {
    const rawInput = {
      action: 'set_param',
      module_type: 'Spawner',
      param_key: 'speed',
      param_value: 5,
      __proto_pollution__: 'evil',
    };
    const result = normaliseChanges({ changes: [rawInput] });
    expect(result).toHaveLength(1);
    // Should not carry through arbitrary extra fields
    expect((result[0] as Record<string, unknown>)['__proto_pollution__']).toBeUndefined();
  });

  it('preserves valid optional fields when present', () => {
    const result = normaliseChanges({
      changes: [
        {
          action: 'set_asset_description',
          asset_id: 'good_1',
          description: 'A red apple',
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].asset_id).toBe('good_1');
    expect(result[0].description).toBe('A red apple');
  });
});

// ── H2: isChangeAllowed whitelist inversion tests ──

describe('isChangeAllowed — H2 whitelist inversion', () => {
  it('rejects unknown action string', () => {
    const change: ConfigChange = { action: 'delete_all_modules' };
    expect(isChangeAllowed(change)).toBe(false);
  });

  it('rejects fabricated action string', () => {
    const change: ConfigChange = { action: 'execute_code' };
    expect(isChangeAllowed(change)).toBe(false);
  });

  it('allows set_param action', () => {
    const change: ConfigChange = {
      action: 'set_param',
      module_type: 'Spawner',
      param_key: 'speed',
      param_value: 5,
    };
    expect(isChangeAllowed(change)).toBe(true);
  });

  it('allows set_theme action', () => {
    const change: ConfigChange = { action: 'set_theme', theme: 'space' };
    expect(isChangeAllowed(change)).toBe(true);
  });

  it('allows set_art_style action', () => {
    const change: ConfigChange = { action: 'set_art_style', art_style: 'pixel' };
    expect(isChangeAllowed(change)).toBe(true);
  });

  it('allows set_duration action', () => {
    const change: ConfigChange = { action: 'set_duration', duration: 45 };
    expect(isChangeAllowed(change)).toBe(true);
  });

  it('allows set_asset_description action', () => {
    const change: ConfigChange = {
      action: 'set_asset_description',
      asset_id: 'good_1',
      description: 'A red apple',
    };
    expect(isChangeAllowed(change)).toBe(true);
  });
});
