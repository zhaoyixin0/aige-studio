/**
 * ConversationAgent — Natural language game creation via Claude API tool_use.
 *
 * Supports three tools:
 *   - create_game: Build a complete GameConfig from a description
 *   - modify_game: Apply changes to an existing GameConfig
 *   - suggest_enhancements: Recommend modules/styles not yet in the config
 *
 * Falls back to simple regex pattern matching when no API key is provided.
 *
 * Types, constants, and prompt definitions live in conversation-defs.ts.
 */
import { createClaudeClient } from '@/services/claude-proxy.ts';
import type { GameConfig, ModuleConfig } from '@/engine/core/index.ts';
import type { AssetEntry } from '@/engine/core/types.ts';
import { validateConfig, applyFixes, type ValidationReport } from '@/engine/core/config-validator.ts';
import { ContractRegistry } from '@/engine/core/contract-registry.ts';
import { createModuleRegistry } from '@/engine/module-setup.ts';
import { resolveInputProfile } from '@/engine/core/profiles.ts';
import { ALL_GAME_TYPES, GAME_TYPE_META, getGamePreset, getModuleParams } from './game-presets.ts';
import { runPresetToConfig, _resetRegistry as _resetPresetRegistry } from '@/engine/systems/recipe-runner/facade.ts';
import {
  generateV2CreationChips,
  generateSuggestions,
  buildSystemPrompt,
  applyConfigChanges,
} from './conversation-helpers.ts';
import {
  type ConversationMessage,
  type Chip,
  type ConversationResult,
  type ConfigChange,
  type ParameterCardPayload,
  MAX_HISTORY,
  ART_STYLES,
  GAME_TYPE_DESCRIPTIONS,
  DEFAULT_THEME,
  TOOLS,
  KEYWORD_MAP,
  detectGameTypeFromMessage,
} from './conversation-defs.ts';

// Re-export public types and functions so external consumers don't need to change imports
export type { Chip, ConversationResult, ConfigChange, ConversationMessage, ParameterCardPayload };
export { detectGameTypeFromMessage };
export { generateV2CreationChips, generateSuggestions, buildSystemPrompt, applyConfigChanges };

/* ------------------------------------------------------------------ */
/*  ConversationAgent                                                  */
/* ------------------------------------------------------------------ */

export class ConversationAgent {
  private static _contracts: ContractRegistry | null = null;
  private static get contracts(): ContractRegistry {
    if (!ConversationAgent._contracts) {
      ConversationAgent._contracts = ContractRegistry.fromRegistry(createModuleRegistry());
    }
    return ConversationAgent._contracts;
  }

  private client: ReturnType<typeof createClaudeClient>;
  private history: ConversationMessage[] = [];
  private _lastValidationReport: ValidationReport | null = null;

  /** Get the validation report from the last config generation. */
  getLastValidationReport(): ValidationReport | null {
    return this._lastValidationReport;
  }

  constructor() {
    this.client = createClaudeClient();
  }

  /** Clear conversation history to start a new session. */
  reset(): void {
    this.history = [];
  }

  /**
   * Process a user message and return a reply, optionally with a GameConfig
   * and/or enhancement chips.
   */
  async process(
    message: string,
    currentConfig?: GameConfig,
  ): Promise<ConversationResult> {
    // Deterministic preset interception — works with or without API key
    const presetResult = this.tryPresetDirect(message);
    if (presetResult) return presetResult;

    // Add user message to history
    this.history.push({ role: 'user', content: message });
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }

    // Build messages array
    const messages = this.history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Determine context for knowledge loading
    const gameType = currentConfig
      ? this.inferGameType(currentConfig)
      : detectGameTypeFromMessage(message);
    const currentModules = currentConfig
      ? currentConfig.modules.map((m) => m.type)
      : [];

