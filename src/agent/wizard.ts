import type { GameConfig, ModuleConfig } from '@/engine/core/index.ts';
import { getModuleParams } from './game-presets';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type WizardStep =
  | 'idle'
  | 'game_type'
  | 'input_method'
  | 'duration'
  | 'theme'
  | 'art_style'
  | 'character'
  | 'optional_modules'
  | 'background'
  | 'generating'
  | 'done';

export interface WizardChoice {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
}

export interface WizardQuestion {
  step: WizardStep;
  question: string;
  choices: WizardChoice[];
  multiSelect?: boolean;
}

export interface WizardState {
  step: WizardStep;
  gameType: string | null;
  inputMethod: string | null;
  duration: number | null;
  theme: string | null;
  artStyle: string | null;
  character: string | null;
  optionalModules: Record<string, boolean>;
  currentOptionalIndex: number;
  wantBackground: boolean;
}

export interface WizardAnswerResult {
  question: WizardQuestion | null;
  config: GameConfig | null;
  summary: string;
}

/* ------------------------------------------------------------------ */
/*  Game-type metadata                                                 */
/* ------------------------------------------------------------------ */

interface GameTypeDef {
  id: string;
  label: string;
  emoji: string;
  description: string;
  requiredModules: string[];
  inputOptions: string[] | null; // null = fixed (derive from game type)
  fixedInput?: string;
  optionalModules: Array<{ type: string; label: string; description: string }>;
  metaName: string;
  metaDescription: string;
}

