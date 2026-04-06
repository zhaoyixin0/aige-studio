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
import Anthropic from '@anthropic-ai/sdk';
import type { GameConfig, ModuleConfig } from '@/engine/core/index.ts';
import type { AssetEntry } from '@/engine/core/types.ts';
import { validateConfig, applyFixes, type ValidationReport } from '@/engine/core/config-validator.ts';
import { ContractRegistry } from '@/engine/core/contract-registry.ts';
import { createModuleRegistry } from '@/engine/module-setup.ts';
import { resolveInputProfile } from '@/engine/core/profiles.ts';
import { ALL_GAME_TYPES, GAME_TYPE_META, getGamePreset, getModuleParams } from './game-presets.ts';
import { runPresetToConfig, _resetRegistry as _resetPresetRegistry } from '@/engine/systems/recipe-runner/facade.ts';
import { SkillLoader } from './skill-loader.ts';
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
  SYSTEM_PROMPT_BASE,
  TOOLS,
  KEYWORD_MAP,
  ALL_MODULE_SUGGESTIONS,
  PRIORITY_BY_CATEGORY,
  getGameCategory,
  detectGameTypeFromMessage,
  buildParameterRegistrySummary,
} from './conversation-defs.ts';

// Re-export public types and functions so external consumers don't need to change imports
export type { Chip, ConversationResult, ConfigChange, ConversationMessage, ParameterCardPayload };
export { detectGameTypeFromMessage };
// Note: generateV2CreationChips is exported via its function declaration below

/* ------------------------------------------------------------------ */
/*  Pure function: V2 creation chips (board_mode + L1 param controls)  */
/* ------------------------------------------------------------------ */

/**
 * Generate V2-style creation chips shown after create_game.
 * Returns 1 board_mode chip + 3 abstract L1 parameter chips.
 */
export function generateV2CreationChips(_gameType: string): Chip[] {
  return [
    { id: 'board_mode', type: 'board_mode', label: 'GUI 面板', emoji: '\u{1F39B}\uFE0F' },
    { id: 'l1-difficulty', type: 'param', label: '调整难度', emoji: '\u{1F39A}\uFE0F', paramId: 'l1_001', category: 'abstract' },
    { id: 'l1-pacing', type: 'param', label: '调整节奏', emoji: '\u23F1\uFE0F', paramId: 'l1_002', category: 'abstract' },
    { id: 'l1-emotion', type: 'param', label: '切换风格', emoji: '\u{1F3A8}', paramId: 'l1_003', category: 'abstract' },
  ];
}

/* ------------------------------------------------------------------ */
/*  Pure function: generate suggestion chips (game-type-aware)         */
/* ------------------------------------------------------------------ */

/**
 * Generate suggestion chips for a given set of current modules and game type.
 * Returns up to 8 chips: prioritized module suggestions + theme + style.
 * @deprecated Kept for backward compatibility — use generateV2CreationChips after create_game.
 */
