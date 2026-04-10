/**
 * Vercel Serverless Function -- Gemini Imagen API Proxy
 *
 * Frontend calls POST /api/gemini with prompt + options.
 * This function forwards to Google generativelanguage API using
 * server-side GEMINI_API_KEY. The API key is NEVER exposed to the browser.
 */

export const maxDuration = 60;

const NANO_BANANA_PRO_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';

interface ProxyRequest {
  method: string;
  headers: Record<string, string | undefined>;
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

const MAX_BODY_BYTES = 100_000;

export default async function handler(
  req: ProxyRequest,
  res: ProxyResponse,
): Promise<ProxyResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // H7: Internal secret header authentication (skip when env var not set)
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret && req.headers['x-internal-secret'] !== internalSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // H7: Body size limit
  const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Request too large' });
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