const GAME_TYPES: GameTypeDef[] = [
  {
    id: 'catch',
    label: '接住类',
    emoji: '\u{1F3AF}',
    description: '像 TikTok "接水果" — 用头/手接住掉落物品',
    requiredModules: ['GameFlow', 'Spawner', 'Collision', 'Scorer', 'UIOverlay', 'ResultScreen'],
    inputOptions: ['FaceInput', 'HandInput', 'TouchInput'],
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定游戏时长' },
      { type: 'Lives', label: '生命系统', description: '错过物品扣除生命' },
      { type: 'DifficultyRamp', label: '难度递增', description: '随时间增加掉落速度和频率' },
      { type: 'ComboSystem', label: '连击系统', description: '连续接住获得分数加成' },
      { type: 'ParticleVFX', label: '粒子特效', description: '接住和错过时的视觉效果' },
      { type: 'SoundFX', label: '音效', description: '游戏音效和背景音乐' },
    ],
    metaName: '接住游戏',
    metaDescription: '接住掉落的物品，获取最高分',
  },
  {
    id: 'dodge',
    label: '躲避类',
    emoji: '\u{1F3C3}',
    description: '像 TikTok "躲方块" — 躲避从上方掉落的障碍物',
    requiredModules: ['GameFlow', 'Spawner', 'Collision', 'Lives', 'UIOverlay', 'ResultScreen'],
    inputOptions: ['FaceInput', 'HandInput', 'TouchInput'],
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定游戏时长' },
      { type: 'Scorer', label: '得分系统', description: '存活时间计分' },
      { type: 'DifficultyRamp', label: '难度递增', description: '随时间增加障碍物速度和频率' },
      { type: 'ComboSystem', label: '连击系统', description: '连续躲避获得分数加成' },
      { type: 'ParticleVFX', label: '粒子特效', description: '碰撞时的视觉效果' },
      { type: 'SoundFX', label: '音效', description: '游戏音效和背景音乐' },
    ],
    metaName: '躲避游戏',
    metaDescription: '躲避障碍物，尽可能存活更久',
  },
  {
    id: 'quiz',
    label: '答题类',
    emoji: '\u2753',
    description: '像 TikTok "知识问答" — 限时回答趣味问题',
    requiredModules: ['GameFlow', 'QuizEngine', 'Scorer', 'UIOverlay', 'ResultScreen'],
    inputOptions: null,
    fixedInput: 'TouchInput',
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定答题时间' },
      { type: 'SoundFX', label: '音效', description: '答对/答错音效' },
    ],
    metaName: '答题游戏',
    metaDescription: '回答问题，挑战你的知识',
  },
  {
    id: 'tap',
    label: '点击类',
    emoji: '\u{1F446}',
    description: '像 TikTok "切西瓜" — 点击屏幕上出现的目标',
    requiredModules: ['GameFlow', 'Spawner', 'Scorer', 'UIOverlay', 'ResultScreen'],
    inputOptions: null,
    fixedInput: 'TouchInput',
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定游戏时长' },
      { type: 'Lives', label: '生命系统', description: '错过目标扣除生命' },
      { type: 'Collision', label: '碰撞检测', description: '点击命中判定' },
      { type: 'DifficultyRamp', label: '难度递增', description: '随时间增加目标出现速度' },
      { type: 'ComboSystem', label: '连击系统', description: '连续点击获得分数加成' },
      { type: 'ParticleVFX', label: '粒子特效', description: '点击时的视觉效果' },
      { type: 'SoundFX', label: '音效', description: '游戏音效和背景音乐' },
    ],
    metaName: '点击游戏',
    metaDescription: '快速点击目标获取高分',
  },
  {
    id: 'shooting',
    label: '射击类',
    emoji: '\u{1F52B}',
    description: '像太空射击/飞机大战 — 发射子弹消灭敌人',
    requiredModules: ['GameFlow', 'PlayerMovement', 'Projectile', 'Aim', 'EnemyAI', 'WaveSpawner', 'Collision', 'Scorer', 'Health', 'Lives', 'IFrames', 'UIOverlay', 'ResultScreen'],
    inputOptions: ['TouchInput', 'FaceInput'],
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定游戏时长' },
      { type: 'Shield', label: '护盾', description: '抵挡敌人攻击' },
      { type: 'DifficultyRamp', label: '难度递增', description: '随时间增加敌人数量' },
      { type: 'ComboSystem', label: '连击系统', description: '连续击杀获得分数加成' },
      { type: 'BulletPattern', label: '弹幕模式', description: '多种子弹发射方式' },
      { type: 'ParticleVFX', label: '粒子特效', description: '击中和爆炸效果' },
      { type: 'SoundFX', label: '音效', description: '射击和爆炸音效' },
    ],
    metaName: '射击游戏',
    metaDescription: '发射子弹消灭敌人，获取高分',
  },
  {
    id: 'random-wheel',
    label: '随机转盘',
    emoji: '\u{1F3B0}',
    description: '像 TikTok "幸运转盘" — 转动转盘看结果',
    requiredModules: ['GameFlow', 'Randomizer', 'UIOverlay', 'ResultScreen'],
    inputOptions: null,
    fixedInput: 'TouchInput',
    optionalModules: [
      { type: 'SoundFX', label: '音效', description: '转盘旋转和停止音效' },
      { type: 'ParticleVFX', label: '粒子特效', description: '结果揭晓时的特效' },
    ],
    metaName: '随机转盘',
    metaDescription: '旋转转盘，看看你的运气',
  },
  {
    id: 'expression',
    label: '表情挑战',
    emoji: '\u{1F60A}',
    description: '像 Snapchat "Emoji挑战" — 用面部表情匹配目标',
    requiredModules: ['GameFlow', 'ExpressionDetector', 'Scorer', 'UIOverlay', 'ResultScreen'],
    inputOptions: null,
    fixedInput: 'FaceInput',
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定游戏时长' },
      { type: 'ComboSystem', label: '连击系统', description: '连续匹配获得分数加成' },
      { type: 'ParticleVFX', label: '粒子特效', description: '表情匹配时的视觉效果' },
      { type: 'SoundFX', label: '音效', description: '匹配成功/失败音效' },
    ],
    metaName: '表情游戏',
    metaDescription: '用面部表情来玩游戏',
  },
  {
    id: 'runner',
    label: '跑酷类',
    emoji: '\u{1F3C3}\u200D\u2642\uFE0F',
    description: '像 TikTok "尖叫鸡" — 控制角色躲避障碍跑到最远',
    requiredModules: ['GameFlow', 'Runner', 'Spawner', 'Collision', 'Scorer', 'UIOverlay', 'ResultScreen'],
    inputOptions: ['TouchInput', 'FaceInput'],
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定游戏时长' },
      { type: 'Lives', label: '生命系统', description: '碰到障碍物扣除生命' },
      { type: 'DifficultyRamp', label: '难度递增', description: '随时间增加奔跑速度' },
      { type: 'Jump', label: '跳跃', description: '跳跃躲避障碍物' },
      { type: 'PowerUp', label: '道具系统', description: '收集道具获得能力加成' },
      { type: 'ParticleVFX', label: '粒子特效', description: '奔跑和碰撞的视觉效果' },
      { type: 'SoundFX', label: '音效', description: '游戏音效和背景音乐' },
    ],
    metaName: '跑酷游戏',
    metaDescription: '自动奔跑，躲避障碍物，收集道具',
  },
  {
    id: 'gesture',
    label: '手势互动',
    emoji: '\u{1F91A}',
    description: '像 Snapchat "手势挑战" — 用手势匹配目标动作',
    requiredModules: ['GameFlow', 'GestureMatch', 'Scorer', 'UIOverlay', 'ResultScreen'],
    inputOptions: null,
    fixedInput: 'HandInput',
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定游戏时长' },
      { type: 'ComboSystem', label: '连击系统', description: '连续匹配获得分数加成' },
      { type: 'ParticleVFX', label: '粒子特效', description: '匹配成功时的视觉效果' },
      { type: 'SoundFX', label: '音效', description: '匹配成功/失败音效' },
    ],
    metaName: '手势互动游戏',
    metaDescription: '用手势匹配目标动作来得分',
  },
  {
    id: 'rhythm',
    label: '节奏类',
    emoji: '\u{1F3B5}',
    description: '像 TikTok "音乐节拍" — 跟随节奏点击屏幕',
    requiredModules: ['GameFlow', 'BeatMap', 'Spawner', 'Collision', 'Scorer', 'UIOverlay', 'ResultScreen'],
    inputOptions: ['TouchInput', 'FaceInput'],
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定游戏时长' },
      { type: 'ComboSystem', label: '连击系统', description: '连续命中获得分数加成' },
      { type: 'DifficultyRamp', label: '难度递增', description: '随时间增加节拍速度' },
      { type: 'ParticleVFX', label: '粒子特效', description: '命中节拍时的视觉效果' },
      { type: 'SoundFX', label: '音效', description: '节拍命中/失败音效' },
    ],
    metaName: '节奏游戏',
    metaDescription: '跟随节奏点击屏幕，挑战你的节拍感',
  },
  {
    id: 'puzzle',
    label: '拼图/配对',
    emoji: '\u{1F9E9}',
    description: '像 TikTok "记忆翻牌" — 翻开卡片找到配对',
    requiredModules: ['GameFlow', 'MatchEngine', 'Scorer', 'UIOverlay', 'ResultScreen'],
    inputOptions: null,
    fixedInput: 'TouchInput',
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定游戏时长' },
      { type: 'SoundFX', label: '音效', description: '翻牌和配对音效' },
      { type: 'ParticleVFX', label: '粒子特效', description: '配对成功时的视觉效果' },
    ],
    metaName: '记忆配对游戏',
    metaDescription: '翻开卡片找到配对，挑战你的记忆力',
  },
  {
    id: 'dress-up',
    label: '换装/贴纸',
    emoji: '\u{1F457}',
    description: '像 TikTok "虚拟换装" — 给角色搭配服装和配饰',
    requiredModules: ['GameFlow', 'DressUpEngine', 'UIOverlay', 'ResultScreen'],
    inputOptions: ['FaceInput', 'TouchInput'],
    optionalModules: [
      { type: 'SoundFX', label: '音效', description: '换装音效' },
      { type: 'ParticleVFX', label: '粒子特效', description: '换装时的视觉效果' },
    ],
    metaName: '换装游戏',
    metaDescription: '给角色搭配服装和配饰',
  },
  {
    id: 'world-ar',
    label: '世界AR',
    emoji: '\u{1F30D}',
    description: '像 Snapchat "世界镜头" — 在真实环境中放置虚拟物品',
    requiredModules: ['GameFlow', 'PlaneDetection', 'Spawner', 'Collision', 'Scorer', 'UIOverlay', 'ResultScreen'],
    inputOptions: null,
    fixedInput: 'TouchInput',
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定游戏时长' },
      { type: 'Lives', label: '生命系统', description: '错过物品扣除生命' },
      { type: 'ParticleVFX', label: '粒子特效', description: '放置物品时的视觉效果' },
      { type: 'SoundFX', label: '音效', description: '放置和碰撞音效' },
    ],
    metaName: '世界AR游戏',
    metaDescription: '在真实环境中放置虚拟物品来得分',
  },
  {
    id: 'narrative',
    label: '分支叙事',
    emoji: '\u{1F4D6}',
    description: '像 TikTok "命运选择" — 做出选择影响故事走向',
    requiredModules: ['GameFlow', 'BranchStateMachine', 'UIOverlay', 'ResultScreen'],
    inputOptions: null,
    fixedInput: 'TouchInput',
    optionalModules: [
      { type: 'SoundFX', label: '音效', description: '故事推进音效' },
      { type: 'ParticleVFX', label: '粒子特效', description: '选择和结局的视觉效果' },
    ],
    metaName: '分支叙事游戏',
    metaDescription: '做出选择影响故事走向',
  },
  {
    id: 'platformer',
    label: '平台跳跃',
    emoji: '\u{1F3AE}',
    description: '像 Mario — 跳跃、收集金币、躲避障碍的横版闯关',
    requiredModules: ['GameFlow', 'PlayerMovement', 'Jump', 'Gravity', 'StaticPlatform', 'Scorer', 'UIOverlay', 'ResultScreen'],
    inputOptions: ['TouchInput', 'DeviceInput'],
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定闯关时长' },
      { type: 'Lives', label: '生命系统', description: '碰到危险物扣除生命' },
      { type: 'CoyoteTime', label: '土狼时间', description: '离开平台后短暂仍可跳跃' },
      { type: 'Dash', label: '冲刺', description: '双击快速冲刺' },
      { type: 'Collectible', label: '收集物', description: '收集金币和道具' },
      { type: 'Hazard', label: '危险物', description: '尖刺、火焰等障碍' },
      { type: 'MovingPlatform', label: '移动平台', description: '来回移动的平台' },
      { type: 'CrumblingPlatform', label: '碎裂平台', description: '踩上后会碎裂的平台' },
      { type: 'Checkpoint', label: '检查点', description: '死亡后从检查点重生' },
      { type: 'IFrames', label: '无敌帧', description: '受伤后短暂无敌' },
      { type: 'Knockback', label: '击退', description: '受伤后被击退' },
      { type: 'CameraFollow', label: '镜头跟随', description: '镜头跟随玩家移动' },
      { type: 'ParticleVFX', label: '粒子特效', description: '跳跃和收集的视觉效果' },
      { type: 'SoundFX', label: '音效', description: '跳跃和碰撞音效' },
    ],
    metaName: '平台跳跃游戏',
    metaDescription: '跳跃闯关，收集金币，躲避障碍',
  },
  {
    id: 'action-rpg',
    label: '动作RPG',
    emoji: '\u2694\uFE0F',
    description: '像暗黑破坏神 — 射击敌人、升级角色、收集装备',
    requiredModules: ['GameFlow', 'PlayerMovement', 'Gravity', 'Jump', 'Projectile', 'Aim', 'EnemyAI', 'WaveSpawner', 'Health', 'LevelUp', 'EnemyDrop', 'Collision', 'Scorer', 'Lives', 'UIOverlay', 'ResultScreen'],
    inputOptions: ['TouchInput', 'FaceInput'],
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定游戏时长' },
      { type: 'StatusEffect', label: '状态效果', description: '中毒、燃烧等持续效果' },
      { type: 'EquipmentSlot', label: '装备系统', description: '穿戴和更换装备' },
      { type: 'SkillTree', label: '技能树', description: '解锁和升级技能' },
      { type: 'Shield', label: '护盾', description: '抵挡敌人攻击' },
      { type: 'IFrames', label: '无敌帧', description: '受伤后短暂无敌' },
      { type: 'Knockback', label: '击退', description: '受伤后被击退' },
      { type: 'DifficultyRamp', label: '难度递增', description: '随时间增加敌人数量和强度' },
      { type: 'ComboSystem', label: '连击系统', description: '连续击杀获得分数加成' },
      { type: 'ParticleVFX', label: '粒子特效', description: '击中和爆炸效果' },
      { type: 'SoundFX', label: '音效', description: '战斗和升级音效' },
    ],
    metaName: '动作RPG游戏',
    metaDescription: '射击敌人，升级角色，收集装备',
  },
];

