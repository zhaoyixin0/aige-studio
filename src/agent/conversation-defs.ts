/**
 * Conversation agent definitions — types, constants, prompt, tools, keyword map.
 *
 * Extracted from conversation-agent.ts to keep the agent class file under 800 lines.
 * Pure data and simple lookup functions — no business logic.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { ALL_GAME_TYPES } from './game-presets.ts';
import { DEFAULT_THEME_FOR_GAME } from './wizard.ts';
import { PARAMETER_REGISTRY, type ParamCategory } from '@/data/parameter-registry.ts';
import type { ExpertInsightPayload, ModuleTuningPayload } from '@/store/editor-store.ts';

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Chip {
  id: string;
  label: string;
  emoji?: string;
  type?: 'game_type' | 'param' | 'action' | 'board_mode';
  paramId?: string;
  category?: string;
  action?: string;
}

export interface ParameterCardPayload {
  readonly category: string;
  readonly paramIds: string[];
  readonly title?: string;
}

export interface ConversationResult {
  reply: string;
  config?: import('@/engine/core/index.ts').GameConfig;
  chips?: Chip[];
  needsMoreInfo?: boolean;
  parameterCard?: ParameterCardPayload;
  expertInsight?: ExpertInsightPayload;
  moduleTuning?: ModuleTuningPayload;
  presetUsed?: { presetId: string; title: string; pendingAssets: number };
}

export interface ConfigChange {
  action: string;
  module_type?: string;
  theme?: string;
  art_style?: string;
  duration?: number;
  param_key?: string;
  param_value?: unknown;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const MAX_HISTORY = 10;

export const ALL_MODULES = [
  // Input
  'FaceInput', 'HandInput', 'BodyInput', 'TouchInput', 'DeviceInput', 'AudioInput',
  // Mechanic — core
  'Spawner', 'Collision', 'Scorer', 'Timer', 'Lives', 'DifficultyRamp',
  'QuizEngine', 'Randomizer', 'ExpressionDetector', 'GestureMatch',
  'BeatMap', 'MatchEngine', 'Runner', 'DressUpEngine', 'BranchStateMachine',
  'PlaneDetection', 'ComboSystem', 'PowerUp',
  // Mechanic — platformer
  'PlayerMovement', 'Jump', 'Gravity', 'StaticPlatform', 'MovingPlatform',
  'OneWayPlatform', 'CrumblingPlatform', 'CoyoteTime', 'Dash', 'Collectible', 'Hazard',
  'Checkpoint', 'IFrames', 'Knockback', 'Inventory', 'WallDetect',
  // Mechanic — shooter (Batch 2)
  'Projectile', 'BulletPattern', 'Aim', 'EnemyAI', 'WaveSpawner', 'Health', 'Shield',
  // Mechanic — RPG (Batch 3)
  'EnemyDrop', 'LevelUp', 'StatusEffect', 'SkillTree', 'EquipmentSlot', 'DialogueSystem',
  // Mechanic — Tween
  'Tween',
  // Mechanic — Physics2D
  'Physics2D',
  // Mechanic — ScrollingLayers
  'ScrollingLayers',
  // Feedback
  'GameFlow', 'CameraFollow', 'ParticleVFX', 'SoundFX', 'UIOverlay', 'ResultScreen',
];

export const THEMES = ['fruit', 'space', 'ocean', 'halloween', 'candy'] as const;
export const ART_STYLES = ['cartoon', 'pixel', 'flat', 'realistic', 'watercolor', 'chibi'] as const;

export const HERO_PRESET_IDS = [
  'hero-catch-fruit', 'hero-shooter-wave', 'hero-platformer-basic',
  'hero-whack-a-mole', 'hero-slingshot-launch', 'hero-match-pairs',
  'hero-endless-runner', 'hero-quiz-challenge',
] as const;

export const HERO_PRESET_DESCRIPTIONS: Record<string, string> = {
  'hero-catch-fruit': '经典接水果（接住得分）',
  'hero-shooter-wave': '太空射击（波次射击）',
  'hero-platformer-basic': '平台跳跃（跳跃收集）',
  'hero-whack-a-mole': '打地鼠（点击消灭）',
  'hero-slingshot-launch': '弹弓发射（拖放物理）',
  'hero-match-pairs': '记忆配对（翻牌匹配）',
  'hero-endless-runner': '无尽跑酷（横向闪避）',
  'hero-quiz-challenge': '答题挑战（限时问答）',
};

export const GAME_TYPE_DESCRIPTIONS: Record<string, string> = {
  // --- Reflex ---
  'catch':          '接住类 — 用头/手接住掉落物品',
  'dodge':          '躲避类 — 躲避从上方掉落的障碍物',
  'tap':            '点击类 — 点击屏幕上出现的目标',
  'rhythm':         '节奏类 — 跟随节奏点击屏幕',
  'quick-reaction': '快速反应 — 对突然出现的提示做出反应',
  'whack-a-mole':   '打地鼠 — 点击弹出的目标',
  // --- Physics ---
  'shooting':       '射击类 — 发射子弹消灭敌人、躲避攻击',
  'slingshot':      '弹弓 — 拉弹弓发射物体破坏建筑',
  'ball-physics':   '物理球 — 基于物理引擎的弹球玩法',
  'trajectory':     '弹道 — 计算抛物线击中目标',
  'bouncing':       '弹球 — 球在封闭区域内弹跳',
  'rope-cutting':   '割绳子 — 切断绳索解开谜题',
  // --- Puzzle ---
  'puzzle':         '解谜/配对 — 翻开卡片找到配对',
  'match-link':     '连线配对 — 连接相同图案的物品',
  'jigsaw':         '拼图 — 拼合碎片还原图片',
  'water-pipe':     '水管 — 连接管道引导水流',
  'scale-matching': '天平 — 在天平上平衡物品重量',
  // --- Social ---
  'quiz':           '答题类 — 限时回答趣味问题',
  'random-wheel':   '随机转盘 — 转动转盘看结果',
  'expression':     '表情挑战 — 用面部表情匹配目标',
  'gesture':        '手势互动 — 用手势匹配目标动作',
  'flip-guess':     '翻牌猜 — 翻牌配对朋友猜谜',
  'head-tilt':      '歪头选择 — 歪头选择屏幕选项',
  // --- Creative ---
  'dress-up':       '换装/贴纸 — 给角色搭配服装和配饰',
  'drawing':        '画画 — 自由绘画涂鸦',
  'avatar-frame':   '头像框 — 创建自定义头像装饰框',
  // --- Sports ---
  'runner':         '跑酷类 — 控制角色躲避障碍跑到最远',
  'platformer':     '平台跳跃 — 跳跃闯关、收集金币、躲避障碍',
  'action-rpg':     '动作RPG — 射击敌人、升级角色、收集装备',
  'racing':         '赛车 — 滑动方向盘躲避障碍竞速',
  'cross-road':     '过马路 — 穿越车流安全到达对面',
  'ball-rolling':   '滚球 — 控制球体在地形上滚动',
  // --- Narrative ---
  'narrative':      '分支叙事 — 做出选择影响故事走向',
  'world-ar':       '世界AR — 在真实环境中放置虚拟物品',
  // --- Experimental ---
  'maze':           '迷宫 — 找到迷宫出口',
  'sugar-insert':   '糖果挑战 — 精准投放糖果到容器中',
  'swimmer':        '游泳 — 水中导航游泳竞赛',
  'jelly':          '果冻 — 软体物理弹跳游戏',
};

// Use wizard.ts DEFAULT_THEME_FOR_GAME as single source of truth
export const DEFAULT_THEME = DEFAULT_THEME_FOR_GAME;

export const SYSTEM_PROMPT_BASE = `你是 AIGE Studio 的游戏创建对话助手。用户通过自然语言描述想要的游戏，你直接创建或修改。

## 38 种游戏类型
${Object.entries(GAME_TYPE_DESCRIPTIONS).map(([id, desc]) => `- ${id}: ${desc}`).join('\n')}

## 可用模块（按类别）

### 输入模块
- TouchInput — 触屏点击/滑动/长按
- FaceInput — 面部追踪（表情、张嘴、眨眼）
- HandInput — 手势识别（石头剪刀布等）
- BodyInput — 全身姿态检测
- DeviceInput — 设备倾斜/摇晃
- AudioInput — 声音/吹气检测

### 核心机制
- GameFlow — 游戏状态流程（倒计时→游戏中→结束）
- Spawner — 物体生成器（掉落物、收集物）
- Collision — 碰撞检测（圆形碰撞体，按层分组）
- Scorer — 计分系统（命中加分、连击倍率）
- Timer — 倒计时/计时器
- Lives — 生命/血量系统
- DifficultyRamp — 难度递增（按时间/分数/波次）
- ComboSystem — 独立连击系统（倍率、衰减）
- PowerUp — 增益道具（加速、护盾、磁铁）

### 射击/战斗
- PlayerMovement — 角色移动（加速度、边界限制）
- Projectile — 弹丸系统（速度、伤害、射速、穿透）
- Aim — 瞄准系统（手动/自动锁定最近敌人）
- EnemyAI — 敌人行为AI（巡逻、追击、逃跑）
- WaveSpawner — 波次生成器（波间冷却、递增系数）
- Health — 血量系统（最大血量、伤害事件）
- Shield — 护盾系统（充能次数、冷却）
- BulletPattern — 弹幕模式（扇形、螺旋等）
- IFrames — 无敌帧（受伤后短暂无敌+闪烁）
- Knockback — 击退效果（受伤位移）

### RPG/成长
- LevelUp — 升级系统（经验值、等级、属性成长）
- EnemyDrop — 战利品掉落（掉落表、掉落概率）
- StatusEffect — 状态效果（中毒、燃烧、减速）
- SkillTree — 技能树（技能点、解锁、升级）
- EquipmentSlot — 装备系统（武器、护甲、饰品）
- DialogueSystem — 对话系统（NPC对话、任务提示）

### 平台跳跃
- Jump — 跳跃（跳跃力、重力配合）
- Gravity — 重力（下坠加速度、终端速度）
- StaticPlatform — 固定平台
- MovingPlatform — 移动平台（路径点、速度）
- OneWayPlatform — 单向平台（只从下方穿过）
- CrumblingPlatform — 碎裂平台（踩后倒计时消失）
- CoyoteTime — 土狼时间（离开平台后仍可跳跃）
- Dash — 冲刺（快速位移+可选无敌）
- Collectible — 收集物（金币、道具）
- Hazard — 危险物（尖刺、火焰）
- Checkpoint — 存档点（死亡重生位置）
- Inventory — 背包系统
- WallDetect — 墙壁检测+蹬墙跳

### 专用游戏引擎
- QuizEngine — 答题引擎
- Randomizer — 随机抽取（转盘）
- ExpressionDetector — 表情识别
- GestureMatch — 手势匹配
- BeatMap — 节拍映射（节奏游戏）
- MatchEngine — 配对引擎（翻牌记忆）
- Runner — 自动跑酷引擎
- DressUpEngine — 换装引擎
- BranchStateMachine — 分支叙事状态机
- PlaneDetection — AR平面检测

### 反馈/视觉
- CameraFollow — 镜头跟随
- ParticleVFX — 粒子特效
- SoundFX — 音效
- UIOverlay — HUD界面（分数、血量、生命、等级）
- ResultScreen — 结算画面（分数、星级、重玩）

## 主题
fruit（水果派对）、space（太空冒险）、ocean（海洋探索）、halloween（万圣节）、candy（糖果世界）。也可用自定义主题。

## 画风
cartoon（卡通）、pixel（像素）、flat（扁平）、realistic（写实）、watercolor（水彩）、chibi（Q版）

## 输入方式
TouchInput（触屏点击，默认）、FaceInput（面部追踪）、HandInput（手势控制）、DeviceInput（重力感应）、AudioInput（声音控制）

## 可用游戏模板
以下预设模板可通过 use_preset 工具快速创建游戏：
${HERO_PRESET_IDS.map((id) => `- ${id}: ${HERO_PRESET_DESCRIPTIONS[id]}`).join('\n')}

当用户意图明确匹配以上模板时，优先使用 use_preset 而非 create_game。

## 行为准则（V2 — 立即创建优先）

### 路径A — 意图明确（用户提到了具体游戏类型或玩法）
- **禁止询问任何确认问题**（输入方式、主题、画风等），全部用合理默认值
- 立即调用 create_game 工具创建游戏
- 创建成功后只需简短确认（如"已创建！"），不要描述参数细节
- 系统会自动在聊天中推送 L1 控件（难度/节奏/情绪），你无需提及

### 路径B — 意图模糊（用户说"做个游戏"、"随便来一个"等）
- 不要猜测或盲目创建
- 回复"请选择你想创建的游戏类型："，系统会自动展示游戏类型选择卡片
- 用户选择后再调用 create_game

### 创建后交互
- 不要主动调用 suggest_enhancements，除非用户明确要求"加功能"或"增强"
- 用户通过自然语言调整参数时，使用 push_parameter_card 推送参数卡片
- 用户通过自然语言修改游戏时，使用 modify_game

### 通用规则
- 始终用中文回复
- 回复极简，不超过 1-2 句话
- 绝不寒暄，直接行动`;

/* ------------------------------------------------------------------ */
/*  Tool definitions for Claude API                                    */
/* ------------------------------------------------------------------ */

