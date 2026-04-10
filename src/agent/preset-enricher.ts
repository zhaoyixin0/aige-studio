/**
 * Preset Enricher — P2 async "Skill Pass".
 *
 * After a hero preset is loaded and the baseline config reaches the store,
 * this module asks Claude (via the proxy) to produce a small stylistic diff
 * that refines flavor (pacing, theme, difficulty, enrichment modules like
 * ParticleVFX/SoundFX). The diff is gated by 4 guardrails:
 *
 *   1. Whitelist     — add/remove_module restricted to ENRICHABLE_MODULES.
 *                      Core modules and unknown module types are rejected.
 *   2. Validation    — the diff is applied to a working copy and passed to
 *                      validateConfig; if errors appear, the whole diff is
 *                      rejected.
 *   3. Size cap      — at most MAX_CHANGES (8) survive truncation.
 *   4. Idempotency   — refuses to run on a config already marked as
 *                      `meta.presetEnriched === true`.
 *
 * The enricher never throws. All failure modes (abort, network error,
 * invalid tool input, validation rejection) collapse to `null`, so the
 * caller can simply treat enrichment as optional polish.
 */
import type { GameConfig } from '@/engine/core/index.ts';
import { createClaudeClient } from '@/services/claude-proxy.ts';
import { SkillLoader } from './skill-loader.ts';
import {
  type ConfigChange,
  ALL_MODULES,
} from './conversation-defs.ts';
import { applyConfigChanges } from './conversation-helpers.ts';
import { validateConfig } from '@/engine/core/config-validator.ts';
import { REFINE_PRESET_TOOL } from './conversation-defs.ts';

// ── Public types ──

export interface PresetMeta {
  readonly heroPresetId: string;
  readonly gameType: string;
  readonly concept?: string;
  readonly signatureGoods?: readonly string[];
  readonly signatureBads?: readonly string[];
}

export interface EnrichmentResult {
  readonly changes: ConfigChange[];
  readonly startedAt: number;
  readonly model?: string;
}

// ── Constants ──

export const CORE_MODULES: ReadonlySet<string> = new Set([
  'GameFlow', 'Timer', 'Scorer', 'Lives', 'Collision',
  'Spawner', 'PlayerMovement', 'Runner', 'MatchEngine', 'QuizEngine',
  'Projectile', 'Aim', 'WaveSpawner', 'EnemyAI', 'Health',
  'Gravity', 'Jump', 'StaticPlatform', 'MovingPlatform',
  'TouchInput', 'FaceInput', 'HandInput', 'BodyInput', 'DeviceInput', 'AudioInput',
  'UIOverlay', 'ResultScreen',
]);

export const ENRICHABLE_MODULES: ReadonlySet<string> = new Set([
  'DifficultyRamp', 'Combo', 'ComboSystem', 'PowerUp',
  'ParticleVFX', 'SoundFX', 'FloatText', 'CameraFollow',
  'StatusEffect', 'Shield', 'IFrames', 'Tween', 'BackgroundLayer',
]);

const KNOWN_MODULES: ReadonlySet<string> = new Set(ALL_MODULES);

const MAX_CHANGES = 8;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2048;

// Lazy singleton skill loader — cheap to construct but avoids re-creating
// on every call.
const skillLoader = new SkillLoader();

// ── Public API ──

export async function enrichWithSkill(
  baseConfig: GameConfig,
  presetMeta: PresetMeta,
  signal: AbortSignal,
): Promise<EnrichmentResult | null> {
  // Guardrail 4: idempotency
  if ((baseConfig.meta as Record<string, unknown>).presetEnriched === true) {
    return null;
  }

  // Short-circuit if already aborted
  if (signal.aborted) return null;

  const startedAt = Date.now();

  const rawChanges = await callClaudeForDiff(baseConfig, presetMeta, signal);
  if (rawChanges === null) return null;

  // Guardrail 1: whitelist filter
  const whitelisted = rawChanges.filter(isChangeAllowed);

  // Guardrail 3: truncate
  const truncated = whitelisted.slice(0, MAX_CHANGES);

  // Guardrail 2: validation — only run if there is something to apply
  if (truncated.length > 0) {
    if (!passesValidation(baseConfig, truncated)) {
      return null;
    }
  }

  return {
    changes: truncated,
    startedAt,
    model: CLAUDE_MODEL,
  };
}

// ── Internals ──

const ALLOWED_NON_STRUCTURAL: ReadonlySet<string> = new Set([
  'set_param', 'set_theme', 'set_art_style', 'set_duration', 'set_asset_description',
]);

export function isChangeAllowed(change: ConfigChange): boolean {
  if (change.action === 'add_module' || change.action === 'remove_module') {
    const type = change.module_type;
    if (!type) return false;
    if (CORE_MODULES.has(type)) return false;
    if (!KNOWN_MODULES.has(type)) return false;
    return ENRICHABLE_MODULES.has(type);
  }

  // Only explicitly allowed non-structural actions pass through.
  return ALLOWED_NON_STRUCTURAL.has(change.action);
}

function passesValidation(
  baseConfig: GameConfig,
  changes: ConfigChange[],
): boolean {
  try {
    const projected = applyConfigChanges(baseConfig, changes);
    const report = validateConfig(projected);
    return report.errors.length === 0;
  } catch {
    return false;
  }
}

