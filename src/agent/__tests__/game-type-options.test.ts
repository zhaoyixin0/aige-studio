import { describe, it, expect } from 'vitest';
import { buildGameTypeOptions } from '../game-type-options';
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
});
