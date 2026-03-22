import { describe, it, expect } from 'vitest';
import { tryLocalMatch } from '../local-patterns.ts';
import type { GameConfig } from '@/engine/core/index.ts';

const mockConfig: GameConfig = {
  version: '1.0',
  meta: {
    name: 'Test Game',
    description: 'A test',
    thumbnail: null,
    createdAt: '2026-01-01',
  },
  canvas: { width: 800, height: 600 },
  modules: [
    {
      id: 'spawner-1',
      type: 'Spawner',
      enabled: true,
      params: { speed: 100, frequency: 2, maxCount: 10 },
    },
    {
      id: 'timer-1',
      type: 'Timer',
      enabled: true,
      params: { duration: 60, remaining: 60 },
    },
    {
      id: 'lives-1',
      type: 'Lives',
      enabled: true,
      params: { count: 3 },
    },
    {
      id: 'scorer-1',
      type: 'Scorer',
      enabled: true,
      params: { pointsPerHit: 10, score: 0 },
    },
    {
      id: 'difficulty-1',
      type: 'DifficultyRamp',
      enabled: true,
      params: { stepSize: 0.1, difficulty: 1 },
    },
  ],
  assets: {},
};

describe('tryLocalMatch', () => {
  it('should match "把速度调高" as increase pattern', () => {
    const result = tryLocalMatch('把速度调高', mockConfig);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('update_param');
    expect(result!.action).toBe('increase');
    expect(result!.moduleId).toBe('spawner-1');
    expect(result!.param).toBe('speed');
    expect(result!.value).toBeGreaterThan(100);
  });

  it('should match "把频率调低" as decrease pattern', () => {
    const result = tryLocalMatch('把频率调低', mockConfig);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('update_param');
    expect(result!.action).toBe('decrease');
    expect(result!.param).toBe('frequency');
    expect(result!.value).toBeLessThan(2);
  });

  it('should match "把时间改成30" as set pattern', () => {
    const result = tryLocalMatch('把时间改成30', mockConfig);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('update_param');
    expect(result!.action).toBe('set');
    expect(result!.param).toBe('duration');
    expect(result!.value).toBe(30);
  });

  it('should match "开启计时器" as enable pattern', () => {
    const result = tryLocalMatch('开启计时器', mockConfig);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('enable_module');
    expect(result!.moduleId).toBe('timer-1');
  });

  it('should match "关闭生命系统" as disable pattern', () => {
    const result = tryLocalMatch('关闭生命系统', mockConfig);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('disable_module');
    expect(result!.moduleId).toBe('lives-1');
  });

  it('should match increase variants', () => {
    const variants = ['速度增加', '把速度加大', '速度提高', '把速度调快'];
    for (const v of variants) {
      const result = tryLocalMatch(v, mockConfig);
      expect(result).not.toBeNull();
      expect(result!.action).toBe('increase');
    }
  });

  it('should match decrease variants', () => {
    const variants = ['速度减少', '把速度降低', '速度减小', '把速度调慢'];
    for (const v of variants) {
      const result = tryLocalMatch(v, mockConfig);
      expect(result).not.toBeNull();
      expect(result!.action).toBe('decrease');
    }
  });

  it('should match set variants', () => {
    const result1 = tryLocalMatch('把时间设为45', mockConfig);
    expect(result1).not.toBeNull();
    expect(result1!.value).toBe(45);

    const result2 = tryLocalMatch('生命设置为5', mockConfig);
    expect(result2).not.toBeNull();
    expect(result2!.value).toBe(5);
  });

  it('should match module toggle variants', () => {
    const enableResult = tryLocalMatch('打开计时器', mockConfig);
    expect(enableResult).not.toBeNull();
    expect(enableResult!.type).toBe('enable_module');

    const disableResult = tryLocalMatch('禁用计时器', mockConfig);
    expect(disableResult).not.toBeNull();
    expect(disableResult!.type).toBe('disable_module');
  });

  it('should return null for unrecognized input', () => {
    const result = tryLocalMatch('你好世界', mockConfig);
    expect(result).toBeNull();
  });

  it('should return null for English input without matches', () => {
    const result = tryLocalMatch('create a new game', mockConfig);
    expect(result).toBeNull();
  });

  it('should apply ~15% increase factor', () => {
    const result = tryLocalMatch('把速度调高', mockConfig);
    expect(result).not.toBeNull();
    // 100 * 1.15 = 115
    expect(result!.value).toBe(115);
  });

  it('should apply ~15% decrease factor', () => {
    const result = tryLocalMatch('把速度调低', mockConfig);
    expect(result).not.toBeNull();
    // 100 * 0.85 = 85
    expect(result!.value).toBe(85);
  });
});
