/**
 * LLM-guided game creation through free conversation.
 * The LLM analyzes user requirements, breaks them into modules,
 * and asks step-by-step questions to confirm each decision.
 * When all requirements are gathered, generates the final GameConfig.
 */
import { createClaudeClient } from '@/services/claude-proxy.ts';
import type { GameConfig, ModuleConfig } from '@/engine/core/index.ts';
import { DEFAULT_THEME_FOR_GAME } from './wizard.ts';
import { ALL_GAME_TYPES, getModuleParams } from './game-presets.ts';
import type { ConversationMessage } from './conversation-defs.ts';

interface GuidedResult {
  /** LLM's response text (question or summary) */
  message: string;
  /** Non-null when LLM decides all requirements are gathered */
  config: GameConfig | null;
  /** Suggested quick-reply buttons for the user */
  quickReplies?: Array<{ id: string; label: string; emoji?: string }>;
}

// Module list with descriptions for LLM system prompt.
// Keep in sync with ALL_MODULES in conversation-defs.ts when adding new modules.
const ALL_MODULES = [
  // Input
  'FaceInput — 面部追踪：头部位置控制移动，张嘴/眨眼/微笑触发动作',
  'HandInput — 手势控制：手部位置控制移动，手势（拳头/剪刀/布）触发动作',
  'BodyInput — 全身姿态：身体位置控制移动，姿态触发动作',
  'TouchInput — 触屏：点击、滑动、长按、双击',
  'DeviceInput — 重力感应：倾斜设备控制方向，摇晃触发动作',
  'AudioInput — 声音控制：音调高低控制位置，音量大小触发动作',
  // Core mechanic
  'Spawner — 物体生成器：按频率生成掉落/移动物体',
  'Collision — 碰撞检测：圆形碰撞，支持多图层规则',
  'Scorer — 计分器：碰撞得分，连击加成',
  'Timer — 计时器：倒计时或正计时',
  'Lives — 生命系统：碰撞扣血，血量为零结束',
  'DifficultyRamp — 难度递增：随时间/分数增加难度',
  'ComboSystem — 连击系统：倍率、衰减、连击计数',
  'PowerUp — 增益道具：加速、护盾、磁铁等',
  // Shooter/Combat
  'PlayerMovement — 玩家移动：加速/减速的水平移动',
  'Projectile — 弹丸系统：速度、伤害、射速、穿透',
  'BulletPattern — 弹幕模式：扇形、螺旋、随机散射',
  'Aim — 瞄准系统：手动/自动锁定最近敌人',
  'EnemyAI — 敌人行为AI：巡逻、追击、逃跑',
  'WaveSpawner — 波次生成器：波间冷却、递增系数',
  'Health — 血量系统：最大血量、受伤事件',
  'Shield — 护盾系统：充能次数、冷却',
  // RPG/Progression
  'LevelUp — 升级系统：经验值、等级、属性成长',
  'EnemyDrop — 战利品掉落：掉落表、掉落概率',
  'StatusEffect — 状态效果：中毒、燃烧、减速',
  'SkillTree — 技能树：技能点、解锁、升级',
  'EquipmentSlot — 装备系统：武器、护甲、饰品',
  'DialogueSystem — 对话系统：NPC对话、任务提示',
  // Platformer
  'Jump — 跳跃：可配置跳跃力度和重力',
  'Gravity — 重力系统：物体下落物理',
  'StaticPlatform — 静态平台：固定位置的平台',
  'MovingPlatform — 移动平台：水平/垂直/圆形运动的平台',
  'OneWayPlatform — 单向平台：只从下方穿过',
  'CrumblingPlatform — 碎裂平台：踩上后碎裂，可重生',
  'CoyoteTime — 土狼时间：离开平台后短暂仍可跳跃',
  'Dash — 冲刺：快速方向冲刺',
  'Collectible — 收集物：金币/道具收集',
  'Hazard — 危险物：尖刺/火焰等障碍',
  'Checkpoint — 检查点：死亡后从检查点重生',
  'IFrames — 无敌帧：受伤后短暂无敌',
  'Knockback — 击退：受伤后被推开',
  'Inventory — 背包：收集物品计数',
  'WallDetect — 墙壁检测：贴墙/墙跳',
  // Special
  'QuizEngine — 问答引擎：选择题，计分',
  'Randomizer — 随机转盘：加权随机选择',
  'ExpressionDetector — 表情检测：微笑/惊讶/张嘴/眨眼',
  'GestureMatch — 手势匹配：按顺序做出指定手势',
  'BeatMap — 节拍器：音乐节奏匹配',
  'MatchEngine — 配对引擎：记忆翻牌配对',
  'Runner — 跑酷引擎：自动前进+换道',
  'DressUpEngine — 换装引擎：装备衣物层',
  'BranchStateMachine — 分支叙事：选择影响故事走向',
  'PlaneDetection — 平面检测：AR 平面识别',
  // Feedback
  'GameFlow — 游戏流程：开始/倒计时/进行/结束',
  'CameraFollow — 镜头跟随：跟随玩家，支持震动',
  'ParticleVFX — 粒子特效：碰撞/收集时的视觉效果',
  'SoundFX — 音效：事件驱动音效',
  'UIOverlay — HUD：分数/计时/生命显示',
  'ResultScreen — 结果画面：得分/星级/重玩',
].join('\n');

