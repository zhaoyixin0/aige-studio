// Tests for AbortSignal propagation in claude-proxy createClaudeClient
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClaudeClient } from '../claude-proxy';

describe('createClaudeClient — AbortSignal propagation', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('passes signal to fetch init when provided to messages.create', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ content: [] }), { status: 200 }),
    );
    const controller = new AbortController();

    const client = createClaudeClient();
    await client.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { signal: controller.signal },
    );

    const init = vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });

  it('does not include signal when no options object is provided', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ content: [] }), { status: 200 }),
    );

    const client = createClaudeClient();
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'test',
      messages: [{ role: 'user', content: 'hi' }],
    });

    const init = vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeUndefined();
  });

  it('rejects with AbortError when signal is aborted', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted.');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }) as typeof fetch);

    const controller = new AbortController();
    const client = createClaudeClient();
    const promise = client.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { signal: controller.signal },
    );
    controller.abort();

    await expect(promise).rejects.toThrow(/abort/i);
  });
});