export { GAME_TYPES };
export const GAME_TYPE_MAP = new Map<string, GameTypeDef>(GAME_TYPES.map((gt) => [gt.id, gt]));

/* ------------------------------------------------------------------ */
/*  Input method metadata                                              */
/* ------------------------------------------------------------------ */

interface InputDef {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

const INPUT_METHODS: InputDef[] = [
  { id: 'FaceInput', label: '面部追踪', emoji: '\u{1F4F7}', description: '用脸部控制游戏角色' },
  { id: 'HandInput', label: '手势控制', emoji: '\u{1F91A}', description: '用手势操作' },
  { id: 'TouchInput', label: '触屏点击', emoji: '\u{1F446}', description: '点击/滑动屏幕' },
  { id: 'AudioInput', label: '声音控制', emoji: '\u{1F3A4}', description: '吹气/声音触发' },
  { id: 'DeviceInput', label: '重力感应', emoji: '\u{1F4F1}', description: '倾斜设备控制' },
];

const INPUT_METHOD_MAP = new Map<string, InputDef>(INPUT_METHODS.map((im) => [im.id, im]));

/* ------------------------------------------------------------------ */
/*  Duration options                                                   */
/* ------------------------------------------------------------------ */

interface DurationDef {
  id: string;
  label: string;
  emoji: string;
  seconds: number;
}

const DURATION_OPTIONS: DurationDef[] = [
  { id: '15', label: '15秒', emoji: '\u23F1', seconds: 15 },
  { id: '30', label: '30秒', emoji: '\u23F1', seconds: 30 },
  { id: '60', label: '60秒', emoji: '\u23F1', seconds: 60 },
  { id: '0', label: '无限制（生命模式）', emoji: '\u267E', seconds: 0 },
];

/* ------------------------------------------------------------------ */
/*  Theme choices                                                      */
/* ------------------------------------------------------------------ */

const THEME_CHOICES: WizardChoice[] = [
  { id: 'fruit', label: '水果派对', emoji: '\u{1F34E}' },
  { id: 'space', label: '太空冒险', emoji: '\u{1F680}' },
  { id: 'ocean', label: '海洋探索', emoji: '\u{1F30A}' },
  { id: 'halloween', label: '万圣节', emoji: '\u{1F383}' },
  { id: 'candy', label: '糖果世界', emoji: '\u{1F36C}' },
];

/* ------------------------------------------------------------------ */
/*  Character choices                                                   */
/* ------------------------------------------------------------------ */

const CHARACTER_CHOICES: WizardChoice[] = [
  { id: 'basket', label: '\u{1F9FA} \u7BEE\u5B50', emoji: '\u{1F9FA}' },
  { id: 'cat', label: '\u{1F431} \u732B\u54AA', emoji: '\u{1F431}' },
  { id: 'rocket', label: '\u{1F680} \u98DE\u8239', emoji: '\u{1F680}' },
  { id: 'warrior', label: '\u{1F93A} \u6218\u58EB', emoji: '\u{1F93A}' },
  { id: 'fish', label: '\u{1F420} \u5C0F\u9C7C', emoji: '\u{1F420}' },
  { id: 'pumpkin', label: '\u{1F383} \u5357\u74DC', emoji: '\u{1F383}' },
];

/** Emoji lookup for character IDs */
const CHARACTER_EMOJI_MAP: Record<string, string> = {
  basket: '\u{1F9FA}',
  cat: '\u{1F431}',
  rocket: '\u{1F680}',
  warrior: '\u{1F93A}',
  fish: '\u{1F420}',
  pumpkin: '\u{1F383}',
};

/** Default theme per game type */
export const DEFAULT_THEME_FOR_GAME: Record<string, string> = {
  catch: 'fruit',
  dodge: 'space',
  shooting: 'space',
  tap: 'candy',
  runner: 'ocean',
  quiz: 'fruit',
  expression: 'halloween',
  'random-wheel': 'candy',
  gesture: 'ocean',
  rhythm: 'halloween',
  puzzle: 'candy',
  'dress-up': 'fruit',
  'world-ar': 'space',
  narrative: 'halloween',
  platformer: 'candy',
  'action-rpg': 'space',
};

/* ------------------------------------------------------------------ */
/*  Default params per module type                                     */
/* ------------------------------------------------------------------ */

function defaultParamsForModule(moduleType: string, gameType: string): Record<string, unknown> {
  return getModuleParams(gameType, moduleType);
}

/* ------------------------------------------------------------------ */
/*  GameWizard                                                         */
/* ------------------------------------------------------------------ */

export class GameWizard {
  private state: WizardState = {
    step: 'idle',
    gameType: null,
    inputMethod: null,
    duration: null,
    theme: null,
    artStyle: null,
    character: null,
    optionalModules: {},
    currentOptionalIndex: 0,
    wantBackground: false,
  };

