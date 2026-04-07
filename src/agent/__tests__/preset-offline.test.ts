import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationAgent } from '../conversation-agent';
import { _resetRegistry } from '@/engine/systems/recipe-runner/facade';

describe('Preset offline fallback (no API key)', () => {
  let agent: ConversationAgent;

  beforeEach(() => {
    _resetRegistry();
    // No API key → agent uses offline path
    agent = new ConversationAgent();
  });

  it('"使用模板 hero-catch-fruit" creates a config', async () => {
    const result = await agent.process('使用模板 hero-catch-fruit');
    expect(result.config).toBeDefined();
    expect(result.reply).toContain('已使用模板');
    expect(result.reply).toContain('hero-catch-fruit');
    expect(result.chips).toBeDefined();
    expect(result.chips!.length).toBeGreaterThan(0);
  });

  it('"使用模板 nonexistent-id" returns graceful error', async () => {
    const result = await agent.process('使用模板 nonexistent-id');
    expect(result.config).toBeUndefined();
    expect(result.reply).toContain('加载失败');
    expect(result.needsMoreInfo).toBe(true);
  });

  it('"use preset hero-catch-fruit" works with English variant', async () => {
    const result = await agent.process('use preset hero-catch-fruit');
    expect(result.config).toBeDefined();
    expect(result.reply).toContain('已使用模板');
  });

  it('preset interception works without server-side API key', async () => {
    // Proxy client is always present; preset interception is regex-based
    // and never touches the API — works regardless of server key config.
    expect((agent as any).client).toBeDefined();
    const result = await agent.process('使用模板 hero-catch-fruit');
    expect(result.config).toBeDefined();
    expect(result.config!.modules.length).toBeGreaterThan(0);
  });
});
