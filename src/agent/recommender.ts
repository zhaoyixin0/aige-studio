import { createClaudeClient } from '@/services/claude-proxy.ts';
import type { GameConfig } from '@/engine/core/index.ts';

export interface Suggestion {
  moduleType: string;
  reason: string;
}

export class Recommender {
  private client: ReturnType<typeof createClaudeClient>;

  constructor() {
    this.client = createClaudeClient();
  }

  async suggest(config: GameConfig, skills: string): Promise<Suggestion[]> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: `You recommend module additions for games. Current modules: ${config.modules.map((m) => m.type).join(', ')}.
Knowledge: ${skills}`,
      messages: [
        {
          role: 'user',
          content: 'What modules would enhance this game? Suggest 1-3.',
        },
      ],
      tools: [
        {
          name: 'suggest_modules',
          description: 'Suggest module additions',
          input_schema: {
            type: 'object' as const,
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    moduleType: { type: 'string' },
                    reason: {
                      type: 'string',
                      description: 'Why add this (in Chinese)',
                    },
                  },
                  required: ['moduleType', 'reason'],
                },
              },
            },
            required: ['suggestions'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'suggest_modules' },
    });

    type ContentBlock = { type: string; input?: unknown };
    const content = response.content as ContentBlock[];
    const toolBlock = content.find((b) => b.type === 'tool_use');
    if (toolBlock && toolBlock.type === 'tool_use') {
      return (toolBlock.input as { suggestions: Suggestion[] }).suggestions;
    }
    return [];
  }
}
