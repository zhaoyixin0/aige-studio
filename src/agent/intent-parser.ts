import Anthropic from '@anthropic-ai/sdk';
import type { GameConfig } from '@/engine/core/index.ts';

export type IntentType =
  | 'create_game'
  | 'add_module'
  | 'modify_param'
  | 'remove_module'
  | 'ask_question';

export interface ParsedIntent {
  intent: IntentType;
  gameType?: string;
  targetModule?: string;
  targetParam?: string;
  targetValue?: unknown;
  question?: string;
  rawText: string;
}

export class IntentParser {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  async parse(
    userMessage: string,
    currentConfig?: GameConfig | null,
  ): Promise<ParsedIntent> {
    const configSummary = currentConfig
      ? `Current game: "${currentConfig.meta.name}", modules: ${currentConfig.modules.map((m) => m.type).join(', ')}`
      : 'No game loaded yet.';

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: `You are an intent classifier for a game creation tool. Classify the user's message into one of these intents. Current context: ${configSummary}`,
      messages: [{ role: 'user', content: userMessage }],
      tools: [
        {
          name: 'classify_intent',
          description: 'Classify user intent for game creation',
          input_schema: {
            type: 'object' as const,
            properties: {
              intent: {
                type: 'string',
                enum: [
                  'create_game',
                  'add_module',
                  'modify_param',
                  'remove_module',
                  'ask_question',
                ],
              },
              gameType: {
                type: 'string',
                description:
                  'Game type if creating (catch/dodge/quiz/random-wheel/tap/shooting/expression/runner/puzzle/rhythm/gesture/world-ar/dress-up/narrative)',
              },
              targetModule: {
                type: 'string',
                description: 'Module type name',
              },
              targetParam: {
                type: 'string',
                description: 'Parameter to modify',
              },
              targetValue: { description: 'Value to set' },
              question: {
                type: 'string',
                description: 'User question text',
              },
            },
            required: ['intent'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'classify_intent' },
    });

    const toolBlock = response.content.find((b) => b.type === 'tool_use');
    if (toolBlock && toolBlock.type === 'tool_use') {
      const input = toolBlock.input as Record<string, unknown>;
      return { ...input, rawText: userMessage } as ParsedIntent;
    }

    return {
      intent: 'ask_question',
      question: userMessage,
      rawText: userMessage,
    };
  }
}
