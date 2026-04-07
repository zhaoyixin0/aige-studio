/**
 * Vercel Serverless Function -- Anthropic Messages API Proxy
 *
 * Frontend calls POST /api/claude with Messages API params.
 * This function forwards to Anthropic using the server-side ANTHROPIC_API_KEY.
 * The API key is NEVER exposed to the browser.
 */
import Anthropic from '@anthropic-ai/sdk';

interface ProxyRequest {
  method: string;
  body: {
    model: string;
    max_tokens: number;
    system: string;
    messages: Array<{ role: string; content: unknown }>;
    tools?: unknown[];
    tool_choice?: unknown;
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
  }

  // Validate required fields before forwarding to Anthropic
  const { model, max_tokens, system, messages, tools, tool_choice } = req.body ?? {};
  if (!model || typeof model !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "model" field' });
  }
  if (!max_tokens || typeof max_tokens !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid "max_tokens" field' });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing or empty "messages" array' });
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model,
      max_tokens,
      system: typeof system === 'string' ? system : '',
      messages: messages as Anthropic.MessageCreateParams['messages'],
      ...(tools ? { tools: tools as Anthropic.MessageCreateParams['tools'] } : {}),
      ...(tool_choice ? { tool_choice: tool_choice as Anthropic.MessageCreateParams['tool_choice'] } : {}),
    });

    return res.status(200).json(response);
  } catch (error: unknown) {
    const status = (error as Record<string, unknown>)?.status as number | undefined ?? 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(status).json({ error: message });
  }
}
