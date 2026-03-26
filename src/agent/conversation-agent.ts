/**
 * ConversationAgent — Natural language game creation via Claude API tool_use.
 *
 * Supports three tools:
 *   - create_game: Build a complete GameConfig from a description
 *   - modify_game: Apply changes to an existing GameConfig
 *   - suggest_enhancements: Recommend modules/styles not yet in the config
 *
 * Falls back to simple regex pattern matching when no API key is provided.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { GameConfig, ModuleConfig } from '@/engine/core/index.ts';
import { ALL_GAME_TYPES, getGamePreset, getModuleParams } from './game-presets.ts';

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Chip {
  id: string;
  label: string;
  emoji?: string;
}

export interface ConversationResult {
  reply: string;
  config?: GameConfig;
  chips?: Chip[];
  needsMoreInfo?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_HISTORY = 10;

const ALL_MODULES = [
  'FaceInput', 'HandInput', 'TouchInput', 'DeviceInput', 'AudioInput',
  'Spawner', 'Collision', 'Scorer', 'Timer', 'Lives', 'DifficultyRamp',
  'PlayerMovement', 'Jump', 'Gravity', 'StaticPlatform', 'MovingPlatform',
  'CrumblingPlatform', 'CoyoteTime', 'Dash', 'Collectible', 'Hazard',
  'Checkpoint', 'IFrames', 'Knockback', 'Inventory', 'WallDetect',
  'QuizEngine', 'Randomizer', 'ExpressionDetector', 'GestureMatch',
  'BeatMap', 'MatchEngine', 'Runner', 'DressUpEngine', 'BranchStateMachine',
  'PlaneDetection', 'ComboSystem', 'PowerUp',
  'GameFlow', 'CameraFollow', 'ParticleVFX', 'SoundFX', 'UIOverlay', 'ResultScreen',
];

const THEMES = ['fruit', 'space', 'ocean', 'halloween', 'candy'] as const;
const ART_STYLES = ['cartoon', 'pixel', 'flat', 'realistic', 'watercolor', 'chibi'] as const;

const GAME_TYPE_DESCRIPTIONS: Record<string, string> = {
  'catch':        '接住类 — 用头/手接住掉落物品',
  'dodge':        '躲避类 — 躲避从上方掉落的障碍物',
  'quiz':         '答题类 — 限时回答趣味问题',
  'random-wheel': '随机转盘 — 转动转盘看结果',
  'tap':          '点击类 — 点击屏幕上出现的目标',
  'shooting':     '射击类 — 瞄准并击中移动的靶子',
  'expression':   '表情挑战 — 用面部表情匹配目标',
  'runner':       '跑酷类 — 控制角色躲避障碍跑到最远',
  'gesture':      '手势互动 — 用手势匹配目标动作',
  'rhythm':       '节奏类 — 跟随节奏点击屏幕',
  'puzzle':       '拼图/配对 — 翻开卡片找到配对',
  'dress-up':     '换装/贴纸 — 给角色搭配服装和配饰',
  'world-ar':     '世界AR — 在真实环境中放置虚拟物品',
  'narrative':    '分支叙事 — 做出选择影响故事走向',
  'platformer':   '平台跳跃 — 跳跃闯关、收集金币、躲避障碍',
};

const DEFAULT_THEME: Record<string, string> = {
  catch: 'fruit', dodge: 'space', shooting: 'space', tap: 'candy',
  runner: 'ocean', quiz: 'fruit', 'random-wheel': 'candy',
  expression: 'fruit', gesture: 'fruit', rhythm: 'candy',
  puzzle: 'ocean', 'dress-up': 'candy', 'world-ar': 'space',
  narrative: 'halloween', platformer: 'fruit',
};

const SYSTEM_PROMPT = `你是 AIGE Studio 的游戏创建对话助手。用户通过自然语言描述想要的游戏，你直接创建或修改。

## 15 种游戏类型
${Object.entries(GAME_TYPE_DESCRIPTIONS).map(([id, desc]) => `- ${id}: ${desc}`).join('\n')}

## 可用模块
${ALL_MODULES.join(', ')}

## 主题
fruit（水果派对）、space（太空冒险）、ocean（海洋探索）、halloween（万圣节）、candy（糖果世界）

## 画风
cartoon（卡通）、pixel（像素）、flat（扁平）、realistic（写实）、watercolor（水彩）、chibi（Q版）

## 输入方式
TouchInput（触屏点击，默认）、FaceInput（面部追踪）、HandInput（手势控制）、DeviceInput（重力感应）、AudioInput（声音控制）

## 行为准则
- 用户描述游戏后，在创建前确认以下关键信息（可在一条消息中一起问）：
  1. 输入方式（触屏/面部/手势/重力/声音）
  2. 游戏主题（水果/太空/海洋/万圣节/糖果）
  如果用户消息中已经明确了这些信息，则不需要再问，直接创建
- 其他参数（时长、画风等）用合理默认值，不需要确认
- 最多追问 2 次，之后用默认值创建
- 当确认了游戏类型和输入方式后，你必须调用 create_game 工具来创建游戏，不要只用文字描述
- 成功创建游戏后，立即调用 suggest_enhancements 给出增强建议
- 始终用中文回复
- 回复简洁友好，不超过 3 句话`;

/* ------------------------------------------------------------------ */
/*  Tool definitions for Claude API                                    */
/* ------------------------------------------------------------------ */

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'create_game',
    description: '根据用户描述创建一个完整的游戏配置。在理解用户意图后立即调用此工具。',
    input_schema: {
      type: 'object' as const,
      properties: {
        game_type: {
          type: 'string',
          enum: [...ALL_GAME_TYPES],
          description: '游戏类型 ID',
        },
        theme: {
          type: 'string',
          description: `主题。预设主题: ${THEMES.join(', ')}。也支持自定义主题如"animal"、"dinosaur"等，AI会生成匹配的素材。`,
        },
        art_style: {
          type: 'string',
          enum: [...ART_STYLES],
          description: '画风（默认 cartoon）',
        },
        duration: {
          type: 'number',
          description: '游戏时长（秒），0 表示无限制。默认 30。',
        },
        input_method: {
          type: 'string',
          enum: ['TouchInput', 'FaceInput', 'HandInput', 'DeviceInput', 'AudioInput'],
          description: '输入方式（默认 TouchInput 触屏）',
        },
        extra_modules: {
          type: 'array',
          items: { type: 'string' },
          description: '除预设必备模块外，额外添加的模块类型列表',
        },
        want_background: {
          type: 'boolean',
          description: '是否生成 AI 背景图',
        },
        asset_descriptions: {
          type: 'object',
          description: '自定义素材描述，根据主题生成匹配的素材。key 是素材 ID（good_1, good_2, good_3, bad_1, bad_2, player, background），value 是该素材在当前主题下应该是什么的英文描述。例如动物主题：{"good_1":"a cute golden puppy","good_2":"a playful kitten","good_3":"a baby bunny","bad_1":"an angry porcupine","bad_2":"a sneaky snake","player":"a happy corgi with a basket","background":"a sunny green meadow with trees and flowers"}。必须提供，确保素材与主题匹配。',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['game_type'],
    },
  },
  {
    name: 'modify_game',
    description: '修改已有的游戏配置。支持添加/删除模块、更改主题/画风/时长等。',
    input_schema: {
      type: 'object' as const,
      properties: {
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['add_module', 'remove_module', 'set_theme', 'set_art_style', 'set_duration', 'set_param'],
                description: '修改动作',
              },
              module_type: {
                type: 'string',
                description: '模块类型（add_module/remove_module/set_param 时使用）',
              },
              theme: {
                type: 'string',
                description: '新主题（set_theme 时使用）',
              },
              art_style: {
                type: 'string',
                description: '新画风（set_art_style 时使用）',
              },
              duration: {
                type: 'number',
                description: '新时长（set_duration 时使用）',
              },
              param_key: {
                type: 'string',
                description: '参数键名（set_param 时使用）',
              },
              param_value: {
                description: '参数值（set_param 时使用）',
              },
            },
            required: ['action'],
          },
          description: '要应用的修改列表',
        },
      },
      required: ['changes'],
    },
  },
  {
    name: 'suggest_enhancements',
    description: '根据当前游戏配置推荐可添加的增强模块或风格变更。创建游戏后自动调用。',
    input_schema: {
      type: 'object' as const,
      properties: {
        current_modules: {
          type: 'array',
          items: { type: 'string' },
          description: '当前配置中已有的模块类型列表',
        },
        game_type: {
          type: 'string',
          description: '当前游戏类型',
        },
      },
      required: ['current_modules', 'game_type'],
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Regex fallback keyword map (Chinese → game type)                   */
/* ------------------------------------------------------------------ */

const KEYWORD_MAP: Array<{ pattern: RegExp; gameType: string }> = [
  { pattern: /接住|接水果|接东西|掉落.*接/i, gameType: 'catch' },
  { pattern: /躲避|闪避|躲开|躲.*障碍/i, gameType: 'dodge' },
  { pattern: /答题|问答|知识|答案|quiz/i, gameType: 'quiz' },
  { pattern: /转盘|抽奖|随机|轮盘/i, gameType: 'random-wheel' },
  { pattern: /点击|点点|戳|tap/i, gameType: 'tap' },
  { pattern: /射击|打靶|shoot|瞄准/i, gameType: 'shooting' },
  { pattern: /表情|emoji|笑脸/i, gameType: 'expression' },
  { pattern: /跑酷|奔跑|runner|酷跑/i, gameType: 'runner' },
  { pattern: /手势|gesture|比划/i, gameType: 'gesture' },
  { pattern: /节奏|音乐|rhythm|节拍/i, gameType: 'rhythm' },
  { pattern: /拼图|配对|翻牌|记忆/i, gameType: 'puzzle' },
  { pattern: /换装|穿搭|dress|服装/i, gameType: 'dress-up' },
  { pattern: /AR|增强现实|世界/i, gameType: 'world-ar' },
  { pattern: /故事|叙事|选择.*影响|剧情/i, gameType: 'narrative' },
  { pattern: /平台|跳跃|闯关|mario|马里奥/i, gameType: 'platformer' },
];

/* ------------------------------------------------------------------ */
/*  ConversationAgent                                                  */
/* ------------------------------------------------------------------ */

export class ConversationAgent {
  private client: Anthropic | null;
  private history: ConversationMessage[] = [];

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

    // Build messages array; inject current config context if available
    const messages = this.history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let systemPrompt = SYSTEM_PROMPT;
    if (currentConfig) {
      const moduleTypes = currentConfig.modules.map((m) => m.type);
      systemPrompt += `\n\n## 当前游戏配置
- 名称: ${currentConfig.meta.name}
- 主题: ${currentConfig.meta.theme ?? '未设置'}
- 画风: ${currentConfig.meta.artStyle ?? '未设置'}
- 模块: ${moduleTypes.join(', ')}
- 画布: ${currentConfig.canvas.width}x${currentConfig.canvas.height}`;
    }

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
              chips = this.generateSuggestions(moduleTypes, input.game_type);
              if (!reply) {
                const desc = GAME_TYPE_DESCRIPTIONS[input.game_type] ?? input.game_type;
                reply = `已为你创建「${desc.split(' — ')[0]}」游戏！`;
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
              };
              if (currentConfig) {
                config = this.applyChanges(currentConfig, input.changes);
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
              chips = this.generateSuggestions(input.current_modules, input.game_type);
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

    // Override timer duration if specified
    const duration = params.duration ?? 30;
    if (duration > 0) {
      const timerMod = modules.find((m) => m.type === 'Timer');
      if (timerMod) {
        timerMod.params = { ...timerMod.params, duration };
      } else {
        const count = (typeCounts.get('Timer') ?? 0) + 1;
        typeCounts.set('Timer', count);
        modules.push({
          id: `timer_${count}`,
          type: 'Timer',
          enabled: true,
          params: { ...getModuleParams(gameType, 'Timer'), duration },
        });
      }
    }

    // Resolve theme — allow custom themes (AI will generate matching assets)
    const themeId = params.theme ?? DEFAULT_THEME[gameType] ?? 'fruit';

    // Resolve art style
    const artStyle = params.art_style && ART_STYLES.includes(params.art_style as any)
      ? params.art_style
      : 'cartoon';

    // Build assets — include background flag if requested
    const assets: Record<string, any> = {};
    if (params.want_background) {
      assets['background'] = { type: 'background', src: '' };
    }

    const desc = GAME_TYPE_DESCRIPTIONS[gameType] ?? gameType;
    return {
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
      modules,
      assets,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Private: apply modify_game changes to an existing config         */
  /* ---------------------------------------------------------------- */

  private applyChanges(
    config: GameConfig,
    changes: Array<{
      action: string;
      module_type?: string;
      theme?: string;
      art_style?: string;
      duration?: number;
      param_key?: string;
      param_value?: unknown;
    }>,
  ): GameConfig {
    // Deep clone
    const updated: GameConfig = JSON.parse(JSON.stringify(config));

    for (const change of changes) {
      switch (change.action) {
        case 'add_module': {
          if (change.module_type && !updated.modules.some((m) => m.type === change.module_type)) {
            const gameType = this.inferGameType(updated);
            const count = updated.modules.filter((m) => m.type === change.module_type).length + 1;
            updated.modules.push({
              id: `${change.module_type!.toLowerCase()}_${count}`,
              type: change.module_type!,
              enabled: true,
              params: getModuleParams(gameType, change.module_type!),
            });
          }
          break;
        }

        case 'remove_module': {
          if (change.module_type) {
            updated.modules = updated.modules.filter((m) => m.type !== change.module_type);
          }
          break;
        }

        case 'set_theme': {
          if (change.theme) {
            updated.meta.theme = change.theme;
            // Clear all sprite assets to force regeneration with new theme
            for (const entry of Object.values(updated.assets)) {
              entry.src = '';
            }
          }
          break;
        }

        case 'set_art_style': {
          if (change.art_style) {
            updated.meta.artStyle = change.art_style;
            // Clear all assets to force regeneration with new style
            for (const entry of Object.values(updated.assets)) {
              entry.src = '';
            }
          }
          break;
        }

        case 'set_duration': {
          if (change.duration !== undefined) {
            const timerMod = updated.modules.find((m) => m.type === 'Timer');
            if (timerMod) {
              timerMod.params.duration = change.duration;
            }
          }
          break;
        }

        case 'set_param': {
          if (change.module_type && change.param_key !== undefined) {
            const mod = updated.modules.find((m) => m.type === change.module_type);
            if (mod) {
              mod.params[change.param_key] = change.param_value;
            }
          }
          break;
        }
      }
    }

    return updated;
  }

  /* ---------------------------------------------------------------- */
  /*  Private: generate suggestion chips                               */
  /* ---------------------------------------------------------------- */

  private generateSuggestions(currentModules: string[], _gameType: string): Chip[] {
    const chips: Chip[] = [];

    // Module suggestions — modules NOT currently in the config
    const MODULE_SUGGESTIONS: Record<string, { label: string; emoji: string }> = {
      Timer:           { label: '添加倒计时', emoji: '\u23F1' },
      Lives:           { label: '添加生命系统', emoji: '\u2764' },
      DifficultyRamp:  { label: '难度递增', emoji: '\u{1F4C8}' },
      ComboSystem:     { label: '连击系统', emoji: '\u{1F525}' },
      ParticleVFX:     { label: '粒子特效', emoji: '\u2728' },
      SoundFX:         { label: '音效', emoji: '\u{1F50A}' },
      CameraFollow:    { label: '镜头跟随', emoji: '\u{1F3A5}' },
      PowerUp:         { label: '道具系统', emoji: '\u{1F48E}' },
      Jump:            { label: '跳跃能力', emoji: '\u{1F3CB}' },
      Dash:            { label: '冲刺能力', emoji: '\u{1F4A8}' },
      Collectible:     { label: '收集物', emoji: '\u{1FA99}' },
      Hazard:          { label: '危险物', emoji: '\u26A0' },
      Checkpoint:      { label: '检查点', emoji: '\u{1F6A9}' },
      IFrames:         { label: '无敌帧', emoji: '\u{1F6E1}' },
      Knockback:       { label: '击退效果', emoji: '\u{1F4A5}' },
      MovingPlatform:  { label: '移动平台', emoji: '\u2194' },
      CrumblingPlatform: { label: '碎裂平台', emoji: '\u{1F9F1}' },
    };

    // Add missing modules that are relevant
    const currentSet = new Set(currentModules);
    for (const [modType, info] of Object.entries(MODULE_SUGGESTIONS)) {
      if (!currentSet.has(modType)) {
        chips.push({ id: `add:${modType}`, label: info.label, emoji: info.emoji });
      }
      if (chips.length >= 5) break;
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
      const chips = this.generateSuggestions(moduleTypes, detectedType);
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

    if (moduleTypes.has('Runner'))               return 'runner';
    if (moduleTypes.has('PlayerMovement'))        return 'platformer';
    if (moduleTypes.has('QuizEngine'))            return 'quiz';
    if (moduleTypes.has('Randomizer'))            return 'random-wheel';
    if (moduleTypes.has('ExpressionDetector'))    return 'expression';
    if (moduleTypes.has('GestureMatch'))          return 'gesture';
    if (moduleTypes.has('BeatMap'))               return 'rhythm';
    if (moduleTypes.has('MatchEngine'))           return 'puzzle';
    if (moduleTypes.has('DressUpEngine'))         return 'dress-up';
    if (moduleTypes.has('BranchStateMachine'))    return 'narrative';
    if (moduleTypes.has('PlaneDetection'))        return 'world-ar';

    // Heuristic for catch vs dodge vs tap vs shooting
    if (moduleTypes.has('Spawner') && moduleTypes.has('Collision')) {
      if (moduleTypes.has('Lives') && !moduleTypes.has('Scorer')) return 'dodge';
      return 'catch';
    }
    if (moduleTypes.has('Spawner')) return 'tap';

    return 'catch'; // ultimate fallback
  }
}
