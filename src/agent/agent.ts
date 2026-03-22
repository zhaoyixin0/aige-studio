import { SkillLoader } from './skill-loader.ts';
import { IntentParser } from './intent-parser.ts';
import { RecipeGenerator } from './recipe-generator.ts';
import { Recommender } from './recommender.ts';
import { tryLocalMatch } from './local-patterns.ts';
import type { GameConfig } from '@/engine/core/index.ts';

export interface AgentResponse {
  message: string;
  config: GameConfig | null;
  suggestions: Array<{ moduleType: string; reason: string }>;
}

export class Agent {
  private skillLoader = new SkillLoader();
  private intentParser: IntentParser;
  private recipeGenerator: RecipeGenerator;
  private recommender: Recommender;

  constructor(apiKey: string) {
    this.intentParser = new IntentParser(apiKey);
    this.recipeGenerator = new RecipeGenerator(apiKey);
    this.recommender = new Recommender(apiKey);
  }

  async process(
    userMessage: string,
    currentConfig: GameConfig | null,
  ): Promise<AgentResponse> {
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
        skills = await this.skillLoader.loadForGameCreation(intent.gameType);
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