export const TOOLS: Anthropic.Messages.Tool[] = [
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
  {
    name: 'push_parameter_card',
    description: '推送一个参数调节卡片到聊天中，让用户通过 GUI 调整特定参数',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: '参数类别（如 game_mechanics, visual_audio, game_objects, abstract, input）',
        },
        param_ids: {
          type: 'array',
          items: { type: 'string' },
          description: '来自参数注册表的参数 ID 列表',
        },
        title: {
          type: 'string',
          description: '卡片标题（可选）',
        },
      },
      required: ['category', 'param_ids'],
    },
  },
  {
    name: 'use_preset',
    description: '使用预设模板快速创建游戏。当用户提到"模板"、"快速开始"或匹配已有预设时使用。',
    input_schema: {
      type: 'object' as const,
      properties: {
        preset_id: {
          type: 'string',
          description: '预设模板 ID',
          enum: [...HERO_PRESET_IDS],
        },
        params: {
          type: 'object',
          description: '参数覆盖（可选）。键为参数名，值为用户指定的值。',
          additionalProperties: true,
        },
        game_type: {
          type: 'string',
          description: '游戏类型（可选）。若未提供 preset_id，根据类型匹配最佳预设。',
        },
      },
      required: ['preset_id'],
    },
  },
  {
    name: 'push_expert_insight',
    description: '推送专家洞见与参数调优建议到聊天界面',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: '洞见标题' },
        body: { type: 'string', description: '详细说明' },
        modules: {
          type: 'array',
          description: '推荐的模块参数调整',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              params: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { name: { type: 'string' }, value: {} },
                  required: ['name', 'value'],
                },
              },
            },
            required: ['name', 'params'],
          },
        },
      },
      required: ['title'],
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Regex fallback keyword map (Chinese → game type)                   */
/* ------------------------------------------------------------------ */

