/**
 * Browser-side proxy client for Anthropic Messages API.
 * Drop-in replacement for Anthropic SDK -- calls /api/claude serverless proxy.
 * Avoids browser-direct API calls that trigger Anthropic's CORS 403.
 */

interface MessageCreateParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: string; content: unknown }>;
  tools?: unknown[];
  tool_choice?: unknown;
}

interface ClaudeProxyClient {
  messages: {
    create(params: MessageCreateParams): Promise<Record<string, unknown>>;
  };
}

export function createClaudeClient(): ClaudeProxyClient {
  return {
    messages: {
      async create(params: MessageCreateParams) {
        const res = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(`${res.status} ${JSON.stringify(err)}`);
        }

        return res.json();
      },
    },
  };
}
