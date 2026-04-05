import { describe, it, expect } from 'vitest';
import {
  ALL_GAME_TYPES,
  GAME_TYPE_META,
} from '../game-presets';

describe('Expanded Game Presets', () => {
  it('has 38 game types in ALL_GAME_TYPES', () => {
    expect(ALL_GAME_TYPES.length).toBe(38);
  });

  it('has metadata for every game type', () => {
    for (const gt of ALL_GAME_TYPES) {
      const meta = GAME_TYPE_META[gt];
      expect(meta, `Missing meta for ${gt}`).toBeDefined();
    }
  });

  it('every metadata entry has category, displayName, description', () => {
    for (const [id, meta] of Object.entries(GAME_TYPE_META)) {
      expect(meta.category, `${id} missing category`).toBeTruthy();
      expect(meta.displayName, `${id} missing displayName`).toBeTruthy();
      expect(meta.description, `${id} missing description`).toBeTruthy();
    }
  });

  it('has 8 unique categories', () => {
    const categories = new Set(
      Object.values(GAME_TYPE_META).map((m) => m.category),
    );
    expect(categories.size).toBe(8);
  });

  it('every entry has supportedToday boolean', () => {
    for (const meta of Object.values(GAME_TYPE_META)) {
      expect(typeof meta.supportedToday).toBe('boolean');
    }
  });

  it('at least 29 types are marked supportedToday', () => {
    const supported = Object.values(GAME_TYPE_META).filter((m) => m.supportedToday);
    expect(supported.length).toBeGreaterThanOrEqual(29);
  });

  it('every entry has tags array', () => {
    for (const meta of Object.values(GAME_TYPE_META)) {
      expect(Array.isArray(meta.tags)).toBe(true);
    }
  });

  it('original 16 types still exist', () => {
    const original = [
      'catch', 'dodge', 'quiz', 'random-wheel', 'tap', 'shooting',
      'expression', 'runner', 'gesture', 'rhythm', 'puzzle',
      'dress-up', 'world-ar', 'narrative', 'platformer', 'action-rpg',
    ];
    for (const t of original) {
      expect(ALL_GAME_TYPES).toContain(t);
    }
  });

  it('no duplicate IDs in ALL_GAME_TYPES', () => {
    expect(new Set(ALL_GAME_TYPES).size).toBe(ALL_GAME_TYPES.length);
  });
});
