import { SkillLoader } from './skill-loader.ts';
import { IntentParser } from './intent-parser.ts';
import { RecipeGenerator } from './recipe-generator.ts';
import { Recommender } from './recommender.ts';
import { GuidedCreator } from './guided-creator.ts';
import { tryLocalMatch } from './local-patterns.ts';
import { GameWizard, GAME_TYPE_MAP, DEFAULT_THEME_FOR_GAME } from './wizard.ts';
import type { WizardChoice, WizardQuestion, WizardStep } from './wizard.ts';
import type { GameConfig, ModuleConfig } from '@/engine/core/index.ts';
import { getModuleParams } from './game-presets.ts';

export interface EnhancementSuggestion {
  id: string;
  label: string;
  emoji: string;
  moduleType?: string;
  action?: string;
}

export interface AgentResponse {
  message: string;
  config: GameConfig | null;
  suggestions: Array<{ moduleType: string; reason: string }>;
  wizardChoices?: WizardChoice[];
  wizardStep?: string;
  enhancementSuggestions?: EnhancementSuggestion[];
}

/** Keywords that suggest the user wants to create a new game. */
const CREATE_GAME_PATTERNS = [
  /做.{0,4}游戏/,
  /创建.{0,4}游戏/,
  /新建.{0,4}游戏/,
  /开始创建/,
  /start_wizard/,
  /make.{0,6}game/i,
  /create.{0,6}game/i,
  /new.{0,6}game/i,
];

function looksLikeCreateGame(input: string): boolean {
  return CREATE_GAME_PATTERNS.some((re) => re.test(input));
}

/* ------------------------------------------------------------------ */
/*  Mode B: game type detection from free-text description              */
/* ------------------------------------------------------------------ */

const GAME_KEYWORDS: Record<string, string> = {
  '\u63A5\u6C34\u679C': 'catch', '\u63A5\u4F4F': 'catch', '\u6293': 'catch',
  '\u8E72\u907F': 'dodge', '\u8E72': 'dodge', '\u95EA\u907F': 'dodge',
  '\u70B9\u51FB': 'tap', '\u70B9': 'tap', '\u6233': 'tap',
  '\u5C04\u51FB': 'shooting', '\u6253\u9776': 'shooting', '\u5C04': 'shooting',
  '\u7B54\u9898': 'quiz', '\u95EE\u7B54': 'quiz', '\u77E5\u8BC6': 'quiz',
  '\u8F6C\u76D8': 'random-wheel', '\u62BD\u5956': 'random-wheel',
  '\u8868\u60C5': 'expression', '\u9762\u90E8': 'expression',
  '\u8DD1\u9177': 'runner', '\u5954\u8DD1': 'runner', '\u8DD1': 'runner',
  '\u624B\u52BF': 'gesture', '\u914D\u5BF9': 'puzzle', '\u7FFB\u724C': 'puzzle',
  '\u6362\u88C5': 'dress-up', '\u6545\u4E8B': 'narrative',
};

