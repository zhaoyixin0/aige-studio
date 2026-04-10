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
  headers?: Record<string, string>;
} = {}): { method: string; body: unknown; headers: Record<string, string> } {
  return {
    method: overrides.method ?? 'POST',
    headers: overrides.headers ?? {},
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

  it('returns 500 when neither ANTHROPIC_API_KEY nor VITE_ANTHROPIC_API_KEY is set', async () => {
    // Handler falls back to VITE_ANTHROPIC_API_KEY, so both must be unset
    const savedServer = process.env.ANTHROPIC_API_KEY;
    const savedVite = process.env.VITE_ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.VITE_ANTHROPIC_API_KEY;

    const req = makeMockReq();
    const { res, statusFn, jsonFn } = makeMockRes();

    await handler(req, res);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({
      error: 'ANTHROPIC_API_KEY not configured on server',
    });

    // Restore
    if (savedServer !== undefined) process.env.ANTHROPIC_API_KEY = savedServer;
    if (savedVite !== undefined) process.env.VITE_ANTHROPIC_API_KEY = savedVite;
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

  /* ---------------------------------------------------------------- */
  /*  H7: Security — internal secret header + body size limit          */
  /* ---------------------------------------------------------------- */

  describe('internal secret authentication', () => {
    const savedSecret = process.env.INTERNAL_API_SECRET;

    afterEach(() => {
      if (savedSecret !== undefined) {
        process.env.INTERNAL_API_SECRET = savedSecret;
      } else {
        delete process.env.INTERNAL_API_SECRET;
      }
    });

    it('rejects request without x-internal-secret when INTERNAL_API_SECRET is set', async () => {
      process.env.INTERNAL_API_SECRET = 'my-secret-123';
      process.env.ANTHROPIC_API_KEY = 'test-key';

      // Re-import to pick up new env
      vi.resetModules();
      mockCreate.mockReset();
      const mod = await import('../../api/claude.ts');
      handler = mod.default;

      const req = makeMockReq({ headers: {} });
      const { res, statusFn, jsonFn } = makeMockRes();

      await handler(req, res);

      expect(statusFn).toHaveBeenCalledWith(401);
      expect(jsonFn).toHaveBeenCalledWith({ error: 'Unauthorized' });

      delete process.env.ANTHROPIC_API_KEY;
    });

    it('allows request with correct x-internal-secret', async () => {
      process.env.INTERNAL_API_SECRET = 'my-secret-123';
      process.env.ANTHROPIC_API_KEY = 'test-key';

      vi.resetModules();
      mockCreate.mockReset();
      mockCreate.mockResolvedValue({ id: 'msg_ok' });
      const mod = await import('../../api/claude.ts');
      handler = mod.default;

      const req = makeMockReq({
        headers: { 'x-internal-secret': 'my-secret-123' },
      });
      const { res, statusFn } = makeMockRes();

      await handler(req, res);

      expect(statusFn).toHaveBeenCalledWith(200);

      delete process.env.ANTHROPIC_API_KEY;
    });

    it('allows request when INTERNAL_API_SECRET is not set (backward compat)', async () => {
      delete process.env.INTERNAL_API_SECRET;
      process.env.ANTHROPIC_API_KEY = 'test-key';

      vi.resetModules();
      mockCreate.mockReset();
      mockCreate.mockResolvedValue({ id: 'msg_ok' });
      const mod = await import('../../api/claude.ts');
      handler = mod.default;

      const req = makeMockReq({ headers: {} });
      const { res, statusFn } = makeMockRes();

      await handler(req, res);

      expect(statusFn).toHaveBeenCalledWith(200);

      delete process.env.ANTHROPIC_API_KEY;
    });
  });

  describe('body size limit', () => {
    it('rejects oversized request body (>100KB)', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const req = makeMockReq({
        headers: { 'content-length': '200000' },
      });
      const { res, statusFn, jsonFn } = makeMockRes();

      await handler(req, res);

      expect(statusFn).toHaveBeenCalledWith(413);
      expect(jsonFn).toHaveBeenCalledWith({ error: 'Request too large' });

      delete process.env.ANTHROPIC_API_KEY;
    });

    it('allows request within size limit', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      mockCreate.mockResolvedValue({ id: 'msg_ok' });

      const req = makeMockReq({
        headers: { 'content-length': '5000' },
      });
      const { res, statusFn } = makeMockRes();

      await handler(req, res);

      expect(statusFn).toHaveBeenCalledWith(200);

      delete process.env.ANTHROPIC_API_KEY;
    });
  });
});