  /** Start the wizard from scratch. Returns the first question. */
  private static readonly STEP_ORDER: WizardStep[] = [
    'game_type', 'input_method', 'duration', 'theme', 'art_style',
    'character', 'optional_modules', 'background',
  ];

  /** Clear all wizard state from the given step onward (inclusive). */
  private clearStateFrom(step: WizardStep): void {
    const idx = GameWizard.STEP_ORDER.indexOf(step);
    if (idx <= 0) { this.state.gameType = null; }
    if (idx <= 1) { this.state.inputMethod = null; }
    if (idx <= 2) { this.state.duration = null; }
    if (idx <= 3) { this.state.theme = null; }
    if (idx <= 4) { this.state.artStyle = null; }
    if (idx <= 5) { this.state.character = null; }
    if (idx <= 6) { this.state.optionalModules = {}; this.state.currentOptionalIndex = 0; }
    if (idx <= 7) { this.state.wantBackground = false; }
    this.state.step = step;
  }

  /** Get the question for a given step. */
  private getQuestionForStep(step: WizardStep): WizardQuestion | null {
    switch (step) {
      case 'game_type': return this.getGameTypeQuestion();
      case 'input_method': return this.getInputMethodQuestion();
      case 'duration': return this.getDurationQuestion();
      case 'theme': return this.getThemeQuestion();
      case 'art_style': return this.getArtStyleQuestion();
      case 'character': return this.getCharacterQuestion();
      case 'optional_modules': return this.getNextOptionalQuestion();
      case 'background': return this.getBackgroundQuestion();
      default: return null;
    }
  }

