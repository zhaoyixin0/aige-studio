/**
 * Tests for the browser-side Claude proxy client.
 * This client replaces direct Anthropic SDK usage in the browser,
 * forwarding requests to the /api/claude Vercel serverless function.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClaudeClient } from '../claude-proxy.ts';

describe('createClaudeClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns object with messages.create method', () => {
    const client = createClaudeClient();
    expect(client).toBeDefined();
    expect(client.messages).toBeDefined();
    expect(typeof client.messages.create).toBe('function');
  });

  it('messages.create() sends POST to /api/claude with correct body', async () => {
    const mockResponse = {
      id: 'msg_123',
      content: [{ type: 'text', text: 'Hello' }],
      role: 'assistant',
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const client = createClaudeClient();
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are helpful.',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'You are helpful.',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
  });

  it('messages.create() returns parsed JSON response on success', async () => {
    const mockResponse = {
      id: 'msg_456',
      content: [{ type: 'text', text: 'Response text' }],
      role: 'assistant',
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const client = createClaudeClient();
    const result = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'test',
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result).toEqual(mockResponse);
  });

  it('messages.create() throws error with status code on HTTP error', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );

    const client = createClaudeClient();
    await expect(
      client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrow('401');
  });

  it('messages.create() passes tools parameter when provided', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ content: [] }), { status: 200 }),
    );

    const tools = [{ name: 'test_tool', description: 'A test tool', input_schema: { type: 'object', properties: {} } }];
    const client = createClaudeClient();
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'test',
      messages: [{ role: 'user', content: 'test' }],
      tools,
    });

    const callBody = JSON.parse(
      vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string,
    );
    expect(callBody.tools).toEqual(tools);
  });

  it('messages.create() omits tools parameter when not provided', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ content: [] }), { status: 200 }),
    );

    const client = createClaudeClient();
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'test',
      messages: [{ role: 'user', content: 'test' }],
    });

    const callBody = JSON.parse(
      vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string,
    );
    expect(callBody.tools).toBeUndefined();
  });
});