export const KEYWORD_MAP: Array<{ pattern: RegExp; gameType: string }> = [
  // --- Original 16 (order: specific before generic) ---
  { pattern: /接住|接水果|接东西|掉落.*接/i, gameType: 'catch' },
  { pattern: /躲避|闪避|躲开|躲.*障碍/i, gameType: 'dodge' },
  { pattern: /答题|问答|知识|答案|quiz/i, gameType: 'quiz' },
  { pattern: /转盘|抽奖|轮盘/i, gameType: 'random-wheel' },
  { pattern: /射击|打靶|shoot|瞄准|飞机|大战|子弹/i, gameType: 'shooting' },
  { pattern: /表情|emoji|笑脸/i, gameType: 'expression' },
  { pattern: /跑酷|奔跑|runner|酷跑/i, gameType: 'runner' },
  { pattern: /手势|gesture|比划/i, gameType: 'gesture' },
  { pattern: /节奏|音乐|rhythm|节拍/i, gameType: 'rhythm' },
  { pattern: /换装|穿搭|dress|服装/i, gameType: 'dress-up' },
  { pattern: /AR|增强现实/i, gameType: 'world-ar' },
  { pattern: /故事|叙事|选择.*影响|剧情/i, gameType: 'narrative' },
  { pattern: /平台|跳跃|闯关|mario|马里奥/i, gameType: 'platformer' },
  { pattern: /RPG|角色扮演|升级|刷怪|打怪/i, gameType: 'action-rpg' },
  // --- M0 expansion: 22 new types (specific patterns first) ---
  { pattern: /快速反应|反应速度|反应测试/i, gameType: 'quick-reaction' },
  { pattern: /打地鼠|地鼠|whack/i, gameType: 'whack-a-mole' },
  { pattern: /弹弓|弹射|slingshot|愤怒的小鸟/i, gameType: 'slingshot' },
  { pattern: /物理球|钟摆|ball[\s-]?physics/i, gameType: 'ball-physics' },
  { pattern: /弹道|轨迹|trajectory/i, gameType: 'trajectory' },
  { pattern: /弹球|弹珠|反弹|bounce|bouncing/i, gameType: 'bouncing' },
  { pattern: /割绳子|cut.*rope/i, gameType: 'rope-cutting' },
  { pattern: /连线|link.*match|match.*link/i, gameType: 'match-link' },
  { pattern: /拼图|jigsaw|组装|assemble/i, gameType: 'jigsaw' },
  { pattern: /水管|管道|pipe|接水/i, gameType: 'water-pipe' },
  { pattern: /天平|称重|scale.*match|balance/i, gameType: 'scale-matching' },
  { pattern: /翻牌|猜牌|flip.*guess|记忆卡/i, gameType: 'flip-guess' },
  { pattern: /歪头|head.*tilt|偏头/i, gameType: 'head-tilt' },
  { pattern: /画画|涂鸦|drawing|画笔/i, gameType: 'drawing' },
  { pattern: /头像框|avatar.*frame|相框/i, gameType: 'avatar-frame' },
  { pattern: /赛车|竞速|racing|飙车/i, gameType: 'racing' },
  { pattern: /过马路|cross.*road|穿越马路/i, gameType: 'cross-road' },
  { pattern: /滚球|rolling.*ball|球.*滚/i, gameType: 'ball-rolling' },
  { pattern: /迷宫|maze|走迷宫/i, gameType: 'maze' },
  { pattern: /糖果挑战|sugar|精准投放/i, gameType: 'sugar-insert' },
  { pattern: /游泳|swimmer/i, gameType: 'swimmer' },
  { pattern: /果冻|jelly|软体/i, gameType: 'jelly' },
  // --- Generic (must be after specific types that share keywords) ---
  { pattern: /点击|点点|戳|tap/i, gameType: 'tap' },
  { pattern: /puzzle|解谜|配对|记忆/i, gameType: 'puzzle' },
];

