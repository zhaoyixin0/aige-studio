// src/services/gemini-image.ts
// Nano Banana Pro (gemini-3-pro-image-preview) image generation service.
// Calls /api/gemini serverless proxy — API key stays server-side.

export type ImageStyle = 'cartoon' | 'pixel' | 'flat' | 'realistic' | 'watercolor' | 'chibi';

const STYLE_PROMPTS: Record<ImageStyle, string> = {
  cartoon: 'Cartoon/toon style with bold outlines and vibrant colors.',
  pixel: 'Pixel art retro style with visible square pixels.',
  flat: 'Flat design minimalist style with solid colors and no gradients.',
  realistic: 'Semi-realistic detailed style with subtle shading.',
  watercolor: 'Watercolor painting style with soft blended edges.',
  chibi: 'Chibi / super-deformed style with oversized head and kawaii aesthetic.',
};

export interface ImageGenOptions {
  aspectRatio?: string;
  imageSize?: string;
}

export class GeminiImageService {
  async generateImage(
    prompt: string,
    style: ImageStyle = 'cartoon',
    options?: ImageGenOptions,
    signal?: AbortSignal,
  ): Promise<string> {
    const styleHint = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.cartoon;
    const fullPrompt = `Game sprite asset: ${prompt}. Simple, clean icon for a mobile game. ${styleHint}`;
    return this.callAPI(fullPrompt, options, signal);
  }

  async generateImageRaw(
    prompt: string,
    options?: ImageGenOptions,
    signal?: AbortSignal,
  ): Promise<string> {
    return this.callAPI(prompt, options, signal);
  }

  private async callAPI(
    promptText: string,
    options?: ImageGenOptions,
    signal?: AbortSignal,
  ): Promise<string> {
    const secret = import.meta.env.VITE_INTERNAL_API_SECRET as
      | string
      | undefined;
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-internal-secret': secret } : {}),
      },
      body: JSON.stringify({
        prompt: promptText,
        aspectRatio: options?.aspectRatio,
        imageSize: options?.imageSize,
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(
        `Imagen API error: ${response.status} — ${(err as Record<string, string>).error ?? 'unknown'}`,
      );
    }

    const data = await response.json();

    // Parse generateContent response: candidates[0].content.parts[]
    const parts = (data as Record<string, unknown[]>).candidates?.[0] as Record<string, unknown> | undefined;
    const contentParts = (parts?.content as Record<string, unknown[]>)?.parts;
    if (Array.isArray(contentParts)) {
      for (const part of contentParts) {
        const inline = (part as Record<string, Record<string, string>>).inlineData
          ?? (part as Record<string, Record<string, string>>).inline_data;
        if (inline?.data) {
          const mime = inline.mimeType ?? inline.mime_type ?? 'image/png';
          return `data:${mime};base64,${inline.data}`;
        }
      }
    }

    throw new Error('No image was returned by Imagen. Try a different description.');
  }
}

let _instance: GeminiImageService | null = null;

export function getGeminiImageService(): GeminiImageService {
  if (!_instance) {
    _instance = new GeminiImageService();
  }
  return _instance;
}
