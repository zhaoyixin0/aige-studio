/**
 * Vercel Serverless Function -- Gemini Imagen API Proxy
 *
 * Frontend calls POST /api/gemini with prompt + options.
 * This function forwards to Google generativelanguage API using
 * server-side GEMINI_API_KEY. The API key is NEVER exposed to the browser.
 */

export const config = { runtime: 'nodejs20.x' };
export const maxDuration = 60;

const NANO_BANANA_PRO_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';

interface ProxyRequest {
  method: string;
  body: {
    prompt: string;
    aspectRatio?: string;
    imageSize?: string;
  };
}

interface ProxyResponse {
  status(code: number): ProxyResponse;
  json(data: unknown): ProxyResponse;
}

export default async function handler(
  req: ProxyRequest,
  res: ProxyResponse,
): Promise<ProxyResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  const { prompt, aspectRatio, imageSize } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "prompt" field' });
  }

  try {
    const response = await fetch(`${NANO_BANANA_PRO_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio ?? '1:1',
            imageSize: imageSize ?? '1K',
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return res.status(response.status).json({
        error: `Imagen API error: ${response.status}${errorBody ? ` — ${errorBody.slice(0, 200)}` : ''}`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