/* ------------------------------------------------------------------ */
/*  Pure function: detect game type from user message                  */
/* ------------------------------------------------------------------ */

export function detectGameTypeFromMessage(message: string): string | null {
  for (const { pattern, gameType } of KEYWORD_MAP) {
    if (pattern.test(message)) return gameType;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Suggestion chip data                                               */
/* ------------------------------------------------------------------ */

/** All possible module suggestions with labels and emoji. */
export const ALL_MODULE_SUGGESTIONS: Record<string, { label: string; emoji: string }> = {
  // Core
  Timer:             { label: '添加倒计时', emoji: '\u23F1' },
  Lives:             { label: '添加生命系统', emoji: '\u2764' },
  DifficultyRamp:    { label: '难度递增', emoji: '\u{1F4C8}' },
  ComboSystem:       { label: '连击系统', emoji: '\u{1F525}' },
  ParticleVFX:       { label: '粒子特效', emoji: '\u2728' },
  SoundFX:           { label: '音效', emoji: '\u{1F50A}' },
  CameraFollow:      { label: '镜头跟随', emoji: '\u{1F3A5}' },
  PowerUp:           { label: '道具系统', emoji: '\u{1F48E}' },
  // Platformer
  Jump:              { label: '跳跃能力', emoji: '\u{1F3CB}' },
  Dash:              { label: '冲刺能力', emoji: '\u{1F4A8}' },
  Collectible:       { label: '收集物', emoji: '\u{1FA99}' },
  Hazard:            { label: '危险物', emoji: '\u26A0' },
  Checkpoint:        { label: '检查点', emoji: '\u{1F6A9}' },
  MovingPlatform:    { label: '移动平台', emoji: '\u2194' },
  CrumblingPlatform: { label: '碎裂平台', emoji: '\u{1F9F1}' },
  CoyoteTime:        { label: '土狼时间', emoji: '\u{1F43E}' },
  // Shooter/Combat
  Health:            { label: '血量系统', emoji: '\u{1F497}' },
  Shield:            { label: '护盾系统', emoji: '\u{1F6E1}' },
  IFrames:           { label: '无敌帧', emoji: '\u{1F4AB}' },
  Knockback:         { label: '击退效果', emoji: '\u{1F4A5}' },
  BulletPattern:     { label: '弹幕模式', emoji: '\u{1F4AB}' },
  Projectile:        { label: '弹丸系统', emoji: '\u{1F52B}' },
  Aim:               { label: '瞄准系统', emoji: '\u{1F3AF}' },
  EnemyAI:           { label: '敌人AI', emoji: '\u{1F47E}' },
  WaveSpawner:       { label: '波次系统', emoji: '\u{1F30A}' },
  // RPG/Progression
  LevelUp:           { label: '升级系统', emoji: '\u2B06' },
  EnemyDrop:         { label: '战利品掉落', emoji: '\u{1F4B0}' },
  StatusEffect:      { label: '状态效果', emoji: '\u{1F9EA}' },
  SkillTree:         { label: '技能树', emoji: '\u{1F333}' },
  EquipmentSlot:     { label: '装备系统', emoji: '\u2694' },
  DialogueSystem:    { label: '对话系统', emoji: '\u{1F4AC}' },
};

/**
 * Priority lists per game-type category.
 * Modules listed here are suggested first (in order) for that category.
 * Modules NOT in the priority list are still available but deprioritized.
 */
export const PRIORITY_BY_CATEGORY: Record<string, string[]> = {
  shooter: [
    'Health', 'Shield', 'BulletPattern', 'ComboSystem', 'DifficultyRamp',
    'IFrames', 'Knockback', 'ParticleVFX', 'SoundFX',
  ],
  'action-rpg': [
    'LevelUp', 'EnemyDrop', 'SkillTree', 'EquipmentSlot', 'StatusEffect',
    'DialogueSystem', 'Shield', 'IFrames', 'Knockback', 'ComboSystem',
    'DifficultyRamp', 'ParticleVFX', 'SoundFX',
  ],
  platformer: [
    'MovingPlatform', 'CrumblingPlatform', 'Dash', 'CoyoteTime',
    'Collectible', 'Hazard', 'Checkpoint', 'IFrames', 'Knockback',
    'CameraFollow', 'ParticleVFX', 'SoundFX',
  ],
  simple: [
    'Timer', 'Lives', 'DifficultyRamp', 'ComboSystem',
    'ParticleVFX', 'SoundFX', 'PowerUp',
  ],
};

/** Map game type id to priority category. */
export function getGameCategory(gameType: string): string {
  if (gameType === 'shooting') return 'shooter';
  if (gameType === 'action-rpg') return 'action-rpg';
  if (gameType === 'platformer') return 'platformer';
  return 'simple';
}

/* ------------------------------------------------------------------ */
/*  Parameter registry summary for system prompt grounding             */
/* ------------------------------------------------------------------ */

/**
 * Build a compact summary of the parameter registry grouped by category.
 * Used to inject parameter IDs into the system prompt so the LLM can
 * reference real registry IDs when calling push_parameter_card.
 */
export function buildParameterRegistrySummary(): string {
  const byCategory = new Map<ParamCategory, Array<{ id: string; name: string }>>();

  for (const param of PARAMETER_REGISTRY) {
    const list = byCategory.get(param.category) ?? [];
    list.push({ id: param.id, name: param.name });
    byCategory.set(param.category, list);
  }

  const lines: string[] = ['## 参数注册表（用于 push_parameter_card 工具）'];
  for (const [category, params] of byCategory) {
    const entries = params.map((p) => `${p.id}(${p.name})`).join(', ');
    lines.push(`- ${category}: ${entries}`);
  }

  return lines.join('\n');
}
