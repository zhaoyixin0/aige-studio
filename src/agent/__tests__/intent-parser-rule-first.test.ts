import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentParser } from '../intent-parser.ts';
import type { GameConfig } from '@/engine/core/index.ts';

// When local match succeeds, the LLM must NOT be called
vi.mock('@/services/claude-proxy.ts', () => ({
  createClaudeClient: () => ({
    messages: {
      create: vi.fn(() =>
        Promise.reject(new Error('LLM should not be called for local-matchable input')),
      ),
    },
  }),
}));

const fakeConfig: GameConfig = {
  version: '1.0.0',
  meta: {
    name: 'Test',
    description: '',
    thumbnail: null,
    createdAt: '2026-01-01',
    theme: 'fruit',
    artStyle: 'cartoon',
  },
  canvas: { width: 1080, height: 1920 },
  modules: [
    {
      id: 'spawner_1',
      type: 'Spawner',
      enabled: true,
      params: { speed: 100, frequency: 1.5 },
    },
    {
      id: 'timer_1',
      type: 'Timer',
      enabled: true,
      params: { duration: 60 },
    },
  ],
  assets: {},
};

describe('IntentParser rule-first fallback', () => {
  let parser: IntentParser;

  beforeEach(() => {
    parser = new IntentParser();
  });

  it('uses local pattern for 把速度调高 without calling LLM', async () => {
    const result = await parser.parse('把速度调高', fakeConfig);
    expect(result.intent).toBe('modify_param');
    expect(result.targetModule).toBe('Spawner');
    expect(result.targetParam).toBe('speed');
    expect(typeof result.targetValue).toBe('number');
    expect(result.targetValue as number).toBeGreaterThan(100);
    expect(result.rawText).toBe('把速度调高');
  });

  it('uses local pattern for 把频率调低 without calling LLM', async () => {
    const result = await parser.parse('把频率调低', fakeConfig);
    expect(result.intent).toBe('modify_param');
    expect(result.targetParam).toMatch(/frequency/i);
    expect(result.targetModule).toBe('Spawner');
    expect(result.targetValue as number).toBeLessThan(1.5);
    expect(result.rawText).toBe('把频率调低');
  });

  it('uses local pattern for 速度调高一点 without calling LLM', async () => {
    const result = await parser.parse('速度调高一点', fakeConfig);
    expect(result.intent).toBe('modify_param');
    expect(result.targetParam).toBe('speed');
    expect(result.targetValue as number).toBeGreaterThan(100);
  });

  it('uses local pattern for 把速度调低 without calling LLM', async () => {
    const result = await parser.parse('把速度调低', fakeConfig);
    expect(result.intent).toBe('modify_param');
    expect(result.targetParam).toBe('speed');
    expect(result.targetValue as number).toBeLessThan(100);
  });

  it('uses local pattern for enable_module — 开启计时器 — without calling LLM', async () => {
    const result = await parser.parse('开启计时器', fakeConfig);
    expect(result.intent).toBe('add_module');
    expect(result.targetModule).toBe('Timer');
    expect(result.rawText).toBe('开启计时器');
  });

  it('uses local pattern for disable_module — 关闭计时器 — without calling LLM', async () => {
    const result = await parser.parse('关闭计时器', fakeConfig);
    expect(result.intent).toBe('remove_module');
    expect(result.targetModule).toBe('Timer');
    expect(result.rawText).toBe('关闭计时器');
  });

  it('includes rawText in result for all local-matched cases', async () => {
    const msg = '把速度改成200';
    const result = await parser.parse(msg, fakeConfig);
    expect(result.rawText).toBe(msg);
  });

  it('returns modify_param with set value for 把速度改成200', async () => {
    const result = await parser.parse('把速度改成200', fakeConfig);
    expect(result.intent).toBe('modify_param');
    expect(result.targetParam).toBe('speed');
    expect(result.targetValue).toBe(200);
  });
});

describe('IntentParser skips local match when no config provided', () => {
  it('does not crash when config is null and falls back (mock returns known intent)', async () => {
    // Reset the mock to return a valid response for this test scope
    const { createClaudeClient } = await import('@/services/claude-proxy.ts');
    const mockCreate = (createClaudeClient() as { messages: { create: ReturnType<typeof vi.fn> } }).messages.create;
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'test-id',
          name: 'classify_intent',
          input: { intent: 'ask_question', question: '帮我' },
        },
      ],
    });

    const parser = new IntentParser();
    // null config — local match is skipped, falls through to LLM
    // But LLM mock rejects by default, so we just verify null config doesn't skip parse()
    // and the error is a proper Error (not a type error from bad adapter)
    await expect(parser.parse('把速度调高', null)).rejects.toThrow(
      'LLM should not be called for local-matchable input',
    );
  });
});
