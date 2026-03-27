import { describe, it, expect } from 'vitest';
import {
  buildSystemPrompt,
  detectGameTypeFromMessage,
} from '../conversation-agent';

/* ------------------------------------------------------------------ */
/*  detectGameTypeFromMessage                                          */
/* ------------------------------------------------------------------ */

describe('detectGameTypeFromMessage', () => {
  it('detects shooting game type from Chinese keywords', () => {
    expect(detectGameTypeFromMessage('帮我做一个射击游戏')).toBe('shooting');
    expect(detectGameTypeFromMessage('做一个飞机大战')).toBe('shooting');
  });

  it('detects catch game type', () => {
    expect(detectGameTypeFromMessage('我要接水果')).toBe('catch');
  });

  it('detects platformer game type', () => {
    expect(detectGameTypeFromMessage('做个平台跳跃闯关游戏')).toBe('platformer');
  });

  it('detects action-rpg game type', () => {
    expect(detectGameTypeFromMessage('来个RPG打怪升级')).toBe('action-rpg');
  });

  it('returns null for unrecognized input', () => {
    expect(detectGameTypeFromMessage('hello world')).toBeNull();
    expect(detectGameTypeFromMessage('今天天气真好')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectGameTypeFromMessage('')).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  buildSystemPrompt                                                  */
/* ------------------------------------------------------------------ */

describe('buildSystemPrompt', () => {
  it('returns base prompt when no game type or modules', async () => {
    const prompt = await buildSystemPrompt(null, []);
    // Should have the base content (game types, modules list)
    expect(prompt).toContain('AIGE Studio');
    expect(prompt).toContain('16 种游戏类型');
    expect(prompt).toContain('可用模块');
    // Should NOT have detailed knowledge section
    expect(prompt).not.toContain('详细游戏知识');
  });

  it('includes game type knowledge when game type is provided', async () => {
    const prompt = await buildSystemPrompt('shooting', []);
    expect(prompt).toContain('详细游戏知识');
    // Shooting game type doc should be loaded
    expect(prompt).toContain('射击');
  });

  it('includes filtered wiring when modules are provided', async () => {
    const prompt = await buildSystemPrompt('catch', [
      'Spawner', 'Collision', 'Scorer',
    ]);
    expect(prompt).toContain('详细游戏知识');
    // Should have wiring content about these modules
    expect(prompt).toContain('Spawner');
    expect(prompt).toContain('Collision');
  });

  it('includes current config context when provided', async () => {
    const config = {
      version: '1.0.0',
      meta: {
        name: 'Test Game',
        description: 'test',
        thumbnail: null,
        createdAt: '2026-01-01',
        theme: 'fruit',
        artStyle: 'cartoon',
      },
      canvas: { width: 1080, height: 1920 },
      modules: [
        { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: 30 } },
      ],
      assets: {},
    };
    const prompt = await buildSystemPrompt(null, ['Timer'], config);
    expect(prompt).toContain('当前游戏配置');
    expect(prompt).toContain('Test Game');
    expect(prompt).toContain('Timer');
  });

  it('handles non-existent game type gracefully', async () => {
    const prompt = await buildSystemPrompt('nonexistent-xyz', []);
    // Should not crash, should return base prompt
    expect(prompt).toContain('AIGE Studio');
    // No knowledge section since game type not found
    expect(prompt).not.toContain('详细游戏知识');
  });

  it('always contains the compact module overview', async () => {
    const prompt = await buildSystemPrompt('shooting', ['Projectile', 'EnemyAI']);
    // Base prompt module categories should always be present
    expect(prompt).toContain('输入模块');
    expect(prompt).toContain('核心机制');
    expect(prompt).toContain('射击/战斗');
    expect(prompt).toContain('平台跳跃');
  });

  it('always contains behavior rules', async () => {
    const prompt = await buildSystemPrompt('catch', []);
    expect(prompt).toContain('行为准则');
  });

  it('does not contain hardcoded 游戏类型模块配方 section', async () => {
    const prompt = await buildSystemPrompt(null, []);
    // The old detailed collision rules should be removed
    // (replaced by dynamic knowledge loading)
    expect(prompt).not.toContain('游戏类型模块配方');
    expect(prompt).not.toContain('射击/RPG 模块交互');
  });
});
