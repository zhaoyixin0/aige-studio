/**
 * Pure helper functions extracted from conversation-agent.ts.
 * Keeps the ConversationAgent class file focused on stateful agent logic.
 */
import type { GameConfig } from '@/engine/core/index.ts';
import type { AssetEntry } from '@/engine/core/types.ts';
import type { ChatBlock, ParamCardField } from './conversation-defs.ts';
import type { ValidationIssue } from '@/engine/core/config-validator.ts';
import { getModuleParams } from './game-presets.ts';
import { SkillLoader } from './skill-loader.ts';
import {
  type Chip,
  type ConfigChange,
  SYSTEM_PROMPT_BASE,
  ALL_MODULE_SUGGESTIONS,
  PRIORITY_BY_CATEGORY,
  getGameCategory,
  buildParameterRegistrySummary,
} from './conversation-defs.ts';

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

    case 'set_asset_description': {
      if (
        typeof change.asset_id !== 'string' ||
        change.asset_id.length === 0 ||
        typeof change.description !== 'string'
      ) {
        return config;
      }
      const MAX_DESC = 300;
      const desc = change.description.slice(0, MAX_DESC);
      const prev = config.meta.assetDescriptions ?? {};
      return {
        ...config,
        meta: {
          ...config.meta,
          assetDescriptions: {
            ...prev,
            [change.asset_id]: desc,
          },
        },
      };
    }

    default:
      return config;
  }
}

/* ------------------------------------------------------------------ */
/*  Pure function: map validation warnings to actionable chips         */
/* ------------------------------------------------------------------ */

/**
 * Convert ValidationIssue warnings into actionable Chip suggestions.
 * Each chip gives the user a one-click path to resolve the issue.
 *
 * @param warnings - Readonly array of validation warnings
 * @param maxChips - Maximum number of chips to return (default 3)
 */
export function mapWarningsToChips(
  warnings: readonly ValidationIssue[],
  maxChips = 3,
): Chip[] {
  const chips: Chip[] = [];
  const seen = new Set<string>();

  for (const w of warnings) {
    if (chips.length >= maxChips) break;

    let chip: Chip | null = null;
    switch (w.category) {
      case 'missing-input':
        chip = { id: 'add:TouchInput', label: '添加输入模块', emoji: '👆' };
        break;
      case 'event-chain-break':
        chip = { id: 'fix:event-chain', type: 'board_mode' as const, label: '打开调试面板', emoji: '🔧' };
        break;
      case 'module-conflict':
        chip = { id: `remove:${w.moduleId}`, label: '移除重复模块', emoji: '🗑️' };
        break;
      case 'invalid-param':
        chip = { id: 'fix:params', type: 'board_mode' as const, label: '调整参数', emoji: '🎛️' };
        break;
      default:
        break;
    }

    if (chip && !seen.has(chip.id)) {
      seen.add(chip.id);
      chips.push(chip);
    }
  }

  return chips;
}

/* ------------------------------------------------------------------ */
/*  Pure function: build param-card ChatBlock from live GameConfig     */
/* ------------------------------------------------------------------ */

export function mapConfigToParamCard(
  config: GameConfig,
  category?: string,
): Extract<ChatBlock, { kind: 'param-card' }> {
  const fields: ParamCardField[] = [];

  // Timer duration
  const timer = config.modules.find((m) => m.type === 'Timer');
  if (timer && typeof timer.params?.duration === 'number') {
    fields.push({
      kind: 'slider',
      key: 'Timer:duration',
      label: '时长',
      value: timer.params.duration,
      min: 10, max: 120, step: 5, unit: '秒',
    });
  }

  // Spawner interval
  const spawner = config.modules.find((m) => m.type === 'Spawner');
  if (spawner && typeof spawner.params?.spawnInterval === 'number') {
    fields.push({
      kind: 'slider',
      key: 'Spawner:spawnInterval',
      label: '生成间隔',
      value: spawner.params.spawnInterval,
      min: 200, max: 3000, step: 100, unit: 'ms',
    });
  }

  // PlayerMovement speed
  const pm = config.modules.find((m) => m.type === 'PlayerMovement');
  if (pm && typeof pm.params?.speed === 'number') {
    fields.push({
      kind: 'slider',
      key: 'PlayerMovement:speed',
      label: '玩家速度',
      value: pm.params.speed,
      min: 100, max: 1500, step: 50,
    });
  }

  // Asset fields for common keys
  const assets = config.assets ?? {};
  for (const assetKey of ['player', 'good_1', 'background']) {
    if (assetKey in assets) {
      fields.push({
        kind: 'asset',
        key: assetKey,
        label: assetKey,
        thumbnail: assets[assetKey]?.src ?? '',
        accept: ['image'],
      });
    }
  }

  return {
    kind: 'param-card',
    title: category ? `${category} 参数` : '游戏参数',
    fields,
  };
}