export function generateSuggestions(currentModules: string[], gameType: string): Chip[] {
  const chips: Chip[] = [];
  const currentSet = new Set(currentModules);

  // Build ordered candidate list: priority modules first, then remaining
  const category = getGameCategory(gameType);
  const priorityList = PRIORITY_BY_CATEGORY[category] ?? PRIORITY_BY_CATEGORY['simple'];
  const seen = new Set<string>();

  const orderedCandidates: string[] = [];
  for (const mod of priorityList) {
    if (!seen.has(mod)) {
      orderedCandidates.push(mod);
      seen.add(mod);
    }
  }
  for (const mod of Object.keys(ALL_MODULE_SUGGESTIONS)) {
    if (!seen.has(mod)) {
      orderedCandidates.push(mod);
      seen.add(mod);
    }
  }

  // Pick up to 5 module suggestions (not already in config)
  for (const modType of orderedCandidates) {
    if (chips.length >= 5) break;
    if (currentSet.has(modType)) continue;
    const info = ALL_MODULE_SUGGESTIONS[modType];
    if (info) {
      chips.push({ id: `add:${modType}`, label: info.label, emoji: info.emoji });
    }
  }

  // Theme change suggestions (up to 2)
  const THEME_LABELS: Record<string, { label: string; emoji: string }> = {
    fruit:     { label: '水果派对', emoji: '\u{1F34E}' },
    space:     { label: '太空冒险', emoji: '\u{1F680}' },
    ocean:     { label: '海洋探索', emoji: '\u{1F30A}' },
    halloween: { label: '万圣节', emoji: '\u{1F383}' },
    candy:     { label: '糖果世界', emoji: '\u{1F36C}' },
  };
  let themeCount = 0;
  for (const [tid, info] of Object.entries(THEME_LABELS)) {
    if (themeCount >= 2) break;
    chips.push({ id: `theme:${tid}`, label: `换${info.label}主题`, emoji: info.emoji });
    themeCount++;
  }

  // Art style suggestion (1)
  if (chips.length < 8) {
    chips.push({ id: 'style:pixel', label: '换像素风', emoji: '\u{1F579}' });
  }

  // Cap at 8
  return chips.slice(0, 8);
}

/* ------------------------------------------------------------------ */
/*  Async: build enriched system prompt with dynamic knowledge         */
/* ------------------------------------------------------------------ */

const defaultSkillLoader = new SkillLoader();

export async function buildSystemPrompt(
  gameType: string | null,
  currentModules: string[],
  currentConfig?: GameConfig,
  loader: SkillLoader = defaultSkillLoader,
): Promise<string> {
  let prompt = SYSTEM_PROMPT_BASE;

  // Inject parameter registry summary for push_parameter_card grounding
  prompt += `\n\n${buildParameterRegistrySummary()}`;

  // Load contextual knowledge from skill files
  try {
    const knowledge = await loader.loadForConversation(
      gameType,
      currentModules,
    );
    if (knowledge) {
      prompt += `\n\n## 详细游戏知识（请严格遵循）\n${knowledge}`;
    }
  } catch (error: unknown) {
    // Graceful degradation for missing knowledge files only
    if (!(error instanceof Error && error.message.startsWith('Skill not found'))) {
      throw error;
    }
  }

  // Inject expert card data for selected game type
  if (gameType) {
    try {
      const expertBlock = await loader.loadExpertCardRich(gameType);
      if (expertBlock) {
        prompt += `\n\n## 专家数据参考\n${expertBlock}`;
        prompt += '\n\n**策略**: 创建游戏后，如有高置信度参数建议，使用 push_expert_insight 工具推送（不要长段落解释）。仅在重大优化建议时引用专家数据。';
      }
    } catch {
      // Graceful degradation if card loading fails
    }

    // Inject relevant recipe card summaries
    try {
      const recipeLines = await loader.loadRecipeCardSummaries(gameType, 3);
      if (recipeLines.length > 0) {
        prompt += '\n\n## 相关配方参考\n' + recipeLines.join('\n');
        prompt += '\n\n当用户询问"怎么做"时，参考以上配方；使用 push_expert_insight 推送建议。';
      }
    } catch {
      // Graceful degradation if recipe loading fails
    }
  }

  // Append current config context
  if (currentConfig) {
    const moduleTypes = currentConfig.modules.map((m) => m.type);
    prompt += `\n\n## 当前游戏配置
- 名称: ${currentConfig.meta.name}
- 主题: ${currentConfig.meta.theme ?? '未设置'}
- 画风: ${currentConfig.meta.artStyle ?? '未设置'}
- 模块: ${moduleTypes.join(', ')}
- 画布: ${currentConfig.canvas.width}x${currentConfig.canvas.height}`;
  }

  return prompt;
}

/* ------------------------------------------------------------------ */
/*  Pure function: apply config changes (immutable)                    */
/* ------------------------------------------------------------------ */

