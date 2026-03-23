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
  | 'optional_modules'
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
  optionalModules: Record<string, boolean>;
  currentOptionalIndex: number;
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
    description: '像 TikTok "射击挑战" — 瞄准并击中移动的靶子',
    requiredModules: ['GameFlow', 'Spawner', 'Collision', 'Scorer', 'UIOverlay', 'ResultScreen'],
    inputOptions: ['FaceInput', 'TouchInput'],
    optionalModules: [
      { type: 'Timer', label: '倒计时', description: '限定游戏时长' },
      { type: 'Lives', label: '生命系统', description: '被敌人击中扣除生命' },
      { type: 'DifficultyRamp', label: '难度递增', description: '随时间增加敌人速度和数量' },
      { type: 'ComboSystem', label: '连击系统', description: '连续击中获得分数加成' },
      { type: 'ParticleVFX', label: '粒子特效', description: '击中时的爆炸效果' },
      { type: 'SoundFX', label: '音效', description: '射击和爆炸音效' },
    ],
    metaName: '射击游戏',
    metaDescription: '射击移动的目标，获取高分',
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
];

const GAME_TYPE_MAP = new Map<string, GameTypeDef>(GAME_TYPES.map((gt) => [gt.id, gt]));

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
    optionalModules: {},
    currentOptionalIndex: 0,
  };

  /** Start the wizard from scratch. Returns the first question. */
  start(): WizardQuestion {
    this.state = {
      step: 'game_type',
      gameType: null,
      inputMethod: null,
      duration: null,
      optionalModules: {},
      currentOptionalIndex: 0,
    };
    return this.getGameTypeQuestion();
  }

  /** Whether the wizard is currently active (awaiting user input). */
  isActive(): boolean {
    return this.state.step !== 'idle' && this.state.step !== 'done';
  }

  /** Get current step (useful for external inspection). */
  getStep(): WizardStep {
    return this.state.step;
  }

  /** Process a user answer for the current step. */
  answer(choiceId: string): WizardAnswerResult {
    switch (this.state.step) {
      case 'game_type': {
        this.state.gameType = choiceId;
        const gameDef = GAME_TYPE_MAP.get(choiceId);
        // If input is fixed for this game type, skip the input step
        if (gameDef && !gameDef.inputOptions) {
          this.state.inputMethod = gameDef.fixedInput ?? 'TouchInput';
          this.state.step = 'duration';
          // If random-wheel, skip duration too (no timer concept)
          if (choiceId === 'random-wheel') {
            this.state.duration = 0;
            this.state.step = 'optional_modules';
            this.state.currentOptionalIndex = 0;
            const nextOptional = this.getNextOptionalQuestion();
            if (nextOptional) {
              return { question: nextOptional, config: null, summary: '' };
            }
            // No optional modules either — generate directly
            this.state.step = 'done';
            return { question: null, config: this.buildConfig(), summary: this.buildSummary() };
          }
          return { question: this.getDurationQuestion(), config: null, summary: '' };
        }
        this.state.step = 'input_method';
        return { question: this.getInputMethodQuestion(), config: null, summary: '' };
      }

      case 'input_method': {
        this.state.inputMethod = choiceId;
        this.state.step = 'duration';
        return { question: this.getDurationQuestion(), config: null, summary: '' };
      }

      case 'duration': {
        this.state.duration = parseInt(choiceId, 10);
        this.state.step = 'optional_modules';
        this.state.currentOptionalIndex = 0;
        const nextOptional = this.getNextOptionalQuestion();
        if (nextOptional) {
          return { question: nextOptional, config: null, summary: '' };
        }
        // No optional modules — done
        this.state.step = 'done';
        return { question: null, config: this.buildConfig(), summary: this.buildSummary() };
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
        // All optional modules asked — generate config
        this.state.step = 'done';
        return { question: null, config: this.buildConfig(), summary: this.buildSummary() };
      }

      default:
        return { question: null, config: null, summary: '' };
    }
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
    const gameDef = GAME_TYPE_MAP.get(this.state.gameType ?? '');
    const allowed = gameDef?.inputOptions ?? INPUT_METHODS.map((im) => im.id);
    const choices = INPUT_METHODS.filter((im) => allowed.includes(im.id)).map((im) => ({
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

    // Build input description
    const inputDef = INPUT_METHOD_MAP.get(inputType);
    const inputLabel = inputDef ? inputDef.description : '';

    return {
      version: '1.0.0',
      meta: {
        name: gameDef.metaName,
        description: inputLabel ? `${inputLabel}，${gameDef.metaDescription}` : gameDef.metaDescription,
        thumbnail: null,
        createdAt: new Date().toISOString(),
      },
      canvas: { width: 1080, height: 1920 },
      modules,
      assets: {},
    };
  }

  /* ---------------------------------------------------------------- */
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

    const enabledOptionals: string[] = [];
    for (const [moduleType, enabled] of Object.entries(this.state.optionalModules)) {
      if (enabled) {
        const opt = gameDef?.optionalModules.find((o) => o.type === moduleType);
        enabledOptionals.push(opt?.label ?? moduleType);
      }
    }

    if (enabledOptionals.length > 0) {
      lines.push(`\u2728 附加模块：${enabledOptionals.join('、')}`);
    }

    lines.push('\n\u2705 游戏配置已生成！你可以在右侧面板中查看和调整各模块参数。');

    return lines.join('\n');
  }
}