    // Build enriched system prompt with dynamic knowledge
    const systemPrompt = await buildSystemPrompt(
      gameType,
      currentModules,
      currentConfig,
    );

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools: TOOLS as unknown[],
      });

      let reply = '';
      let config: GameConfig | undefined;
      let chips: Chip[] | undefined;
      let parameterCard: ParameterCardPayload | undefined;
      let expertInsight: ConversationResult['expertInsight'];
      let moduleTuning: ConversationResult['moduleTuning'];
      let presetUsed: ConversationResult['presetUsed'];
      let createdThisTurn = false;

      const content = response.content as Array<{
        type: string;
        text?: string;
        name?: string;
        input?: unknown;
      }>;
      for (const block of content) {
        if (block.type === 'text') {
          reply += block.text;
        }

        if (block.type === 'tool_use') {
          switch (block.name) {
            case 'create_game': {
              const input = block.input as {
                game_type: string;
                theme?: string;
                art_style?: string;
                duration?: number;
                input_method?: string;
                extra_modules?: string[];
                want_background?: boolean;
                asset_descriptions?: Record<string, string>;
              };
              config = this.buildGameConfig(input);
              // V2: use creation chips (board_mode + L1 params) instead of old module suggestions
              chips = generateV2CreationChips(input.game_type);
              createdThisTurn = true;
              if (!reply) {
                const desc = GAME_TYPE_DESCRIPTIONS[input.game_type] ?? input.game_type;
                reply = `已为你创建「${desc.split(' — ')[0]}」游戏！`;
              }
              // Append validation feedback
              const vReport = this._lastValidationReport;
              if (vReport) {
                if (vReport.errors.length > 0) {
                  reply += `\n\n检测到 ${vReport.errors.length} 个配置问题，请查看预览工具栏的诊断提示。`;
                } else if (vReport.fixes.length > 0) {
                  reply += `\n\n已自动修正 ${vReport.fixes.length} 项配置参数。`;
                }
              }
              break;
            }

            case 'use_preset': {
              const input = block.input as {
                preset_id: string;
                params?: Record<string, unknown>;
                game_type?: string;
              };
              try {
                const baseConfig = this.buildBaseConfigForPreset(input.game_type);
                const result = runPresetToConfig(
                  { presetId: input.preset_id, params: input.params, gameType: input.game_type },
                  baseConfig,
                );
                config = result.config;
                chips = generateV2CreationChips(input.game_type ?? 'catch');
                createdThisTurn = true;
                presetUsed = {
                  presetId: result.presetId,
                  title: result.presetId,
                  pendingAssets: result.pendingAssets.length,
                };
                if (!reply) {
                  reply = `已使用模板「${result.presetId}」创建游戏`;
                  if (result.pendingAssets.length > 0) {
                    reply += `，${result.pendingAssets.length} 个素材待生成`;
                  }
                  reply += '！';
                }
              } catch {
                if (!reply) {
                  reply = '模板加载失败，请重试或手动描述你想要的游戏';
                }
              }
              break;
            }

            case 'modify_game': {
              const input = block.input as {
                changes: Array<{
                  action: string;
                  module_type?: string;
                  theme?: string;
                  art_style?: string;
                  duration?: number;
                  param_key?: string;
                  param_value?: unknown;
                }>;
                asset_descriptions?: Record<string, string>;
              };
              if (currentConfig) {
                config = this.applyChanges(currentConfig, input.changes);
                // Apply asset_descriptions if provided (needed for style/theme changes)
                if (input.asset_descriptions && config) {
                  config = {
                    ...config,
                    meta: {
                      ...config.meta,
                      assetDescriptions: input.asset_descriptions,
                    },
                  };
                }
                if (!reply) {
                  reply = `已完成修改！共应用了 ${input.changes.length} 项更改。`;
                }
              } else {
                if (!reply) {
                  reply = '当前没有游戏配置可以修改，请先创建一个游戏。';
                }
              }
              break;
            }

            case 'suggest_enhancements': {
              // Skip if create_game already produced V2 chips this turn
              if (createdThisTurn) break;
              const input = block.input as {
                current_modules: string[];
                game_type: string;
              };
              chips = generateSuggestions(input.current_modules, input.game_type);
              if (!reply) {
                reply = '以下是一些增强建议，点击即可添加：';
              }
              break;
            }

            case 'push_parameter_card': {
              const input = block.input as {
                category: string;
                param_ids: string[];
                title?: string;
              };
              parameterCard = {
                category: input.category,
                paramIds: input.param_ids,
                ...(input.title ? { title: input.title } : {}),
              };
              if (!reply) {
                reply = '请通过下方的参数卡片进行调整：';
              }
              break;
            }

            case 'push_expert_insight': {
              const input = block.input as {
                title?: string;
                body?: string;
                modules?: Array<{
                  name: string;
                  params: Array<{ name: string; value: unknown }>;
                }>;
              };
              const safeTitle = String(input?.title ?? '').trim();
              if (safeTitle) {
                if (typeof input?.body === 'string' && input.body.trim().length > 0) {
                  expertInsight = { title: safeTitle, body: input.body.trim() };
                }
                if (Array.isArray(input?.modules) && input.modules.length > 0) {
                  moduleTuning = {
                    title: safeTitle,
                    modules: input.modules.map((m) => ({
                      name: String(m?.name ?? ''),
                      params: Array.isArray(m?.params)
                        ? m.params.map((p) => ({
                            name: String(p?.name ?? ''),
                            value: typeof p?.value === 'string' && p.value.trim() !== '' && !isNaN(Number(p.value))
                              ? Number(p.value)
                              : (p?.value as string | number),
                          }))
                        : [],
                    })),
                  };
                }
                if (!reply) {
                  reply = '以下是专家调参建议：';
                }
              }
              break;
            }
          }
        }
      }

      // If we got no reply at all (edge case), provide a fallback
      if (!reply && !config) {
        reply = '请描述你想要创建的游戏，我来帮你实现。';
      }

      // Store only text in history — system prompt provides current config context,
      // so Claude always knows the current state without needing tool_use/tool_result blocks.
      // This avoids incomplete tool loops and keeps the conversation type-safe.
      if (reply) {
        this.history.push({ role: 'assistant', content: reply });
      }

      // Determine if we still need more info
      const needsMoreInfo = !config && !chips && !parameterCard;

      return { reply, config, chips, needsMoreInfo, parameterCard, expertInsight, moduleTuning, presetUsed };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        ...this.processWithoutApi(message),
        reply: `API 调用失败：${errMsg}。正在使用本地模式...`,
      };
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Private: build GameConfig from create_game tool params           */
  /* ---------------------------------------------------------------- */

  private buildGameConfig(params: {
    game_type: string;
    theme?: string;
    art_style?: string;
    duration?: number;
    input_method?: string;
    extra_modules?: string[];
    want_background?: boolean;
    asset_descriptions?: Record<string, string>;
  }): GameConfig {
    const gameType = ALL_GAME_TYPES.includes(params.game_type as any)
      ? params.game_type
      : 'catch';

    const preset = getGamePreset(gameType);
    const modules: ModuleConfig[] = [];
    const typeCounts = new Map<string, number>();

    const addModule = (type: string) => {
      // Skip duplicates
      if (modules.some((m) => m.type === type)) return;
      const count = (typeCounts.get(type) ?? 0) + 1;
      typeCounts.set(type, count);
      modules.push({
        id: `${type.toLowerCase()}_${count}`,
        type,
        enabled: true,
        params: getModuleParams(gameType, type),
      });
    };

    // Input modules from preset — only add ONE (default: TouchInput)
    const INPUT_TYPES = new Set(['FaceInput', 'HandInput', 'BodyInput', 'TouchInput', 'DeviceInput', 'AudioInput']);

    // Add all non-input modules from the preset, plus one input module
    if (preset) {
      for (const moduleType of Object.keys(preset)) {
        if (INPUT_TYPES.has(moduleType)) continue; // skip — we'll add one below
        addModule(moduleType);
      }
    } else {
      addModule('GameFlow');
      addModule('UIOverlay');
      addModule('ResultScreen');
    }

    // Add exactly one input module (default TouchInput for mobile games)
    const inputMethod = params.input_method ?? 'TouchInput';
    addModule(inputMethod);

    // Add any extra modules requested by the LLM
    if (params.extra_modules) {
      for (const modType of params.extra_modules) {
        addModule(modType);
      }
    }

    // Override timer duration if specified (immutable — no mutation)
    const duration = params.duration ?? 30;
    let finalModules = modules;
    if (duration > 0) {
      const hasTimer = modules.some((m) => m.type === 'Timer');
      if (hasTimer) {
        finalModules = modules.map((m) =>
          m.type === 'Timer' ? { ...m, params: { ...m.params, duration } } : m,
        );
      } else {
        const count = (typeCounts.get('Timer') ?? 0) + 1;
        finalModules = [
          ...modules,
          {
            id: `timer_${count}`,
            type: 'Timer',
            enabled: true,
            params: { ...getModuleParams(gameType, 'Timer'), duration },
          },
        ];
      }
    }

    // Resolve theme — allow custom themes (AI will generate matching assets)
    const themeId = params.theme ?? DEFAULT_THEME[gameType] ?? 'fruit';

    // Resolve art style
    const artStyle = params.art_style && ART_STYLES.includes(params.art_style as any)
      ? params.art_style
      : 'cartoon';

    // Build assets — include background flag if requested
    const assets: Record<string, AssetEntry> = {};
    if (params.want_background) {
      assets['background'] = { type: 'background', src: '' };
    }

    // Resolve InputProfile: ensure PlayerMovement has correct continuousEvent
    const inputProfile = resolveInputProfile(inputMethod, gameType);
    finalModules = finalModules.map((m) => {
      if (m.type !== 'PlayerMovement') return m;
      const pmParams = { ...m.params };
      // Only set continuousEvent if not already explicitly specified
      if (!pmParams.continuousEvent && inputProfile.continuousEvent) {
        pmParams.continuousEvent = inputProfile.continuousEvent;
      }
      if (pmParams.mode === undefined) {
        pmParams.mode = inputProfile.mode;
      }
      if (pmParams.defaultY === undefined && inputProfile.defaultY !== undefined) {
        pmParams.defaultY = inputProfile.defaultY;
      }
      return { ...m, params: pmParams };
    });

    const desc = GAME_TYPE_DESCRIPTIONS[gameType] ?? gameType;
    const config: GameConfig = {
      version: '1.0.0',
      meta: {
        name: desc.split(' — ')[0] + '游戏',
        description: desc.split(' — ')[1] ?? '',
        thumbnail: null,
        createdAt: new Date().toISOString(),
        theme: themeId,
        artStyle,
        ...(params.asset_descriptions ? { assetDescriptions: params.asset_descriptions } : {}),
      },
      canvas: { width: 1080, height: 1920 },
      modules: finalModules,
      assets,
    };

    // Run pre-load validation and apply auto-fixes (immutable)
    const report = validateConfig(config, ConversationAgent.contracts);
    this._lastValidationReport = report;

    return report.fixes.length > 0 ? applyFixes(config, report.fixes) : config;
  }

  private buildBaseConfigForPreset(gameType?: string): GameConfig {
    const themeId = DEFAULT_THEME[gameType ?? 'catch'] ?? 'fruit';
    return {
      version: '1.0.0',
      meta: {
        name: '',
        description: '',
        thumbnail: null,
        createdAt: new Date().toISOString(),
        theme: themeId,
        artStyle: 'cartoon',
      },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    };
  }

  private applyChanges(
    config: GameConfig,
    changes: ConfigChange[],
  ): GameConfig {
    const updated = applyConfigChanges(config, changes, (c) => this.inferGameType(c));
    // Post-change validation to keep parity with create_game path
    const report = validateConfig(updated, ConversationAgent.contracts);
    this._lastValidationReport = report;
    return report.fixes.length > 0 ? applyFixes(updated, report.fixes) : updated;
  }

  /* ---------------------------------------------------------------- */
  /*  Private: regex fallback when no API key is available              */
  /* ---------------------------------------------------------------- */

  private processWithoutApi(message: string): ConversationResult {
    // Try to detect game type from message
    let detectedType: string | null = null;
    for (const { pattern, gameType } of KEYWORD_MAP) {
      if (pattern.test(message)) {
        detectedType = gameType;
        break;
      }
    }

    if (detectedType) {
      const config = this.buildGameConfig({ game_type: detectedType });
      // V2: use creation chips (board_mode + L1 params) instead of old module suggestions
      const chips = generateV2CreationChips(detectedType);
      const desc = GAME_TYPE_DESCRIPTIONS[detectedType] ?? detectedType;

      return {
        reply: `已为你创建「${desc.split(' — ')[0]}」游戏！（本地模式）`,
        config,
        chips,
      };
    }

    // Could not detect — return chips for game type selection
    return {
      reply: '没有检测到具体游戏类型，请选择一种游戏类型开始创建：',
      chips: this.getGameTypeChips(),
      needsMoreInfo: true,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Private: deterministic preset interception                       */
  /* ---------------------------------------------------------------- */

  private tryPresetDirect(message: string): ConversationResult | null {
    const match =
      message.trim().match(/^(?:使用|用|采用|应用)\s*模板\s+(\S+)/i) ??
      message.trim().match(/^use\s+(?:preset|template)\s+(\S+)/i);
    if (!match) return null;

    const presetId = match[1];
    try {
      const base = this.buildBaseConfigForPreset();
      const result = runPresetToConfig({ presetId }, base);
      const gt = this.inferGameType(result.config);
      const chips = generateV2CreationChips(gt);
      return {
        reply: `已使用模板「${result.presetId}」创建游戏${result.pendingAssets.length > 0 ? `，${result.pendingAssets.length} 个素材待生成` : ''}！`,
        config: result.config,
        chips,
        presetUsed: {
          presetId: result.presetId,
          title: result.presetId,
          pendingAssets: result.pendingAssets.length,
        },
      };
    } catch {
      return {
        reply: `模板「${presetId}」加载失败，请重试或手动描述你想要的游戏。`,
        chips: this.getGameTypeChips(),
        needsMoreInfo: true,
      };
    }
  }

  private getGameTypeChips(): Chip[] {
    return ALL_GAME_TYPES
      .filter((id) => GAME_TYPE_META[id].supportedToday !== false)
      .slice(0, 12)
      .map((id) => ({
        id,
        label: GAME_TYPE_META[id].displayName,
        emoji: GAME_TYPE_META[id].emoji,
        type: 'game_type' as const,
      }));
  }

  /* ---------------------------------------------------------------- */
  /*  Private: infer game type from existing config                    */
  /* ---------------------------------------------------------------- */

  private inferGameType(config: GameConfig): string {
    const moduleTypes = new Set(config.modules.map((m) => m.type));

    // Specialized modules first (most specific → least specific)
    if (moduleTypes.has('Runner'))               return 'runner';
    if (moduleTypes.has('QuizEngine'))            return 'quiz';
    if (moduleTypes.has('Randomizer'))            return 'random-wheel';
    if (moduleTypes.has('ExpressionDetector'))    return 'expression';
    if (moduleTypes.has('GestureMatch'))          return 'gesture';
    if (moduleTypes.has('BeatMap'))               return 'rhythm';
    if (moduleTypes.has('MatchEngine'))           return 'puzzle';
    if (moduleTypes.has('DressUpEngine'))         return 'dress-up';
    if (moduleTypes.has('BranchStateMachine'))    return 'narrative';
    if (moduleTypes.has('PlaneDetection'))        return 'world-ar';

    // Shooter/RPG detection (before platformer — all three use PlayerMovement)
    if (moduleTypes.has('LevelUp') && moduleTypes.has('EnemyAI'))  return 'action-rpg';
    if (moduleTypes.has('Projectile') && moduleTypes.has('EnemyAI')) return 'shooting';
    if (moduleTypes.has('WaveSpawner'))           return 'shooting';

    // Platformer (has PlayerMovement but no shooter modules)
    if (moduleTypes.has('PlayerMovement') && moduleTypes.has('StaticPlatform')) return 'platformer';

    // Heuristic for catch vs dodge vs tap
    if (moduleTypes.has('Spawner') && moduleTypes.has('Collision')) {
      if (moduleTypes.has('Lives') && !moduleTypes.has('Scorer')) return 'dodge';
      return 'catch';
    }
    if (moduleTypes.has('Spawner')) return 'tap';

    return 'catch'; // ultimate fallback
  }
}
