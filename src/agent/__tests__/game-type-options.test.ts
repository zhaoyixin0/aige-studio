import { describe, it, expect } from 'vitest';
import { buildGameTypeOptions, buildFullGameTypeOptions } from '../game-type-options';
import { ALL_GAME_TYPES, GAME_TYPE_META } from '../game-presets';

describe('buildGameTypeOptions', () => {
  const options = buildGameTypeOptions();

  it('returns all 38 game types', () => {
    expect(options).toHaveLength(ALL_GAME_TYPES.length);
    expect(options).toHaveLength(38);
  });

  it('each option has id, name, and category', () => {
    for (const opt of options) {
      expect(opt.id).toBeTruthy();
      expect(opt.name).toBeTruthy();
      expect(opt.category).toBeTruthy();
    }
  });

  it('all ids come from ALL_GAME_TYPES', () => {
    const ids = new Set(options.map((o) => o.id));
    for (const id of ALL_GAME_TYPES) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('supported types appear before unsupported', () => {
    const firstUnsupported = options.findIndex((o) => o.supportedToday === false);
    if (firstUnsupported === -1) return; // all supported
    const afterUnsupported = options.slice(firstUnsupported);
    const supportedAfter = afterUnsupported.filter((o) => o.supportedToday !== false);
    expect(supportedAfter).toHaveLength(0);
  });

  it('maps emoji from GAME_TYPE_META', () => {
    for (const opt of options) {
      const meta = GAME_TYPE_META[opt.id as keyof typeof GAME_TYPE_META];
      expect(opt.emoji).toBe(meta.emoji);
    }
  });

  it('maps displayName to name', () => {
    for (const opt of options) {
      const meta = GAME_TYPE_META[opt.id as keyof typeof GAME_TYPE_META];
      expect(opt.name).toBe(meta.displayName);
    }
  });

  it('returns more than 15 options (full catalog beyond DEFAULT_CHIPS)', () => {
    expect(options.length).toBeGreaterThan(15);
  });

  it('known-working types are marked supportedToday=true', () => {
    const knownWorking = ['catch', 'shooting', 'platformer', 'dodge', 'rhythm'];
    for (const id of knownWorking) {
      const opt = options.find((o) => o.id === id);
      expect(opt, `${id} should be in catalog`).toBeDefined();
      expect(opt?.supportedToday).toBe(true);
    }
  });

  it('returns options in deterministic order across calls', () => {
    const a = buildGameTypeOptions().map((o) => o.id);
    const b = buildGameTypeOptions().map((o) => o.id);
    expect(a).toEqual(b);
  });
});

describe('buildFullGameTypeOptions', () => {
  it('is a stable alias of buildGameTypeOptions', () => {
    const a = buildFullGameTypeOptions();
    const b = buildGameTypeOptions();
    expect(a.map((o) => o.id)).toEqual(b.map((o) => o.id));
    expect(a.length).toBe(b.length);
  });

  it('returns the full catalog (≥15 entries)', () => {
    const opts = buildFullGameTypeOptions();
    expect(opts.length).toBeGreaterThan(15);
  });
});