const SYSTEM_PROMPT = `你是 AIGE Studio 的游戏创建助手。用户通过对话描述他们想要的游戏，你需要：

1. 理解用户的游戏想法
2. 将需求拆解为具体的模块组合
3. 逐步引导用户确认关键决策（一次只问一个问题）
4. 当所有关键信息收集完毕后，调用 generate_config 工具生成配置

## 可用模块
${ALL_MODULES}

## 可用游戏主题
fruit（水果派对）、space（太空冒险）、ocean（海洋探索）、halloween（万圣节）、candy（糖果世界）

## 引导原则
- 每次只问一个问题，给出 2-4 个选项
- 先确认核心玩法，再确认输入方式，再确认附加功能
- 用简短友好的中文回答
- 根据用户描述主动推荐合适的模块组合
- 在 quickReplies 中提供选项按钮方便用户快速选择
- 当用户说"就这样"/"好了"/"生成"等，立即生成配置

## 输入方式映射
- FaceInput: 头部位置→移动，张嘴→跳跃/动作
- HandInput: 手部位置→移动，手势变化→跳跃/动作
- TouchInput: 滑动→移动，点击→跳跃/动作
- DeviceInput: 倾斜→移动，摇晃→跳跃/动作
- AudioInput: 音调高低→位置控制，音量→跳跃/动作

## 必须包含的基础模块
每个游戏都必须有：GameFlow, UIOverlay, ResultScreen

## GameConfig 格式
canvas: { width: 1080, height: 1920 }（竖屏）
每个 module 需要 id（类型小写+_1）、type、enabled: true、params（从预设获取）`;

export class GuidedCreator {
  private client: ReturnType<typeof createClaudeClient>;
  private history: ConversationMessage[] = [];

  constructor() {
    this.client = createClaudeClient();
  }

  /** Reset conversation for a new game creation session */
  reset(): void {
    this.history = [];
  }

  /** Whether there's an active guided conversation */
  isActive(): boolean {
    return this.history.length > 0;
  }

