// src/services/__tests__/gemini-image.test.ts
// TDD RED: Tests for Nano Banana Pro API upgrade
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the class directly; constructor takes an API key
import { GeminiImageService } from '../gemini-image';

describe('GeminiImageService (Nano Banana Pro)', () => {
  let service: GeminiImageService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new GeminiImageService('test-api-key');
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API endpoint', () => {
    it('should call Nano Banana Pro generateContent endpoint', async () => {
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
      expect(url).toContain('gemini-3-pro-image-preview');
      expect(url).toContain('generateContent');
      expect(url).not.toContain('imagen-4.0');
      expect(url).not.toContain(':predict');
    });
  });

  describe('request format', () => {
    it('should use generateContent body format with contents array', async () => {
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
      // New format: contents array
      expect(body.contents).toBeDefined();
      expect(body.contents[0].parts[0].text).toBe('a cute robot');
      // Should NOT have old format
      expect(body.instances).toBeUndefined();
      expect(body.parameters).toBeUndefined();
    });

    it('should include responseModalities IMAGE in generationConfig', async () => {
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

      await service.generateImageRaw('test');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.generationConfig).toBeDefined();
      expect(body.generationConfig.responseModalities).toContain('IMAGE');
    });
  });

  describe('aspectRatio and imageSize', () => {
    it('should default to 1:1 aspectRatio and 1K imageSize', async () => {
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

      await service.generateImageRaw('test');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.generationConfig.imageConfig.aspectRatio).toBe('1:1');
      expect(body.generationConfig.imageConfig.imageSize).toBe('1K');
    });

    it('should accept custom aspectRatio for backgrounds', async () => {
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

      await service.generateImageRaw('background scene', {
        aspectRatio: '9:16',
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.generationConfig.imageConfig.aspectRatio).toBe('9:16');
    });

    it('should accept custom imageSize', async () => {
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
      expect(body.generationConfig.imageConfig.imageSize).toBe('2K');
    });
  });

  describe('response parsing', () => {
    it('should parse new generateContent response format', async () => {
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

    it('should handle response with only image part (no text)', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [
                { inlineData: { mimeType: 'image/png', data: 'onlyimage' } },
              ],
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

    it('should throw on API error with status', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded'),
      });

      await expect(service.generateImageRaw('test')).rejects.toThrow('429');
    });
  });

  describe('generateImage (with style)', () => {
    it('should inject style hint and pass options', async () => {
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
      const promptText = body.contents[0].parts[0].text;
      expect(promptText).toContain('a cute cat');
      expect(promptText).toContain('pixel');
    });
  });
});
