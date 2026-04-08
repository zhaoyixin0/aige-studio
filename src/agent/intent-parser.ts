import { createClaudeClient } from '@/services/claude-proxy.ts';
import type { GameConfig } from '@/engine/core/index.ts';
import { tryLocalMatch, type LocalMatch } from './local-patterns.ts';

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

function localMatchToParsedIntent(
  match: LocalMatch,
  rawText: string,
  config: GameConfig,
): ParsedIntent {
  const module = config.modules.find((m) => m.id === match.moduleId);
  const targetModule = module?.type;

  switch (match.type) {
    case 'update_param':
      return {
        intent: 'modify_param',
        targetModule,
        targetParam: match.param,
        targetValue: match.value,
        rawText,
      };
    case 'enable_module':
      return {
        intent: 'add_module',
        targetModule,
        rawText,
      };
    case 'disable_module':
      return {
        intent: 'remove_module',
        targetModule,
        rawText,
      };
  }
}

export class IntentParser {
  private client: ReturnType<typeof createClaudeClient>;

  constructor() {
    this.client = createClaudeClient();
  }

  async parse(
    userMessage: string,
    currentConfig?: GameConfig | null,
  ): Promise<ParsedIntent> {
    if (currentConfig) {
      const localMatch = tryLocalMatch(userMessage, currentConfig);
      if (localMatch) {
        return localMatchToParsedIntent(localMatch, userMessage, currentConfig);
      }
    }

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

    type ContentBlock = { type: string; input?: unknown };
    const content = response.content as ContentBlock[];
    const toolBlock = content.find((b) => b.type === 'tool_use');
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