function detectGameType(message: string): string | null {
  for (const [keyword, type] of Object.entries(GAME_KEYWORDS)) {
    if (message.includes(keyword)) return type;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Enhancement suggestions                                             */
/* ------------------------------------------------------------------ */

const ALL_ENHANCEMENT_SUGGESTIONS: EnhancementSuggestion[] = [
  { id: 'add_combo', label: '\u52A0\u8FDE\u51FB\u7CFB\u7EDF', emoji: '\u{1F31F}', moduleType: 'ComboSystem' },
  { id: 'add_difficulty', label: '\u52A0\u96BE\u5EA6\u9012\u589E', emoji: '\u{1F4C8}', moduleType: 'DifficultyRamp' },
  { id: 'change_theme', label: '\u6362\u4E3B\u9898', emoji: '\u{1F3A8}', action: 'change_theme' },
  { id: 'adjust_speed', label: '\u8C03\u901F\u5EA6', emoji: '\u26A1', action: 'adjust_speed' },
  { id: 'adjust_duration', label: '\u8C03\u65F6\u957F', emoji: '\u23F1', action: 'adjust_duration' },
];

function getEnhancementSuggestions(config: GameConfig): EnhancementSuggestion[] {
  const existingTypes = new Set(config.modules.map((m) => m.type));
  return ALL_ENHANCEMENT_SUGGESTIONS.filter((s) => {
    // For module-type suggestions, only show if that module isn't already present
    if (s.moduleType) return !existingTypes.has(s.moduleType);
    // For action suggestions, always show
    return true;
  });
}

/**
 * Auto-build a game config from a detected game type (Mode B).
 * Includes all required modules + recommended optional modules with sensible defaults.
 */
export function autoBuildConfig(gameType: string): GameConfig | null {
  const gameDef = GAME_TYPE_MAP.get(gameType);
  if (!gameDef) return null;

  const modules: ModuleConfig[] = [];
  const typeCounts = new Map<string, number>();

  const addModule = (type: string, extraParams?: Record<string, unknown>) => {
    const count = (typeCounts.get(type) ?? 0) + 1;
    typeCounts.set(type, count);
    const id = `${type.toLowerCase()}_${count}`;
    const baseParams = getModuleParams(gameType, type);
    modules.push({
      id,
      type,
      enabled: true,
      params: extraParams ? { ...baseParams, ...extraParams } : baseParams,
    });
  };

  // Required modules
  for (const modType of gameDef.requiredModules) {
    addModule(modType);
  }

  // Default input
  const inputType = gameDef.fixedInput ?? (gameDef.inputOptions?.[0] ?? 'TouchInput');
  addModule(inputType);

  // Add Timer with a sensible default (30s) for applicable game types
  const NO_DURATION_TYPES = new Set(['random-wheel', 'dress-up', 'narrative']);
  if (!NO_DURATION_TYPES.has(gameType)) {
    addModule('Timer', { duration: 30 });
  }

  // Add recommended optionals (first 2 optional modules as sensible defaults)
  const recommendedOptionals = gameDef.optionalModules.filter(
    (opt) => opt.type !== 'Timer' // Timer already handled
  ).slice(0, 2);
  for (const opt of recommendedOptionals) {
    addModule(opt.type);
  }

  const themeId = DEFAULT_THEME_FOR_GAME[gameType] ?? 'fruit';

  return {
    version: '1.0.0',
    meta: {
      name: gameDef.metaName,
      description: gameDef.metaDescription,
      thumbnail: null,
      createdAt: new Date().toISOString(),
      theme: themeId,
    },
    canvas: { width: 1080, height: 1920 },
    modules,
    assets: {},
  };
}

export class Agent {
  private skillLoader = new SkillLoader();
  private intentParser: IntentParser;
  private recipeGenerator: RecipeGenerator;
  private recommender: Recommender;
  private guidedCreator: GuidedCreator | null = null;
  private wizard = new GameWizard();
  constructor(apiKey: string) {
    this.intentParser = new IntentParser(apiKey);
    this.recipeGenerator = new RecipeGenerator(apiKey);
    this.recommender = new Recommender(apiKey);
    if (apiKey) {
      this.guidedCreator = new GuidedCreator(apiKey);
    }
  }

  /** Start the wizard flow and return the first question. */
  startWizard(): AgentResponse {
    const question = this.wizard.start();
    return this.wizardQuestionToResponse(question);
  }

  /** Check if the wizard is currently active. */
  isWizardActive(): boolean {
    return this.wizard.isActive();
  }

  /** Get partial config from wizard for progressive preview. */
  getWizardPartialConfig(): GameConfig | null {
    return this.wizard.getPartialConfig();
  }

  /** Rewind the wizard to a previous step. Returns the question for that step. */
  goToWizardStep(step: WizardStep): AgentResponse | null {
    const question = this.wizard.goToStep(step);
    if (!question) return null;
    return this.wizardQuestionToResponse(question);
  }

  /** Feed a wizard choice and return the next question or final config. */
  answerWizard(choiceId: string): AgentResponse {
    const result = this.wizard.answer(choiceId);

    if (result.question) {
      return this.wizardQuestionToResponse(result.question);
    }

    // Wizard complete — return generated config with summary + enhancement suggestions
    const enhancementSuggestions = result.config
      ? getEnhancementSuggestions(result.config)
      : [];

    return {
      message: result.summary,
      config: result.config,
      suggestions: [],
      enhancementSuggestions,
    };
  }

  /**
   * Mode B: Detect game type from free-text and auto-build.
   * Returns null if no game type keyword is found.
   */
  /**
   * Mode B: Detect game type from free-text and start the wizard
   * with the game type pre-selected, so the user can choose input method.
   */
  tryModeBAutoBuild(message: string): AgentResponse | null {
    const gameType = detectGameType(message);
    if (!gameType) return null;

    const gameDef = GAME_TYPE_MAP.get(gameType);
    if (!gameDef) return null;

    // Start wizard and pre-fill game type, advance to input selection
    this.wizard.start();
    const result = this.wizard.answer(gameType);

    if (result.question) {
      return {
        message: `\u{1F3AE} \u68C0\u6D4B\u5230\u4F60\u60F3\u505A${gameDef.metaName}\uFF01\n\n${result.question.question}`,
        config: null,
        suggestions: [],
        wizardChoices: result.question.choices,
        wizardStep: result.question.step,
      };
    }

    // Unlikely: wizard completed in one step
    return {
      message: result.summary,
      config: result.config,
      suggestions: [],
      enhancementSuggestions: result.config ? getEnhancementSuggestions(result.config) : [],
    };
  }

  /**
   * Handle an enhancement suggestion click.
   * For module-type enhancements, add the module to the current config.
   */
  handleEnhancement(enhancementId: string, currentConfig: GameConfig): AgentResponse | null {
    const suggestion = ALL_ENHANCEMENT_SUGGESTIONS.find((s) => s.id === enhancementId);
    if (!suggestion) return null;

    if (suggestion.moduleType) {
      // Add the module to the config
      const gameType = this.detectGameTypeFromConfig(currentConfig);
      const newConfig = JSON.parse(JSON.stringify(currentConfig)) as GameConfig;
      const moduleType = suggestion.moduleType;
      const existingCount = newConfig.modules.filter((m) => m.type === moduleType).length;
      const id = `${moduleType.toLowerCase()}_${existingCount + 1}`;
      newConfig.modules.push({
        id,
        type: moduleType,
        enabled: true,
        params: getModuleParams(gameType, moduleType),
      });

      return {
        message: `${suggestion.emoji} \u5DF2\u6DFB\u52A0\u300C${suggestion.label}\u300D\uFF01`,
        config: newConfig,
        suggestions: [],
        enhancementSuggestions: getEnhancementSuggestions(newConfig),
      };
    }

    // For action-based suggestions, return a prompt message
    if (suggestion.action === 'change_theme') {
      return {
        message: '\u{1F3A8} \u8BF7\u9009\u62E9\u65B0\u4E3B\u9898\uFF1A',
        config: null,
        suggestions: [],
        wizardChoices: [
          { id: 'theme_fruit', label: '\u6C34\u679C\u6D3E\u5BF9', emoji: '\u{1F34E}' },
          { id: 'theme_space', label: '\u592A\u7A7A\u5192\u9669', emoji: '\u{1F680}' },
          { id: 'theme_ocean', label: '\u6D77\u6D0B\u63A2\u7D22', emoji: '\u{1F30A}' },
          { id: 'theme_halloween', label: '\u4E07\u5723\u8282', emoji: '\u{1F383}' },
          { id: 'theme_candy', label: '\u7CD6\u679C\u4E16\u754C', emoji: '\u{1F36C}' },
        ],
      };
    }

    if (suggestion.action === 'adjust_speed') {
      return {
        message: '\u26A1 \u8BF7\u544A\u8BC9\u6211\u4F60\u60F3\u8C03\u6574\u7684\u901F\u5EA6\uFF0C\u4F8B\u5982\uFF1A\u201C\u52A0\u5FEB\u901F\u5EA6\u201D \u6216 \u201C\u964D\u4F4E\u901F\u5EA6\u201D',
        config: null,
        suggestions: [],
      };
    }

    if (suggestion.action === 'adjust_duration') {
      return {
        message: '\u23F1 \u8BF7\u9009\u62E9\u6E38\u620F\u65F6\u957F\uFF1A',
        config: null,
        suggestions: [],
        wizardChoices: [
          { id: 'duration_15', label: '15\u79D2', emoji: '\u23F1' },
          { id: 'duration_30', label: '30\u79D2', emoji: '\u23F1' },
          { id: 'duration_60', label: '60\u79D2', emoji: '\u23F1' },
          { id: 'duration_0', label: '\u65E0\u9650\u5236', emoji: '\u267E' },
        ],
      };
    }

    return null;
  }

  /** Continue LLM-guided game creation conversation */
  private async continueGuidedCreation(userMessage: string): Promise<AgentResponse> {
    if (!this.guidedCreator) {
      return this.startWizard();
    }

    const result = await this.guidedCreator.chat(userMessage);

    const response: AgentResponse = {
      message: result.message,
      config: result.config,
      suggestions: [],
    };

    // Convert quick replies to wizard-style choice buttons
    if (result.quickReplies && result.quickReplies.length > 0) {
      response.wizardChoices = result.quickReplies.map((r) => ({
        id: r.id,
        label: r.label,
        emoji: r.emoji,
      }));
    }

    if (result.config) {
      response.enhancementSuggestions = getEnhancementSuggestions(result.config);
    }

    return response;
  }

  private detectGameTypeFromConfig(config: GameConfig): string {
    // Heuristic: look at module types to guess game type
    const moduleTypes = new Set(config.modules.map((m) => m.type));
    if (moduleTypes.has('QuizEngine')) return 'quiz';
    if (moduleTypes.has('Runner')) return 'runner';
    if (moduleTypes.has('Randomizer')) return 'random-wheel';
    if (moduleTypes.has('ExpressionDetector')) return 'expression';
    if (moduleTypes.has('GestureMatch')) return 'gesture';
    if (moduleTypes.has('BeatMap')) return 'rhythm';
    if (moduleTypes.has('MatchEngine')) return 'puzzle';
    if (moduleTypes.has('DressUpEngine')) return 'dress-up';
    if (moduleTypes.has('PlaneDetection')) return 'world-ar';
    if (moduleTypes.has('BranchStateMachine')) return 'narrative';
    if (moduleTypes.has('Lives') && moduleTypes.has('Spawner')) return 'dodge';
    if (moduleTypes.has('Spawner') && moduleTypes.has('Collision')) return 'catch';
    return 'catch';
  }

  async process(
    userMessage: string,
    currentConfig: GameConfig | null,
  ): Promise<AgentResponse> {
    // If the wizard is active, treat the text input as a choice id fallback
    if (this.wizard.isActive()) {
      return this.answerWizard(userMessage.trim());
    }

    // If guided creator is in an active conversation, continue it
    if (this.guidedCreator?.isActive()) {
      return this.continueGuidedCreation(userMessage);
    }

    // Check if user wants to create a game
    if (looksLikeCreateGame(userMessage)) {
      // If API key available, use LLM-guided creation
      if (this.guidedCreator) {
        return this.continueGuidedCreation(userMessage);
      }
      // No API key — fall back to wizard
      return this.startWizard();
    }

    // Mode B: detect game type from free-text description
    const gameType = detectGameType(userMessage);
    if (gameType) {
      if (this.guidedCreator) {
        // LLM-guided: start conversation with the game description
        return this.continueGuidedCreation(userMessage);
      }
      // No API key: redirect to wizard with game type pre-filled
      const modeBResult = this.tryModeBAutoBuild(userMessage);
      if (modeBResult) return modeBResult;
    }

    // Step 0: Local pattern match (no API call)
    if (currentConfig) {
      const localMatch = tryLocalMatch(userMessage, currentConfig);
      if (localMatch) {
        return this.applyLocalMatch(localMatch, currentConfig);
      }
    }

    // Step 1: Intent parsing
    const intent = await this.intentParser.parse(userMessage, currentConfig);

    // Step 2: Load relevant skills
    let skills = '';
    try {
      if (intent.intent === 'create_game' && intent.gameType) {
        // Pre-fill game type if detected, then continue wizard from input selection
        const modeBResult = this.tryModeBAutoBuild(userMessage);
        if (modeBResult) return modeBResult;
        return this.startWizard();
      } else if (intent.intent === 'add_module' && intent.targetModule) {
        skills = await this.skillLoader.loadForModuleAdd(intent.targetModule);
      }
    } catch {
      // Skills not found -- proceed without
    }

    // Step 3: Generate/update config
    if (intent.intent === 'ask_question') {
      return { message: '让我想想...', config: null, suggestions: [] };
    }

    const result = await this.recipeGenerator.generate(
      intent,
      currentConfig,
      skills,
    );

    // Step 4: Get recommendations
    let suggestions: Array<{ moduleType: string; reason: string }> = [];
    try {
      const recSkills = await this.skillLoader.loadForRecommendation();
      suggestions = await this.recommender.suggest(result.config, recSkills);
    } catch {
      // Recommendations failed -- not critical
    }

    return {
      message: result.message,
      config: result.config,
      suggestions,
    };
  }

  private wizardQuestionToResponse(question: WizardQuestion): AgentResponse {
    return {
      message: question.question,
      config: null,
      suggestions: [],
      wizardChoices: question.choices,
      wizardStep: question.step,
    };
  }

  private applyLocalMatch(
    match: {
      type: string;
      moduleId: string;
      param?: string;
      value?: unknown;
      message: string;
    },
    config: GameConfig,
  ): AgentResponse {
    // Apply local change directly to config (deep clone)
    const newConfig = JSON.parse(JSON.stringify(config)) as GameConfig;

    if (match.type === 'update_param' && match.moduleId && match.param) {
      const mod = newConfig.modules.find((m) => m.id === match.moduleId);
      if (mod) {
        mod.params[match.param] = match.value;
      }
    } else if (match.type === 'enable_module') {
      const mod = newConfig.modules.find((m) => m.id === match.moduleId);
      if (mod) mod.enabled = true;
    } else if (match.type === 'disable_module') {
      const mod = newConfig.modules.find((m) => m.id === match.moduleId);
      if (mod) mod.enabled = false;
    }

    return { message: match.message, config: newConfig, suggestions: [] };
  }
}
