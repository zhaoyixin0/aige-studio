import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentParser } from '../intent-parser.ts';
import type { ParsedIntent } from '../intent-parser.ts';

// Mock the proxy client
vi.mock('@/services/claude-proxy.ts', () => ({
  createClaudeClient: () => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'test-id',
            name: 'classify_intent',
            input: {
              intent: 'create_game',
              gameType: 'catch',
            },
          },
        ],
      }),
    },
  }),
}));

describe('IntentParser', () => {
  let parser: IntentParser;

  beforeEach(() => {
    parser = new IntentParser();
  });

  it('should be instantiable', () => {
    expect(parser).toBeInstanceOf(IntentParser);
  });

  it('should parse a create_game intent from mocked API', async () => {
    const result: ParsedIntent = await parser.parse('创建一个接住游戏');
    expect(result.intent).toBe('create_game');
    expect(result.gameType).toBe('catch');
    expect(result.rawText).toBe('创建一个接住游戏');
  });

  it('should include rawText in the result', async () => {
    const text = '做个射击游戏';
    const result = await parser.parse(text);
    expect(result.rawText).toBe(text);
  });

  it('should handle parse with currentConfig context', async () => {
    const config = {
      version: '1.0',
      meta: {
        name: 'Test',
        description: '',
        thumbnail: null,
        createdAt: '2026-01-01',
      },
      canvas: { width: 800, height: 600 },
      modules: [
        { id: 'spawner-1', type: 'Spawner', enabled: true, params: {} },
      ],
      assets: {},
    };
    const result = await parser.parse('添加计时器', config);
    expect(result).toBeDefined();
    expect(result.rawText).toBe('添加计时器');
  });
});
