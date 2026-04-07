/**
 * Tests for the Vercel serverless proxy function (api/claude.ts).
 * Mocks the Anthropic SDK and verifies request validation, proxying, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Anthropic SDK before importing handler
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

// Helper to build mock VercelRequest / VercelResponse
function makeMockReq(overrides: {
  method?: string;
  body?: unknown;
} = {}): { method: string; body: unknown } {
  return {
    method: overrides.method ?? 'POST',
    body: overrides.body ?? {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'test',
      messages: [{ role: 'user', content: 'hello' }],
    },
  };
}

function makeMockRes() {
  const res: Record<string, unknown> = {};
  const statusFn = vi.fn().mockReturnValue(res);
  const jsonFn = vi.fn().mockReturnValue(res);
  res.status = statusFn;
  res.json = jsonFn;
  return { res, statusFn, jsonFn };
}

describe('api/claude handler', () => {
  let handler: (req: unknown, res: unknown) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    mockCreate.mockReset();
    // Dynamic import so each test gets fresh module with updated env
    const mod = await import('../../api/claude.ts');
    handler = mod.default;
  });

  it('returns 405 for non-POST requests', async () => {
    const req = makeMockReq({ method: 'GET' });
    const { res, statusFn, jsonFn } = makeMockRes();

    await handler(req, res);

    expect(statusFn).toHaveBeenCalledWith(405);
    expect(jsonFn).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('returns 500 when ANTHROPIC_API_KEY is not set', async () => {
    // Ensure env var is unset
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const req = makeMockReq();
    const { res, statusFn, jsonFn } = makeMockRes();

    await handler(req, res);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({
      error: 'ANTHROPIC_API_KEY not configured on server',
    });

    // Restore
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  });

  it('proxies request to Anthropic and returns response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const mockApiResponse = {
      id: 'msg_001',
      content: [{ type: 'text', text: 'Hello from Claude' }],
      role: 'assistant',
    };
    mockCreate.mockResolvedValue(mockApiResponse);

    const req = makeMockReq();
    const { res, statusFn, jsonFn } = makeMockRes();

    await handler(req, res);

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'test',
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(statusFn).toHaveBeenCalledWith(200);
    expect(jsonFn).toHaveBeenCalledWith(mockApiResponse);

    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns error status from Anthropic errors', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const apiError = new Error('Rate limit exceeded');
    (apiError as Record<string, unknown>).status = 429;
    mockCreate.mockRejectedValue(apiError);

    const req = makeMockReq();
    const { res, statusFn, jsonFn } = makeMockRes();

    await handler(req, res);

    expect(statusFn).toHaveBeenCalledWith(429);
    expect(jsonFn).toHaveBeenCalledWith({ error: 'Rate limit exceeded' });

    delete process.env.ANTHROPIC_API_KEY;
  });
});