  /** Send a user message and get the LLM's guided response */
  async chat(userMessage: string): Promise<GuidedResult> {
    this.history.push({ role: 'user', content: userMessage });
    // Cap history to prevent unbounded token growth
    if (this.history.length > 20) {
      this.history = this.history.slice(-20);
    }

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: this.history.map((m) => ({ role: m.role, content: m.content })),
      tool_choice: { type: 'any' as const },
      tools: [
        {
          name: 'generate_config',
          description: '当所有游戏需求已确认，生成最终的 GameConfig。包含 modules 数组（每个模块有 id, type, enabled, params）和 meta 信息。',
          input_schema: {
            type: 'object' as const,
            properties: {
              gameType: { type: 'string', description: '游戏类型 ID（catch/dodge/platformer 等）' },
              inputType: { type: 'string', description: '输入模块类型（FaceInput/TouchInput 等）' },
              theme: { type: 'string', description: '主题 ID（fruit/space/ocean/halloween/candy）' },
              modules: {
                type: 'array',
                items: { type: 'string' },
                description: '需要包含的模块类型列表（不含输入模块和基础模块）',
              },
              gameName: { type: 'string', description: '游戏名称' },
              duration: { type: 'number', description: '游戏时长（秒），0表示无限制' },
              message: { type: 'string', description: '给用户的确认消息（中文）' },
              quickReplies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    label: { type: 'string' },
                    emoji: { type: 'string' },
                  },
                },
                description: '快捷回复按钮',
              },
            },
            required: ['gameType', 'inputType', 'theme', 'modules', 'gameName', 'duration', 'message'],
          },
        },
        {
          name: 'ask_question',
          description: '向用户提问以收集更多需求信息。每次只问一个问题。',
          input_schema: {
            type: 'object' as const,
            properties: {
              message: { type: 'string', description: '问题文本（中文）' },
              quickReplies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    label: { type: 'string' },
                    emoji: { type: 'string' },
                  },
                },
                description: '快捷回复选项',
              },
            },
            required: ['message'],
          },
        },
      ],
    });

    // Process response
    type ContentBlock = { type: string; name?: string; input?: unknown; text?: string };
    const content = response.content as ContentBlock[];
    for (const block of content) {
      if (block.type === 'tool_use' && block.name === 'generate_config') {
        const input = block.input as {
          gameType: string;
          inputType: string;
          theme: string;
          modules: string[];
          gameName: string;
          duration: number;
          message: string;
          quickReplies?: Array<{ id: string; label: string; emoji?: string }>;
        };

        const config = this.buildConfigFromLLM(input);
        this.history.push({ role: 'assistant', content: input.message });
        this.history = []; // Reset for next session

        return {
          message: input.message,
          config,
          quickReplies: input.quickReplies,
        };
      }

      if (block.type === 'tool_use' && block.name === 'ask_question') {
        const input = block.input as {
          message: string;
          quickReplies?: Array<{ id: string; label: string; emoji?: string }>;
        };

        this.history.push({ role: 'assistant', content: input.message });

        return {
          message: input.message,
          config: null,
          quickReplies: input.quickReplies,
        };
      }

      if (block.type === 'text' && block.text) {
        this.history.push({ role: 'assistant', content: block.text });
        return { message: block.text, config: null };
      }
    }

    return { message: '请描述你想做的游戏。', config: null };
  }

  /** Build GameConfig from LLM's structured output */
  private buildConfigFromLLM(input: {
    gameType: string;
    inputType: string;
    theme: string;
    modules: string[];
    gameName: string;
    duration: number;
  }): GameConfig {
    const gameType = ALL_GAME_TYPES.includes(input.gameType as any)
      ? input.gameType
      : 'catch';
    const modules: ModuleConfig[] = [];
    const typeCounts = new Map<string, number>();

    const addModule = (type: string) => {
      const count = (typeCounts.get(type) ?? 0) + 1;
      typeCounts.set(type, count);
      modules.push({
        id: `${type.toLowerCase()}_${count}`,
        type,
        enabled: true,
        params: getModuleParams(gameType, type),
      });
    };

    // Always-required modules
    addModule('GameFlow');
    addModule('UIOverlay');
    addModule('ResultScreen');

    // Input module
    addModule(input.inputType || 'TouchInput');

    // LLM-selected modules
    for (const modType of input.modules) {
      if (['GameFlow', 'UIOverlay', 'ResultScreen', input.inputType].includes(modType)) continue;
      addModule(modType);
    }

    // Timer if duration > 0
    if (input.duration > 0 && !modules.some((m) => m.type === 'Timer')) {
      const timerCount = (typeCounts.get('Timer') ?? 0) + 1;
      typeCounts.set('Timer', timerCount);
      modules.push({
        id: `timer_${timerCount}`,
        type: 'Timer',
        enabled: true,
        params: { ...getModuleParams(gameType, 'Timer'), duration: input.duration },
      });
    }

    const themeId = ['fruit', 'space', 'ocean', 'halloween', 'candy'].includes(input.theme)
      ? input.theme
      : DEFAULT_THEME_FOR_GAME[gameType] ?? 'fruit';

    return {
      version: '1.0.0',
      meta: {
        name: input.gameName || '新游戏',
        description: '',
        thumbnail: null,
        createdAt: new Date().toISOString(),
        theme: themeId,
      },
      canvas: { width: 1080, height: 1920 },
      modules,
      assets: {},
    };
  }
}
