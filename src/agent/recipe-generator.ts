import { createClaudeClient } from '@/services/claude-proxy.ts';
import type { GameConfig } from '@/engine/core/index.ts';
import type { ParsedIntent } from './intent-parser.ts';

export interface RecipeResult {
  config: GameConfig;
  message: string;
}

export class RecipeGenerator {
  private client: ReturnType<typeof createClaudeClient>;

  constructor() {
    this.client = createClaudeClient();
  }

  async generate(
    intent: ParsedIntent,
    currentConfig: GameConfig | null,
    skills: string,
  ): Promise<RecipeResult> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are a game config generator for AIGE Studio. Generate valid GameConfig JSON.

Available module types: FaceInput, HandInput, BodyInput, TouchInput, DeviceInput, AudioInput, Spawner, Collision, Scorer, Timer, Lives, DifficultyRamp, Randomizer, QuizEngine, GameFlow, ParticleVFX, SoundFX, UIOverlay, ResultScreen.

Knowledge base:
${skills}`,
      messages: [
        {
          role: 'user',
          content: `Intent: ${intent.intent}
${intent.gameType ? `Game type: ${intent.gameType}` : ''}
${intent.targetModule ? `Target module: ${intent.targetModule}` : ''}
${intent.targetParam ? `Target param: ${intent.targetParam} = ${String(intent.targetValue)}` : ''}
User message: ${intent.rawText}
Current config: ${currentConfig ? JSON.stringify(currentConfig) : 'none'}`,
        },
      ],
      tools: [
        {
          name: 'output_game_config',
          description: 'Output the complete game configuration',
          input_schema: {
            type: 'object' as const,
            properties: {
              config: {
                type: 'object',
                description: 'Complete GameConfig object',
                properties: {
                  version: { type: 'string' },
                  meta: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      thumbnail: {},
                      createdAt: { type: 'string' },
                    },
                  },
                  canvas: {
                    type: 'object',
                    properties: {
                      width: { type: 'number' },
                      height: { type: 'number' },
                    },
                  },
                  modules: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        type: { type: 'string' },
                        enabled: { type: 'boolean' },
                        params: { type: 'object' },
                      },
                    },
                  },
                  assets: { type: 'object' },
                },
                required: ['version', 'meta', 'canvas', 'modules', 'assets'],
              },
              message: {
                type: 'string',
                description: 'Explanation message for the user (in Chinese)',
              },
            },
            required: ['config', 'message'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'output_game_config' },
    });

    type ContentBlock = { type: string; input?: unknown };
    const content = response.content as ContentBlock[];
    const toolBlock = content.find((b) => b.type === 'tool_use');
    if (toolBlock && toolBlock.type === 'tool_use') {
      const input = toolBlock.input as { config: GameConfig; message: string };
      return { config: input.config, message: input.message };
    }

    throw new Error('RecipeGenerator: no tool use in response');
  }
}
