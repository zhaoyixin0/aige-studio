// src/services/gemini-image.ts
// Nano Banana Pro (gemini-3-pro-image-preview) image generation service.

const NANO_BANANA_PRO_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';

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
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate an image with style hints injected into the prompt.
   * Used by the manual AI generate dialog.
   */
  async generateImage(prompt: string, style: ImageStyle = 'cartoon', options?: ImageGenOptions): Promise<string> {
    const styleHint = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.cartoon;
    const fullPrompt = `Game sprite asset: ${prompt}. Simple, clean icon for a mobile game. ${styleHint}`;
    return this.callAPI(fullPrompt, options);
  }

  /**
   * Send a prompt as-is without adding style hints.
   * Used by AssetAgent with PromptBuilder's complete prompt.
   */
  async generateImageRaw(prompt: string, options?: ImageGenOptions): Promise<string> {
    return this.callAPI(prompt, options);
  }

  /** Call Nano Banana Pro generateContent API */
  private async callAPI(promptText: string, options?: ImageGenOptions): Promise<string> {
    const aspectRatio = options?.aspectRatio ?? '1:1';
    const imageSize = options?.imageSize ?? '1K';

    const response = await fetch(`${NANO_BANANA_PRO_ENDPOINT}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: promptText }],
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Imagen API error: ${response.status}${errorBody ? ` — ${errorBody.slice(0, 200)}` : ''}`,
      );
    }

    const data = await response.json();

    // Parse generateContent response: candidates[0].content.parts[]
    const parts = data.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        const inline = part.inlineData ?? part.inline_data;
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
    const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!key) {
      throw new Error('VITE_GEMINI_API_KEY is not configured in .env');
    }
    _instance = new GeminiImageService(key);
  }
  return _instance;
}