  start(): WizardQuestion {
    this.clearStateFrom('game_type');
    return this.getGameTypeQuestion();
  }

  /** Rewind the wizard to a previous step. Returns the question for that step. */
  goToStep(step: WizardStep): WizardQuestion | null {
    this.clearStateFrom(step);
    return this.getQuestionForStep(step);
  }

  /** Whether the wizard is currently active (awaiting user input). */
  isActive(): boolean {
    return this.state.step !== 'idle' && this.state.step !== 'done';
  }

  /** Get current step (useful for external inspection). */
  getStep(): WizardStep {
    return this.state.step;
  }

  /**
   * Return a partial GameConfig based on choices made so far.
   * This enables progressive preview — the canvas updates after each wizard step.
   */
  getPartialConfig(): GameConfig | null {
    if (this.state.step === 'idle') return null;

    const gameType = this.state.gameType;
    if (!gameType) return null;

    const gameDef = GAME_TYPE_MAP.get(gameType);
    if (!gameDef) return null;

    const modules: ModuleConfig[] = [];
    const typeCounts = new Map<string, number>();

    const addModule = (type: string, extraParams?: Record<string, unknown>) => {
      const count = (typeCounts.get(type) ?? 0) + 1;
      typeCounts.set(type, count);
      const id = `${type.toLowerCase()}_${count}`;
      const baseParams = defaultParamsForModule(type, gameType);
      modules.push({
        id,
        type,
        enabled: true,
        params: extraParams ? { ...baseParams, ...extraParams } : baseParams,
      });
    };

    // Always add required modules once game type is chosen
    for (const modType of gameDef.requiredModules) {
      addModule(modType);
    }

    // Add input module if selected
    if (this.state.inputMethod) {
      addModule(this.state.inputMethod);
    }

    // Add timer if duration selected and > 0
    if (this.state.duration && this.state.duration > 0) {
      addModule('Timer', { duration: this.state.duration });
    }

    // Add accepted optional modules
    for (const [type, accepted] of Object.entries(this.state.optionalModules)) {
      if (accepted) {
        // Skip Timer if already added above
        if (type === 'Timer') continue;
        addModule(type);
      }
    }

    // Resolve theme
    const themeId = this.state.theme
      ?? DEFAULT_THEME_FOR_GAME[gameType]
      ?? 'fruit';

    // Resolve player emoji from character selection
    const playerEmoji = this.state.character
      ? CHARACTER_EMOJI_MAP[this.state.character] ?? undefined
      : undefined;

    return {
      version: '1.0.0',
      meta: {
        name: gameDef.metaName ?? '\u6E38\u620F',
        description: gameDef.metaDescription ?? '',
        thumbnail: null,
        createdAt: new Date().toISOString(),
        theme: themeId,
        ...(this.state.artStyle ? { artStyle: this.state.artStyle } : {}),
        ...(playerEmoji ? { playerEmoji } : {}),
      },
      canvas: { width: 1080, height: 1920 },
      modules,
      assets: this.state.wantBackground
        ? { background: { type: 'background' as const, src: '' } }
        : {},
    };
  }

