// src/services/__tests__/gemini-image.test.ts
// Tests for GeminiImageService via /api/gemini proxy
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { GeminiImageService } from '../gemini-image';

describe('GeminiImageService (proxy)', () => {
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

  describe('proxy endpoint', () => {
    it('should call /api/gemini proxy', async () => {
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

      await service.generateImageRaw('test prompt');

      expect(fetchSpy).toHaveBeenCalledOnce();
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe('/api/gemini');
    });

    it('should send prompt in request body', async () => {
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

      await service.generateImageRaw('a cute robot');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.prompt).toBe('a cute robot');
    });
  });

  describe('aspectRatio and imageSize', () => {
    it('should pass custom aspectRatio for backgrounds', async () => {
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

      await service.generateImageRaw('background scene', { aspectRatio: '9:16' });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.aspectRatio).toBe('9:16');
    });

    it('should pass custom imageSize', async () => {
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

      await service.generateImageRaw('high res', { imageSize: '2K' });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.imageSize).toBe('2K');
    });
  });

  describe('response parsing', () => {
    it('should parse generateContent response format', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [
                { text: 'Here is your image' },
                { inlineData: { mimeType: 'image/png', data: 'abc123base64' } },
              ],
            },
          }],
        }),
      });

      const result = await service.generateImageRaw('test');
      expect(result).toBe('data:image/png;base64,abc123base64');
    });

    it('should handle response with only image part', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{ inlineData: { mimeType: 'image/png', data: 'onlyimage' } }],
            },
          }],
        }),
      });

      const result = await service.generateImageRaw('test');
      expect(result).toBe('data:image/png;base64,onlyimage');
    });

    it('should throw when no image is returned', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{ text: 'I cannot generate that image' }],
            },
          }],
        }),
      });

      await expect(service.generateImageRaw('test')).rejects.toThrow('No image');
    });

    it('should throw on API error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
      });

      await expect(service.generateImageRaw('test')).rejects.toThrow('429');
    });
  });

  describe('generateImage (with style)', () => {
    it('should inject style hint into prompt', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{ inlineData: { mimeType: 'image/png', data: 'styled' } }],
            },
          }],
        }),
      });

      await service.generateImage('a cute cat', 'pixel');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.prompt).toContain('a cute cat');
      expect(body.prompt).toContain('pixel');
    });
  });
});
