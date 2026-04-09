// Tests for AbortSignal propagation in GeminiImageService
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { GeminiImageService } from '../gemini-image';

describe('GeminiImageService — AbortSignal propagation', () => {
  let service: GeminiImageService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new GeminiImageService();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockOk(): void {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{
          content: {
            parts: [{ inlineData: { mimeType: 'image/png', data: 'base64data' } }],
          },
        }],
      }),
    });
  }

  it('passes AbortSignal to fetch init when provided via generateImageRaw', async () => {
    mockOk();
    const controller = new AbortController();

    await service.generateImageRaw('hello', undefined, controller.signal);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });

  it('passes AbortSignal to fetch init when provided via generateImage', async () => {
    mockOk();
    const controller = new AbortController();

    await service.generateImage('hello', 'cartoon', undefined, controller.signal);

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });

  it('does not include signal when none is provided (backward compatible)', async () => {
    mockOk();

    await service.generateImageRaw('hello');

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeUndefined();
  });

  it('rejects with AbortError when signal is aborted before fetch resolves', async () => {
    fetchSpy.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted.');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const controller = new AbortController();
    const promise = service.generateImageRaw('hello', undefined, controller.signal);
    controller.abort();

    await expect(promise).rejects.toThrow(/abort/i);
  });
});
