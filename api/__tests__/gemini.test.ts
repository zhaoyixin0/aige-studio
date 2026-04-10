/**
 * Tests for the Vercel serverless proxy function (api/gemini.ts).
 * Mocks global fetch and verifies request validation, proxying, and error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
      prompt: 'a red apple',
      aspectRatio: '1:1',
      imageSize: '1K',
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

describe('api/gemini handler', () => {
  let handler: (req: unknown, res: unknown) => Promise<unknown>;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    vi.resetModules();
    // Dynamic import so each test gets fresh module with updated env
    const mod = await import('../../api/gemini.ts');
    handler = mod.default;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    delete process.env.GEMINI_API_KEY;
    delete process.env.VITE_GEMINI_API_KEY;
  });

  it('returns 405 for non-POST requests', async () => {
    const req = makeMockReq({ method: 'GET' });
    const { res, statusFn, jsonFn } = makeMockRes();

    await handler(req, res);

    expect(statusFn).toHaveBeenCalledWith(405);
    expect(jsonFn).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('returns 500 when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.VITE_GEMINI_API_KEY;

    const req = makeMockReq();
    const { res, statusFn, jsonFn } = makeMockRes();

    await handler(req, res);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({
      error: 'GEMINI_API_KEY not configured on server',
    });
  });

  it('returns 400 when prompt is missing', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const req = makeMockReq({ body: {} });
    const { res, statusFn, jsonFn } = makeMockRes();

    await handler(req, res);

    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith({
      error: 'Missing or invalid "prompt" field',
    });
  });

  it('returns 400 when prompt is not a string', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const req = makeMockReq({ body: { prompt: 123 } });
    const { res, statusFn } = makeMockRes();

    await handler(req, res);

    expect(statusFn).toHaveBeenCalledWith(400);
  });

  it('proxies request to Gemini API and returns response on success', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const mockApiResponse = {
      candidates: [
        { content: { parts: [{ inlineData: { data: 'base64img' } }] } },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const req = makeMockReq();
    const { res, statusFn, jsonFn } = makeMockRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(typeof url).toBe('string');
    expect(url as string).toContain('key=test-key');
    expect((init as RequestInit).method).toBe('POST');

    expect(statusFn).toHaveBeenCalledWith(200);
    expect(jsonFn).toHaveBeenCalledWith(mockApiResponse);
  });

  it('forwards upstream error status from Gemini API', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const req = makeMockReq();
    const { res, statusFn, jsonFn } = makeMockRes();

    await handler(req, res);

    expect(statusFn).toHaveBeenCalledWith(429);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('429'),
      }),
    );
  });

  it('returns 500 when fetch throws', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const req = makeMockReq();
    const { res, statusFn, jsonFn } = makeMockRes();

    await handler(req, res);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({ error: 'network down' });
  });

  it('falls back to VITE_GEMINI_API_KEY when GEMINI_API_KEY is unset', async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.VITE_GEMINI_API_KEY = 'vite-key';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const req = makeMockReq();
    const { res, statusFn } = makeMockRes();

    await handler(req, res);

    expect(statusFn).toHaveBeenCalledWith(200);
    const [url] = fetchMock.mock.calls[0];
    expect(url as string).toContain('key=vite-key');
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
      process.env.INTERNAL_API_SECRET = 'my-secret-456';
      process.env.GEMINI_API_KEY = 'test-key';

      vi.resetModules();
      const mod = await import('../../api/gemini.ts');
      handler = mod.default;

      const req = makeMockReq({ headers: {} });
      const { res, statusFn, jsonFn } = makeMockRes();

      await handler(req, res);

      expect(statusFn).toHaveBeenCalledWith(401);
      expect(jsonFn).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('allows request with correct x-internal-secret', async () => {
      process.env.INTERNAL_API_SECRET = 'my-secret-456';
      process.env.GEMINI_API_KEY = 'test-key';

      vi.resetModules();
      const mod = await import('../../api/gemini.ts');
      handler = mod.default;

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      } as Response);
      global.fetch = fetchMock as unknown as typeof fetch;

      const req = makeMockReq({
        headers: { 'x-internal-secret': 'my-secret-456' },
      });
      const { res, statusFn } = makeMockRes();

      await handler(req, res);

      expect(statusFn).toHaveBeenCalledWith(200);
    });

    it('allows request when INTERNAL_API_SECRET is not set (backward compat)', async () => {
      delete process.env.INTERNAL_API_SECRET;
      process.env.GEMINI_API_KEY = 'test-key';

      vi.resetModules();
      const mod = await import('../../api/gemini.ts');
      handler = mod.default;

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      } as Response);
      global.fetch = fetchMock as unknown as typeof fetch;

      const req = makeMockReq({ headers: {} });
      const { res, statusFn } = makeMockRes();

      await handler(req, res);

      expect(statusFn).toHaveBeenCalledWith(200);
    });
  });

  describe('body size limit', () => {
    it('rejects oversized request body (>100KB)', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      const req = makeMockReq({
        headers: { 'content-length': '200000' },
      });
      const { res, statusFn, jsonFn } = makeMockRes();

      await handler(req, res);

      expect(statusFn).toHaveBeenCalledWith(413);
      expect(jsonFn).toHaveBeenCalledWith({ error: 'Request too large' });
    });

    it('allows request within size limit', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      } as Response);
      global.fetch = fetchMock as unknown as typeof fetch;

      const req = makeMockReq({
        headers: { 'content-length': '5000' },
      });
      const { res, statusFn } = makeMockRes();

      await handler(req, res);

      expect(statusFn).toHaveBeenCalledWith(200);
    });
  });
});