async function callClaudeForDiff(
  baseConfig: GameConfig,
  presetMeta: PresetMeta,
  signal: AbortSignal,
): Promise<ConfigChange[] | null> {
  let client;
  try {
    client = createClaudeClient();
  } catch {
    return null;
  }

  const systemPrompt = await buildEnricherSystemPrompt(presetMeta);
  const userMessage = buildUserMessage(baseConfig, presetMeta);

  try {
    const response = await client.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        tools: [REFINE_PRESET_TOOL as unknown],
        tool_choice: { type: 'tool', name: 'refine_preset' },
      },
      { signal },
    );

    return extractChanges(response);
  } catch {
    return null;
  }
}

async function buildEnricherSystemPrompt(
  presetMeta: PresetMeta,
): Promise<string> {
  const parts: string[] = [
    '你是 AIGE Studio 的游戏模板风味调优助手（preset enricher）。',
    '用户刚刚点击了一个基线可玩的 hero preset，你的任务是基于 skill 知识做「风味微调」。',
    '',
    '## 严格规则',
    '1. 只做风味调整：参数、时长、主题、画风、素材描述、增强型模块（ParticleVFX/SoundFX/FloatText/CameraFollow/DifficultyRamp/Combo/PowerUp/Tween/BackgroundLayer/StatusEffect/Shield/IFrames）',
    '2. 禁止修改核心模块结构（GameFlow/Timer/Scorer/Lives/Collision/Spawner/PlayerMovement/Input 等）',
    '3. 最多返回 8 条 change',
    '4. 每条 change 必须是可执行的原子操作（set_param / set_duration / set_theme / set_art_style / set_asset_description / add_module / remove_module）',
    '5. 必须通过 refine_preset 工具返回结果，不要写纯文本',
  ];

  try {
    const skillDoc = await skillLoader.loadForConversation(
      presetMeta.gameType,
      [],
    );
    if (skillDoc) {
      parts.push('', '## 游戏类型知识', skillDoc);
    }
  } catch {
    // Best effort — skill loading is optional context
  }

  try {
    const expertBlock = await skillLoader.loadExpertCardRich(presetMeta.gameType);
    if (expertBlock) {
      parts.push('', '## 专家数据参考', expertBlock);
    }
  } catch {
    // Best effort
  }

  return parts.join('\n');
}

function buildUserMessage(
  baseConfig: GameConfig,
  presetMeta: PresetMeta,
): string {
  const configSummary = {
    gameType: presetMeta.gameType,
    theme: baseConfig.meta.theme,
    artStyle: baseConfig.meta.artStyle,
    modules: baseConfig.modules.map((m) => ({ id: m.id, type: m.type })),
    timerDuration: baseConfig.modules.find((m) => m.type === 'Timer')?.params
      ?.duration,
  };

  return [
    `基线配置:\n${JSON.stringify(configSummary, null, 2)}`,
    presetMeta.concept ? `\n模板意图: ${presetMeta.concept}` : '',
    presetMeta.signatureGoods?.length
      ? `\n标志性 good items: ${presetMeta.signatureGoods.join(', ')}`
      : '',
    presetMeta.signatureBads?.length
      ? `\n标志性 bad items: ${presetMeta.signatureBads.join(', ')}`
      : '',
    '\n请基于 skill 知识产出一个小而精的风味微调 diff。',
  ]
    .filter((s) => s.length > 0)
    .join('');
}

interface ToolUseBlock {
  type: string;
  name?: string;
  input?: unknown;
}

function extractChanges(response: unknown): ConfigChange[] | null {
  if (typeof response !== 'object' || response === null) return null;
  const content = (response as Record<string, unknown>).content;
  if (!Array.isArray(content)) return null;

  for (const block of content as ToolUseBlock[]) {
    if (block.type !== 'tool_use') continue;
    if (block.name !== 'refine_preset') continue;
    return normaliseChanges(block.input);
  }
  return null;
}

const ALLOWED_ACTIONS: ReadonlySet<string> = new Set([
  'set_param', 'set_theme', 'set_art_style', 'set_duration',
  'add_module', 'remove_module', 'set_asset_description',
]);

export function normaliseChanges(input: unknown): ConfigChange[] {
  if (typeof input !== 'object' || input === null) return [];
  const changes = (input as Record<string, unknown>).changes;
  if (!Array.isArray(changes)) return [];

  const out: ConfigChange[] = [];
  for (const raw of changes) {
    const parsed = normaliseOneChange(raw);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}

/** Validate every field individually and construct a fresh object. */
function normaliseOneChange(raw: unknown): ConfigChange | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const action = obj.action;
  if (typeof action !== 'string') return null;
  if (!ALLOWED_ACTIONS.has(action)) return null;

  return {
    action,
    module_type: typeof obj.module_type === 'string' ? obj.module_type : undefined,
    param_key: typeof obj.param_key === 'string' ? obj.param_key : undefined,
    param_value: obj.param_value,
    theme: typeof obj.theme === 'string' ? obj.theme : undefined,
    art_style: typeof obj.art_style === 'string' ? obj.art_style : undefined,
    duration: typeof obj.duration === 'number' ? obj.duration : undefined,
    asset_id: typeof obj.asset_id === 'string' ? obj.asset_id : undefined,
    description: typeof obj.description === 'string' ? obj.description : undefined,
  };
}
