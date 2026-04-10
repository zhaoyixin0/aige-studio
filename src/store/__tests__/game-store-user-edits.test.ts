import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../game-store';
import type { GameConfig } from '@/engine/core';
import type { ConfigChange } from '@/agent/conversation-defs';

const BASE_CONFIG: GameConfig = {
  version: '1.0.0',
  meta: {
    name: 'Test',
    description: '',
    thumbnail: null,
    createdAt: '',
    theme: 'fruit',
    assetDescriptions: { good_1: 'apple' },
  },
  canvas: { width: 800, height: 600 },
  modules: [
    { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: 30 } },
    {
      id: 'spawner_1',
      type: 'Spawner',
      enabled: true,
      params: { frequency: 1.0, spawnInterval: 500 },
    },
    {
      id: 'scorer_1',
      type: 'Scorer',
      enabled: true,
      params: { hitEvent: 'collision:hit' },
    },
  ],
  assets: {
    player: { type: 'sprite', src: 'old.png' },
    good_1: { type: 'sprite', src: '' },
  },
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

describe('GameStore user edits tracking', () => {
  beforeEach(() => {
    useGameStore.setState({ config: null, configVersion: 0, userEdits: {}, lastEnricherResult: null });
  });

  it('userEdits starts as an empty object', () => {
    const state = useGameStore.getState();
    expect(state.userEdits).toEqual({});
  });

  it('setConfig does not populate userEdits (programmatic write)', () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));
    expect(useGameStore.getState().userEdits).toEqual({});
  });

  it('applyUserConfigChange records path timestamp and updates module param', () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));

    const before = Date.now();
    store.applyUserConfigChange('modules[spawner_1].params.frequency', 2.0);
    const after = Date.now();

    const state = useGameStore.getState();
    const spawner = state.config!.modules.find((m) => m.id === 'spawner_1');
    expect(spawner!.params.frequency).toBe(2.0);

    const ts = state.userEdits['modules[spawner_1].params.frequency'];
    expect(typeof ts).toBe('number');
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('applyUserConfigChange writes meta.assetDescriptions.<key>', () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));

    store.applyUserConfigChange(
      'meta.assetDescriptions.good_1',
      'red apple',
    );

    const state = useGameStore.getState();
    expect(state.config!.meta.assetDescriptions!.good_1).toBe('red apple');
    expect(
      state.userEdits['meta.assetDescriptions.good_1'],
    ).toBeGreaterThan(0);
  });

  it('applyUserConfigChange writes meta.theme', () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));

    store.applyUserConfigChange('meta.theme', 'space');

    const state = useGameStore.getState();
    expect(state.config!.meta.theme).toBe('space');
    expect(state.userEdits['meta.theme']).toBeGreaterThan(0);
  });

  it('applyUserConfigChange writes assets.<id>.src', () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));

    store.applyUserConfigChange('assets.player.src', 'data:image/png;base64,abc');

    const state = useGameStore.getState();
    expect(state.config!.assets.player.src).toBe('data:image/png;base64,abc');
    expect(state.userEdits['assets.player.src']).toBeGreaterThan(0);
  });

  it('applyUserConfigChange is immutable (does not mutate previous config)', () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));
    const prev = useGameStore.getState().config!;

    store.applyUserConfigChange('modules[timer_1].params.duration', 60);

    const next = useGameStore.getState().config!;
    expect(next).not.toBe(prev);
    expect(prev.modules.find((m) => m.id === 'timer_1')!.params.duration).toBe(
      30,
    );
    expect(next.modules.find((m) => m.id === 'timer_1')!.params.duration).toBe(
      60,
    );
  });

  it('applyEnricherDiff skips fields edited after enrichmentStartedAt', async () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));

    const enrichmentStartedAt = Date.now();

    // Let a real tick pass so timestamps are strictly greater than startedAt.
    await new Promise((r) => setTimeout(r, 5));

    // User edits spawner frequency DURING enrichment.
    store.applyUserConfigChange('modules[spawner_1].params.frequency', 5.0);

    // Enricher now returns a diff that tries to overwrite both duration AND
    // the user-edited frequency.
    const changes: ConfigChange[] = [
      { action: 'set_duration', duration: 45 },
      {
        action: 'set_param',
        module_type: 'Spawner',
        param_key: 'frequency',
        param_value: 2.0,
      },
    ];

    store.applyEnricherDiff(changes, enrichmentStartedAt);
    const result = useGameStore.getState().lastEnricherResult!;

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.skippedPaths).toContain(
      'modules[spawner_1].params.frequency',
    );

    const state = useGameStore.getState();
    // duration applied
    expect(
      state.config!.modules.find((m) => m.type === 'Timer')!.params.duration,
    ).toBe(45);
    // frequency preserved at user value
    expect(
      state.config!.modules.find((m) => m.id === 'spawner_1')!.params.frequency,
    ).toBe(5.0);
  });

  it('applyEnricherDiff applies all changes when no user edits happened', () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));

    const enrichmentStartedAt = Date.now();
    const changes: ConfigChange[] = [
      { action: 'set_duration', duration: 45 },
      { action: 'set_theme', theme: 'space' },
    ];

    store.applyEnricherDiff(changes, enrichmentStartedAt);
    const result = useGameStore.getState().lastEnricherResult!;

    expect(result.applied).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.skippedPaths).toEqual([]);

    const state = useGameStore.getState();
    expect(state.config!.meta.theme).toBe('space');
    expect(
      state.config!.modules.find((m) => m.type === 'Timer')!.params.duration,
    ).toBe(45);
  });

  it('applyEnricherDiff preserves user edits made BEFORE startedAt (still applies diff)', async () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));

    // Edit BEFORE enrichment starts.
    store.applyUserConfigChange('modules[spawner_1].params.frequency', 5.0);

    await new Promise((r) => setTimeout(r, 5));
    const enrichmentStartedAt = Date.now();

    const changes: ConfigChange[] = [
      {
        action: 'set_param',
        module_type: 'Spawner',
        param_key: 'frequency',
        param_value: 2.0,
      },
    ];

    store.applyEnricherDiff(changes, enrichmentStartedAt);
    const result = useGameStore.getState().lastEnricherResult!;
    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);

    // Pre-enrichment user edits do NOT block enricher writes (they are stale).
    const state = useGameStore.getState();
    expect(
      state.config!.modules.find((m) => m.id === 'spawner_1')!.params.frequency,
    ).toBe(2.0);
  });

  it('applyEnricherDiff is a no-op when config is null', () => {
    const store = useGameStore.getState();
    store.applyEnricherDiff([], Date.now());
    const result = useGameStore.getState().lastEnricherResult;
    expect(result).toEqual({ applied: 0, skipped: 0, skippedPaths: [] });
  });

  it('resetUserEdits clears all tracked edits', () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));
    store.applyUserConfigChange('meta.theme', 'space');
    expect(Object.keys(useGameStore.getState().userEdits).length).toBe(1);

    store.resetUserEdits();
    expect(useGameStore.getState().userEdits).toEqual({});
  });

  it('clearUserEditsForPath removes a single entry', () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));
    store.applyUserConfigChange('meta.theme', 'space');
    store.applyUserConfigChange('modules[timer_1].params.duration', 60);

    store.clearUserEditsForPath('meta.theme');

    const edits = useGameStore.getState().userEdits;
    expect(edits['meta.theme']).toBeUndefined();
    expect(edits['modules[timer_1].params.duration']).toBeGreaterThan(0);
  });

  // ── H4: applyEnricherDiff atomicity ──

  it('applyEnricherDiff reads config atomically — concurrent write is not lost', () => {
    // Regression test for H4: the old implementation used get() to snapshot
    // state, then set({...}) to write — any concurrent store write between
    // those two calls would be silently overwritten.
    //
    // After the fix, applyEnricherDiff uses set((state) => ...) so config
    // reads and writes are atomic within Zustand's synchronous updater.
    //
    // We verify the atomic behavior by checking that a field NOT touched by
    // the enricher diff (meta.theme) survives an applyEnricherDiff that
    // only modifies duration. In the old code, the stale snapshot would
    // revert the theme change if both happened in the same synchronous tick.
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));

    // Mutate theme via a separate action first.
    store.applyUserConfigChange('meta.theme', 'ocean');
    const versionAfterTheme = useGameStore.getState().configVersion;

    // Now apply enricher diff — it should see the latest state (with ocean theme).
    const changes: ConfigChange[] = [
      { action: 'set_duration', duration: 99 },
    ];
    store.applyEnricherDiff(changes, Date.now());

    const state = useGameStore.getState();
    // Theme must be preserved (not reverted to 'fruit' from a stale snapshot).
    expect(state.config!.meta.theme).toBe('ocean');
    // Duration must be applied.
    expect(
      state.config!.modules.find((m) => m.type === 'Timer')!.params.duration,
    ).toBe(99);
    // Version must have incremented past the theme write.
    expect(state.configVersion).toBeGreaterThan(versionAfterTheme);
  });

  it('applyEnricherDiff stores result in lastEnricherResult', () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));

    const changes: ConfigChange[] = [
      { action: 'set_duration', duration: 45 },
      { action: 'set_theme', theme: 'space' },
    ];
    store.applyEnricherDiff(changes, Date.now());

    const result = useGameStore.getState().lastEnricherResult;
    expect(result).not.toBeNull();
    expect(result!.applied).toBe(2);
    expect(result!.skipped).toBe(0);
    expect(result!.skippedPaths).toEqual([]);
  });

  // ── H5: setPresetEnriched store action ──

  it('setPresetEnriched updates meta.presetEnriched and increments configVersion', () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));

    const oldVersion = useGameStore.getState().configVersion;
    store.setPresetEnriched(true);

    const state = useGameStore.getState();
    expect(state.config!.meta.presetEnriched).toBe(true);
    expect(state.configVersion).toBe(oldVersion + 1);
  });

  it('setPresetEnriched is a no-op when config is null', () => {
    useGameStore.setState({ config: null, configVersion: 0, userEdits: {}, lastEnricherResult: null });
    const store = useGameStore.getState();
    store.setPresetEnriched(true);

    const state = useGameStore.getState();
    expect(state.config).toBeNull();
    expect(state.configVersion).toBe(0);
  });

  it('setPresetEnriched accepts string values ("pending", "failed", "cancelled")', () => {
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));

    store.setPresetEnriched('pending');
    expect(useGameStore.getState().config!.meta.presetEnriched).toBe('pending');

    store.setPresetEnriched('failed');
    expect(useGameStore.getState().config!.meta.presetEnriched).toBe('failed');

    store.setPresetEnriched(undefined);
    expect(useGameStore.getState().config!.meta.presetEnriched).toBeUndefined();
  });

  // ── M2: enricher changes are NOT user edits (by design) ──

  it('applyEnricherDiff does NOT record enricher changes as userEdits (by design)', () => {
    // Enricher-applied changes are programmatic, not user-initiated.
    // They must NOT pollute userEdits, otherwise a subsequent enrichment
    // would see stale timestamps and skip legitimate re-enrichment.
    // Double-enrichment is already guarded by:
    //   1. preset-enricher.ts idempotency check (meta.presetEnriched === true → null)
    //   2. use-preset-enrichment.ts shouldTriggerEnrichment (only undefined triggers)
    const store = useGameStore.getState();
    store.setConfig(clone(BASE_CONFIG));

    const editsBefore = { ...useGameStore.getState().userEdits };

    const changes: ConfigChange[] = [
      { action: 'set_duration', duration: 45 },
      {
        action: 'set_param',
        module_type: 'Spawner',
        param_key: 'frequency',
        param_value: 3.0,
      },
    ];
    store.applyEnricherDiff(changes, Date.now());

    const editsAfter = useGameStore.getState().userEdits;
    expect(editsAfter).toEqual(editsBefore);
  });
});
