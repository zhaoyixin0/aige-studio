const IMAGEN_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict';

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

  /**
   * Generate an image with style hints injected into the prompt.
   * Used by the manual AI generate dialog.
   */
  async generateImage(prompt: string, style: ImageStyle = 'cartoon'): Promise<string> {
    const styleHint = STYLE_PROMPTS[style];
    const fullPrompt = `Game sprite asset: ${prompt}. Simple, clean icon for a mobile game. White background. ${styleHint}`;
    return this.callImagenAPI(fullPrompt);
  }

  /**
   * Send a prompt as-is without adding style hints.
   * Used by AssetAgent with PromptBuilder's complete prompt.
   */
  async generateImageRaw(prompt: string): Promise<string> {
    return this.callImagenAPI(prompt);
  }

  /** Call Imagen 4 API */
  private async callImagenAPI(promptText: string): Promise<string> {
    const response = await fetch(`${IMAGEN_ENDPOINT}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: promptText }],
        parameters: { sampleCount: 1 },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Imagen API error: ${response.status}${errorBody ? ` — ${errorBody.slice(0, 200)}` : ''}`,
      );
    }

    const data = await response.json();
    const predictions = data.predictions as Array<{ bytesBase64Encoded: string }> | undefined;

    if (predictions && predictions.length > 0 && predictions[0].bytesBase64Encoded) {
      return `data:image/png;base64,${predictions[0].bytesBase64Encoded}`;
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
