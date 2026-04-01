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
import { resolveInputProfile } from '@/engine/core/profiles.ts';
import { ALL_GAME_TYPES, getGamePreset, getModuleParams } from './game-presets.ts';
import { SkillLoader } from './skill-loader.ts';
import {
  type ConversationMessage,
  type Chip,
  type ConversationResult,
  type ConfigChange,
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
} from './conversation-defs.ts';

// Re-export public types and functions so external consumers don't need to change imports
export type { Chip, ConversationResult, ConfigChange, ConversationMessage };
export { detectGameTypeFromMessage };

/* ------------------------------------------------------------------ */
/*  Pure function: generate suggestion chips (game-type-aware)         */
/* ------------------------------------------------------------------ */

/**
 * Generate suggestion chips for a given set of current modules and game type.
 * Returns up to 8 chips: prioritized module suggestions + theme + style.
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
              // Auto-generate suggestions for the newly created game
              const moduleTypes = config.modules.map((m) => m.type);
              chips = generateSuggestions(moduleTypes, input.game_type);
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
      const needsMoreInfo = !config && !chips;

      return { reply, config, chips, needsMoreInfo };
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
    const report = validateConfig(config);
    this._lastValidationReport = report;

    return report.fixes.length > 0 ? applyFixes(config, report.fixes) : config;
  }

  private applyChanges(
    config: GameConfig,
    changes: ConfigChange[],
  ): GameConfig {
    return applyConfigChanges(config, changes, (c) => this.inferGameType(c));
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
      const moduleTypes = config.modules.map((m) => m.type);
      const chips = generateSuggestions(moduleTypes, detectedType);
      const desc = GAME_TYPE_DESCRIPTIONS[detectedType] ?? detectedType;

      return {
        reply: `已为你创建「${desc.split(' — ')[0]}」游戏！（本地模式）`,
        config,
        chips,
      };
    }

    // Could not detect — return chips for game type selection
    const typeChips: Chip[] = [
      { id: 'type:catch', label: '接住类', emoji: '\u{1F3AF}' },
      { id: 'type:dodge', label: '躲避类', emoji: '\u{1F3C3}' },
      { id: 'type:platformer', label: '平台跳跃', emoji: '\u{1F3AE}' },
      { id: 'type:runner', label: '跑酷', emoji: '\u{1F3C3}\u200D\u2642\uFE0F' },
      { id: 'type:shooting', label: '射击', emoji: '\u{1F52B}' },
      { id: 'type:rhythm', label: '节奏', emoji: '\u{1F3B5}' },
      { id: 'type:quiz', label: '答题', emoji: '\u2753' },
      { id: 'type:puzzle', label: '配对', emoji: '\u{1F9E9}' },
    ];

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
