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

export interface MessageCreateOptions {
  signal?: AbortSignal;
}

interface ClaudeProxyClient {
  messages: {
    create(
      params: MessageCreateParams,
      options?: MessageCreateOptions,
    ): Promise<Record<string, unknown>>;
  };
}

export function createClaudeClient(): ClaudeProxyClient {
  return {
    messages: {
      async create(params: MessageCreateParams, options?: MessageCreateOptions) {
        const secret = import.meta.env.VITE_INTERNAL_API_SECRET as
          | string
          | undefined;
        const res = await fetch('/api/claude', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(secret ? { 'x-internal-secret': secret } : {}),
          },
          body: JSON.stringify(params),
          signal: options?.signal,
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