  /** Process a user answer for the current step. */
  answer(choiceId: string): WizardAnswerResult {
    switch (this.state.step) {
      case 'game_type': {
        this.state.gameType = choiceId;
        // Always ask for input method — all inputs can be combined with all game types
        this.state.step = 'input_method';
        return { question: this.getInputMethodQuestion(), config: null, summary: '' };
      }

      case 'input_method': {
        this.state.inputMethod = choiceId;
        return this.skipDurationOrAsk(this.state.gameType ?? '');
      }

      case 'duration': {
        this.state.duration = parseInt(choiceId, 10);
        // After duration, go to theme selection
        this.state.step = 'theme';
        return { question: this.getThemeQuestion(), config: null, summary: '' };
      }

      case 'theme': {
        this.state.theme = choiceId;
        this.state.step = 'art_style';
        return { question: this.getArtStyleQuestion(), config: null, summary: '' };
      }

      case 'art_style': {
        this.state.artStyle = choiceId;
        this.state.step = 'character';
        return { question: this.getCharacterQuestion(), config: null, summary: '' };
      }

      case 'character': {
        this.state.character = choiceId;
        this.state.step = 'optional_modules';
        this.state.currentOptionalIndex = 0;
        const nextOptionalAfterChar = this.getNextOptionalQuestion();
        if (nextOptionalAfterChar) {
          return { question: nextOptionalAfterChar, config: null, summary: '' };
        }
        // No optional modules — ask about background
        this.state.step = 'background';
        return { question: this.getBackgroundQuestion(), config: null, summary: '' };
      }

      case 'optional_modules': {
        const optionals = this.getOptionalModules();
        if (this.state.currentOptionalIndex < optionals.length) {
          const moduleType = optionals[this.state.currentOptionalIndex].type;
          this.state.optionalModules[moduleType] = choiceId === 'yes';
          this.state.currentOptionalIndex++;
        }
        const next = this.getNextOptionalQuestion();
        if (next) {
          return { question: next, config: null, summary: '' };
        }
        // All optional modules asked — ask about background
        this.state.step = 'background';
        return { question: this.getBackgroundQuestion(), config: null, summary: '' };
      }

      case 'background': {
        this.state.wantBackground = choiceId === 'yes';
        this.state.step = 'done';
        return { question: null, config: this.buildConfig(), summary: this.buildSummary() };
      }

      default:
        return { question: null, config: null, summary: '' };
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Duration-skip helper                                             */
  /* ---------------------------------------------------------------- */

  /** Game types that have no timer/duration concept and should skip the duration step. */
  private static readonly NO_DURATION_TYPES = new Set([
    'random-wheel', 'dress-up', 'narrative',
  ]);

  /**
   * After input is resolved, either skip the duration step (for game types
   * that have no timer concept) or ask the user to pick a duration.
   */
  private skipDurationOrAsk(gameType: string): WizardAnswerResult {
    if (GameWizard.NO_DURATION_TYPES.has(gameType)) {
      this.state.duration = 0;
      // Skip to theme step
      this.state.step = 'theme';
      return { question: this.getThemeQuestion(), config: null, summary: '' };
    }
    this.state.step = 'duration';
    return { question: this.getDurationQuestion(), config: null, summary: '' };
  }

  /* ---------------------------------------------------------------- */
  /*  Question builders                                                */
  /* ---------------------------------------------------------------- */

  private getGameTypeQuestion(): WizardQuestion {
    return {
      step: 'game_type',
      question: '你想做什么类型的游戏？',
      choices: GAME_TYPES.map((gt) => ({
        id: gt.id,
        label: gt.label,
        emoji: gt.emoji,
        description: gt.description,
      })),
    };
  }

  private getInputMethodQuestion(): WizardQuestion {
    const choices = INPUT_METHODS.map((im) => ({
      id: im.id,
      label: im.label,
      emoji: im.emoji,
      description: im.description,
    }));
    return {
      step: 'input_method',
      question: '选择控制方式：',
      choices,
    };
  }

  private getDurationQuestion(): WizardQuestion {
    return {
      step: 'duration',
      question: '游戏时长：',
      choices: DURATION_OPTIONS.map((d) => ({
        id: d.id,
        label: d.label,
        emoji: d.emoji,
      })),
    };
  }

  private getThemeQuestion(): WizardQuestion {
    return {
      step: 'theme',
      question: '选择游戏主题：',
      choices: THEME_CHOICES,
    };
  }

  private getArtStyleQuestion(): WizardQuestion {
    return {
      step: 'art_style',
      question: '选择素材画风：',
      choices: [
        { id: 'cartoon', label: '卡通风', emoji: '\u{1F3A8}' },
        { id: 'pixel', label: '像素风', emoji: '\u{1F579}' },
        { id: 'flat', label: '扁平风', emoji: '\u{1F4D0}' },
        { id: 'realistic', label: '写实风', emoji: '\u{1F4F7}' },
        { id: 'watercolor', label: '水彩风', emoji: '\u{1F58C}' },
        { id: 'chibi', label: 'Q版可爱', emoji: '\u{1F431}' },
      ],
    };
  }

  private getCharacterQuestion(): WizardQuestion {
    return {
      step: 'character',
      question: '\u9009\u62E9\u4F60\u7684\u6E38\u620F\u89D2\u8272\uFF1A',
      choices: CHARACTER_CHOICES,
    };
  }

  private getBackgroundQuestion(): WizardQuestion {
    return {
      step: 'background',
      question: '要生成 AI 游戏背景吗？\n根据主题和游戏风格自动生成匹配的背景图',
      choices: [
        { id: 'yes', label: '是，生成背景', emoji: '\u{1F5BC}' },
        { id: 'no', label: '否，使用默认', emoji: '\u274C' },
      ],
    };
  }

  private getOptionalModules(): Array<{ type: string; label: string; description: string }> {
    const gameDef = GAME_TYPE_MAP.get(this.state.gameType ?? '');
    return gameDef?.optionalModules ?? [];
  }

  private getNextOptionalQuestion(): WizardQuestion | null {
    const optionals = this.getOptionalModules();
    const idx = this.state.currentOptionalIndex;
    if (idx >= optionals.length) return null;

    const mod = optionals[idx];
    return {
      step: 'optional_modules',
      question: `要添加「${mod.label}」吗？\n${mod.description}`,
      choices: [
        { id: 'yes', label: '是', emoji: '\u2705' },
        { id: 'no', label: '否', emoji: '\u274C' },
      ],
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Config builder                                                   */
  /* ---------------------------------------------------------------- */

  private buildConfig(): GameConfig {
    const gameDef = GAME_TYPE_MAP.get(this.state.gameType ?? '')!;
    const modules: ModuleConfig[] = [];
    const typeCounts = new Map<string, number>();

    const addModule = (type: string) => {
      const count = (typeCounts.get(type) ?? 0) + 1;
      typeCounts.set(type, count);
      const id = `${type.toLowerCase()}_${count}`;
      modules.push({
        id,
        type,
        enabled: true,
        params: defaultParamsForModule(type, this.state.gameType ?? 'catch'),
      });
    };

    // Required modules
    for (const modType of gameDef.requiredModules) {
      addModule(modType);
    }

    // Input module
    const inputType = this.state.inputMethod ?? gameDef.fixedInput ?? 'TouchInput';
    addModule(inputType);

    // Timer (if duration > 0)
    if (this.state.duration && this.state.duration > 0) {
      const timerCount = (typeCounts.get('Timer') ?? 0) + 1;
      typeCounts.set('Timer', timerCount);
      const id = `timer_${timerCount}`;
      const timerPreset = getModuleParams(this.state.gameType ?? 'catch', 'Timer');
      modules.push({
        id,
        type: 'Timer',
        enabled: true,
        params: { ...timerPreset, duration: this.state.duration },
      });
    }

    // Optional modules the user accepted
    for (const opt of gameDef.optionalModules) {
      if (this.state.optionalModules[opt.type]) {
        // Skip Timer if already added above
        if (opt.type === 'Timer') continue;
        // Skip Lives if duration=0 (infinite = lives mode), auto-add instead
        addModule(opt.type);
      }
    }

    // If duration = 0 and Lives is available but not yet included, add Lives
    if (this.state.duration === 0) {
      const hasLives = modules.some((m) => m.type === 'Lives');
      const livesAvailable = gameDef.optionalModules.some((o) => o.type === 'Lives') ||
        gameDef.requiredModules.includes('Lives');
      if (!hasLives && livesAvailable) {
        addModule('Lives');
      }
    }

    // Remap module events based on chosen input method
    this.remapEventsForInput(modules, inputType);

    // Resolve theme: user selection, or default for game type, or 'fruit'
    const themeId = this.state.theme
      ?? DEFAULT_THEME_FOR_GAME[this.state.gameType ?? '']
      ?? 'fruit';

    // Build input description
    const inputDef = INPUT_METHOD_MAP.get(inputType);
    const inputLabel = inputDef ? inputDef.description : '';

    // Resolve player emoji from character selection
    const playerEmoji = this.state.character
      ? CHARACTER_EMOJI_MAP[this.state.character] ?? undefined
      : undefined;

    return {
      version: '1.0.0',
      meta: {
        name: gameDef.metaName,
        description: inputLabel ? `${inputLabel}\uFF0C${gameDef.metaDescription}` : gameDef.metaDescription,
        thumbnail: null,
        createdAt: new Date().toISOString(),
        theme: themeId,
        ...(this.state.artStyle ? { artStyle: this.state.artStyle } : {}),
        ...(playerEmoji ? { playerEmoji } : {}),
      },
      canvas: { width: 1080, height: 1920 },
      modules,
      assets: this.state.wantBackground
        ? { background: { type: 'background' as const, src: '' } }
        : {},
    };
  }

  /* ---------------------------------------------------------------- */
  /* ---------------------------------------------------------------- */
  /*  Event remapping for input method                                  */
  /* ---------------------------------------------------------------- */

  /**
   * Remap trigger/movement events on modules based on the chosen input method.
   * This allows any input to work with any game type by adjusting event names.
   */
  private remapEventsForInput(modules: ModuleConfig[], inputType: string): void {
    const findMod = (type: string) => modules.find((m) => m.type === type);

    // Helper to remap action triggers for a given input type
    const remapAction = (event: string) => {
      const jump = findMod('Jump');
      if (jump) jump.params.triggerEvent = event;
      const beatMap = findMod('BeatMap');
      if (beatMap) beatMap.params.inputEvent = event;
    };

    const remapDash = (event: string) => {
      const dash = findMod('Dash');
      if (dash) dash.params.triggerEvent = event;
    };

    if (inputType === 'FaceInput') {
      const playerMov = findMod('PlayerMovement');
      if (playerMov) playerMov.params.continuousEvent = 'input:face:move';
      remapAction('input:face:mouthOpen');
      remapDash('input:face:blink');
    } else if (inputType === 'HandInput') {
      const playerMov = findMod('PlayerMovement');
      if (playerMov) playerMov.params.continuousEvent = 'input:hand:move';
      remapAction('input:hand:gesture');
      remapDash('input:hand:gesture');
    } else if (inputType === 'DeviceInput') {
      const playerMov = findMod('PlayerMovement');
      if (playerMov) playerMov.params.continuousEvent = 'input:device:tilt';
      remapAction('input:device:shake');
      remapDash('input:device:shake');
    } else if (inputType === 'AudioInput') {
      const audioMod = findMod('AudioInput');
      if (audioMod) audioMod.params.mode = 'frequency';
      const playerMov = findMod('PlayerMovement');
      if (playerMov) playerMov.params.continuousEvent = 'input:audio:frequency';
      remapAction('input:audio:volume');
      remapDash('input:audio:blow');
    }
    // TouchInput: uses defaults (input:touch:tap, input:touch:swipe:left/right) — no remap needed
  }

  /*  Summary builder                                                  */
  /* ---------------------------------------------------------------- */

  private buildSummary(): string {
    const gameDef = GAME_TYPE_MAP.get(this.state.gameType ?? '');
    const inputDef = INPUT_METHOD_MAP.get(this.state.inputMethod ?? '');
    const lines: string[] = [];

    lines.push(`${gameDef?.emoji ?? ''} 游戏类型：${gameDef?.label ?? this.state.gameType}`);
    lines.push(`${inputDef?.emoji ?? ''} 控制方式：${inputDef?.label ?? this.state.inputMethod}`);

    if (this.state.duration && this.state.duration > 0) {
      lines.push(`\u23F1 游戏时长：${this.state.duration}秒`);
    } else {
      lines.push('\u267E 游戏时长：无限制（生命模式）');
    }

    // Theme
    const themeChoice = THEME_CHOICES.find((t) => t.id === this.state.theme);
    if (themeChoice) {
      lines.push(`${themeChoice.emoji} \u6E38\u620F\u4E3B\u9898\uFF1A${themeChoice.label}`);
    }

    // Character
    const charChoice = CHARACTER_CHOICES.find((c) => c.id === this.state.character);
    if (charChoice) {
      lines.push(`${charChoice.emoji} \u6E38\u620F\u89D2\u8272\uFF1A${charChoice.label}`);
    }

    const enabledOptionals: string[] = [];
    for (const [moduleType, enabled] of Object.entries(this.state.optionalModules)) {
      if (enabled) {
        const opt = gameDef?.optionalModules.find((o) => o.type === moduleType);
        enabledOptionals.push(opt?.label ?? moduleType);
      }
    }

    if (enabledOptionals.length > 0) {
      lines.push(`\u2728 \u9644\u52A0\u6A21\u5757\uFF1A${enabledOptionals.join('\u3001')}`);
    }

    if (this.state.wantBackground) {
      lines.push('\u{1F5BC} AI \u80CC\u666F\uFF1A\u662F');
    }

    lines.push('\n\u2705 \u6E38\u620F\u914D\u7F6E\u5DF2\u751F\u6210\uFF01\u4F60\u53EF\u4EE5\u5728\u53F3\u4FA7\u9762\u677F\u4E2D\u67E5\u770B\u548C\u8C03\u6574\u5404\u6A21\u5757\u53C2\u6570\u3002');

    return lines.join('\n');
  }
}