export function applyConfigChanges(
  config: GameConfig,
  changes: ConfigChange[],
  inferGameType?: (config: GameConfig) => string,
): GameConfig {
  // Deep clone for safety, then fold each change into a new config
  const base: GameConfig = JSON.parse(JSON.stringify(config));
  return changes.reduce(
    (cfg, change) => applySingleChange(cfg, change, inferGameType),
    base,
  );
}

function clearAssetSources(
  assets: Record<string, AssetEntry>,
): Record<string, AssetEntry> {
  return Object.fromEntries(
    Object.entries(assets).map(([k, v]) => [k, { ...v, src: '' }]),
  );
}

function applySingleChange(
  config: GameConfig,
  change: ConfigChange,
  inferGameType?: (config: GameConfig) => string,
): GameConfig {
  switch (change.action) {
    case 'add_module': {
      if (!change.module_type || config.modules.some((m) => m.type === change.module_type)) {
        return config;
      }
      const gameType = inferGameType?.(config) ?? 'catch';
      const count = config.modules.filter((m) => m.type === change.module_type).length + 1;
      return {
        ...config,
        modules: [
          ...config.modules,
          {
            id: `${change.module_type.toLowerCase()}_${count}`,
            type: change.module_type,
            enabled: true,
            params: getModuleParams(gameType, change.module_type),
          },
        ],
      };
    }

    case 'remove_module':
      return change.module_type
        ? { ...config, modules: config.modules.filter((m) => m.type !== change.module_type) }
        : config;

    case 'set_theme':
      return change.theme
        ? {
            ...config,
            meta: { ...config.meta, theme: change.theme },
            assets: clearAssetSources(config.assets),
          }
        : config;

    case 'set_art_style':
      return change.art_style
        ? {
            ...config,
            meta: { ...config.meta, artStyle: change.art_style },
            assets: clearAssetSources(config.assets),
          }
        : config;

    case 'set_duration':
      return change.duration !== undefined
        ? {
            ...config,
            modules: config.modules.map((m) =>
              m.type === 'Timer'
                ? { ...m, params: { ...m.params, duration: change.duration } }
                : m,
            ),
          }
        : config;

    case 'set_param':
      return change.module_type && change.param_key !== undefined
        ? {
            ...config,
            modules: config.modules.map((m) =>
              m.type === change.module_type
                ? { ...m, params: { ...m.params, [change.param_key!]: change.param_value } }
                : m,
            ),
          }
        : config;

    default:
      return config;
  }
}

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

  private client: Anthropic | null;
  private history: ConversationMessage[] = [];
  private _lastValidationReport: ValidationReport | null = null;

  /** Get the validation report from the last config generation. */
  getLastValidationReport(): ValidationReport | null {
    return this._lastValidationReport;
  }

  constructor(apiKey?: string) {
    this.client = apiKey
      ? new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
      : null;
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
    // No API key — fall back to pattern matching
    if (!this.client) {
      return this.processWithoutApi(message);
    }

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
        tools: TOOLS,
      });

      let reply = '';
      let config: GameConfig | undefined;
      let chips: Chip[] | undefined;
      let parameterCard: ParameterCardPayload | undefined;
      let expertInsight: ConversationResult['expertInsight'];
      let moduleTuning: ConversationResult['moduleTuning'];
      let presetUsed: ConversationResult['presetUsed'];
      let createdThisTurn = false;

      for (const block of response.content) {
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

    // Could not detect — return chips for game type selection (V2: type field)
    // Show up to 12 supported types from GAME_TYPE_META
    const typeChips: Chip[] = ALL_GAME_TYPES
      .filter((id) => GAME_TYPE_META[id].supportedToday !== false)
      .slice(0, 12)
      .map((id) => ({
        id,
        label: GAME_TYPE_META[id].displayName,
        emoji: GAME_TYPE_META[id].emoji,
        type: 'game_type' as const,
      }));

    return {
      reply: '没有检测到具体游戏类型，请选择一种游戏类型开始创建：',
      chips: typeChips,
      needsMoreInfo: true,
    };
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
