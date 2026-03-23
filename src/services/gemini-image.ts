const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

export type ImageStyle = 'cartoon' | 'pixel' | 'flat' | 'realistic';

const STYLE_PROMPTS: Record<ImageStyle, string> = {
  cartoon: 'Cartoon/toon style with bold outlines and vibrant colors.',
  pixel: 'Pixel art retro style with visible square pixels.',
  flat: 'Flat design minimalist style with solid colors and no gradients.',
  realistic: 'Semi-realistic detailed style with subtle shading.',
};

export class GeminiImageService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImage(prompt: string, style: ImageStyle = 'cartoon'): Promise<string> {
    const styleHint = STYLE_PROMPTS[style];

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Generate a game sprite asset: ${prompt}. Make it a simple, clean icon suitable for a mobile game. Transparent or solid color background. ${styleHint}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Gemini API error: ${response.status}${errorBody ? ` — ${errorBody.slice(0, 200)}` : ''}`,
      );
    }

    const data = await response.json();

    const parts: { inlineData?: { mimeType: string; data: string } }[] =
      data.candidates?.[0]?.content?.parts ?? [];

    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error('No image was returned by the model. Try a different description.');
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
