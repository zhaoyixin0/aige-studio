/**
 * Tests that ConversationAgent uses the proxy client instead of direct Anthropic SDK.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the proxy client
vi.mock('@/services/claude-proxy', () => ({
  createClaudeClient: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock response' }],
      }),
    },
  })),
}));

// Mock skill-loader and other heavy dependencies to keep test focused
vi.mock('../skill-loader.ts', () => ({
  SkillLoader: class {
    loadForConversation() { return Promise.resolve(''); }
    loadExpertCardRich() { return Promise.resolve(null); }
    loadRecipeCardSummaries() { return Promise.resolve([]); }
  },
}));

vi.mock('../conversation-defs.ts', async () => {
  const actual = await vi.importActual<typeof import('../conversation-defs.ts')>('../conversation-defs.ts');
  return {
    ...actual,
    SYSTEM_PROMPT_BASE: 'test system prompt',
    TOOLS: [],
  };
});

vi.mock('@/engine/core/config-validator.ts', () => ({
  validateConfig: () => ({ errors: [], warnings: [], fixes: [] }),
  applyFixes: (config: unknown) => config,
}));

vi.mock('@/engine/core/contract-registry.ts', () => ({
  ContractRegistry: {
    fromRegistry: () => ({}),
  },
}));

vi.mock('@/engine/module-setup.ts', () => ({
  createModuleRegistry: () => ({}),
}));

describe('ConversationAgent proxy integration', () => {
  it('uses createClaudeClient (not direct Anthropic SDK)', async () => {
    const { createClaudeClient } = await import('@/services/claude-proxy');
    const { ConversationAgent } = await import('../conversation-agent.ts');

    const agent = new ConversationAgent();
    expect(agent).toBeDefined();
    expect(createClaudeClient).toHaveBeenCalled();
  });

  it('works without VITE_ANTHROPIC_API_KEY env var', async () => {
    const { ConversationAgent } = await import('../conversation-agent.ts');
    // Constructor takes no arguments now — proxy handles auth server-side
    const agent = new ConversationAgent();
    expect(agent).toBeDefined();
  });
});
