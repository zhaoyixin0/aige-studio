import { describe, it, expect } from 'vitest';
import {
  ALL_GAME_TYPES,
  GAME_TYPE_META,
} from '../game-presets';
import {
  KEYWORD_MAP,
  detectGameTypeFromMessage,
} from '../conversation-defs';

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

  it('at least 33 types are marked supportedToday', () => {
    const supported = Object.values(GAME_TYPE_META).filter((m) => m.supportedToday);
    expect(supported.length).toBeGreaterThanOrEqual(33);
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

describe('KEYWORD_MAP coverage', () => {
  it('has a keyword pattern for every game type', () => {
    const mapped = new Set(KEYWORD_MAP.map((k) => k.gameType));
    const missing = ALL_GAME_TYPES.filter((t) => !mapped.has(t));
    expect(missing, `Missing KEYWORD_MAP entries: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('no duplicate gameType in KEYWORD_MAP', () => {
    const types = KEYWORD_MAP.map((k) => k.gameType);
    expect(new Set(types).size).toBe(types.length);
  });

  it('detectGameTypeFromMessage returns correct type for sample inputs', () => {
    const samples: Array<[string, string]> = [
      // Original 16
      ['我想做一个接水果游戏', 'catch'],
      ['做个躲避球', 'dodge'],
      ['射击大战', 'shooting'],
      ['跑酷游戏', 'runner'],
      ['RPG角色扮演', 'action-rpg'],
      // New 22
      ['弹弓发射', 'slingshot'],
      ['打地鼠游戏', 'whack-a-mole'],
      ['物理球游戏', 'ball-physics'],
      ['弹道轨迹', 'trajectory'],
      ['弹球反弹', 'bouncing'],
      ['割绳子解谜', 'rope-cutting'],
      ['连线配对', 'match-link'],
      ['拼图组装', 'jigsaw'],
      ['水管连接', 'water-pipe'],
      ['天平称重', 'scale-matching'],
      ['翻牌猜猜', 'flip-guess'],
      ['歪头选择', 'head-tilt'],
      ['画画涂鸦', 'drawing'],
      ['头像框', 'avatar-frame'],
      ['赛车竞速', 'racing'],
      ['过马路', 'cross-road'],
      ['滚球', 'ball-rolling'],
      ['迷宫', 'maze'],
      ['糖果挑战', 'sugar-insert'],
      ['游泳比赛', 'swimmer'],
      ['果冻弹跳', 'jelly'],
      ['快速反应', 'quick-reaction'],
    ];
    for (const [input, expected] of samples) {
      expect(
        detectGameTypeFromMessage(input),
        `"${input}" should detect as "${expected}"`,
      ).toBe(expected);
    }
  });

  it('returns null for unrelated messages', () => {
    expect(detectGameTypeFromMessage('今天天气不错')).toBeNull();
    expect(detectGameTypeFromMessage('hello world')).toBeNull();
  });

  it('anti-collision: reordered types resolve to specific type, not generic', () => {
    // "拼图" → jigsaw (not puzzle)
    expect(detectGameTypeFromMessage('拼图')).toBe('jigsaw');
    // "翻牌" → flip-guess (not puzzle)
    expect(detectGameTypeFromMessage('翻牌')).toBe('flip-guess');
    // "记忆卡" → flip-guess (not puzzle)
    expect(detectGameTypeFromMessage('记忆卡')).toBe('flip-guess');
    // "弹珠" → bouncing (not ball-physics)
    expect(detectGameTypeFromMessage('弹珠')).toBe('bouncing');
    // "配对" still → puzzle (generic fallback)
    expect(detectGameTypeFromMessage('配对游戏')).toBe('puzzle');
  });
});
