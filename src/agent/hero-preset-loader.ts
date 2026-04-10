// src/agent/hero-preset-loader.ts
//
// Hero Skeleton Preset Loader (v2).
//
// Converts the new declarative "hero-skeleton" preset format into the same
// parameter shape consumed by ConversationAgent.buildGameConfig(). This lets
// use_preset reuse the working create_game code path instead of the mechanical
// RecipeExecutor that produced empty shells.
//
// Legacy expert presets (sequence/commands) are detected by absence of the
// `kind` field and remain on the RecipeExecutor path.

// ── Types ───────────────────────────────────────────────────────

export type HeroInputMethod =
  | 'FaceInput'
  | 'HandInput'
  | 'BodyInput'
  | 'TouchInput'
  | 'DeviceInput'
  | 'AudioInput';

export interface HeroEmphasis {
  readonly difficulty?: number;
  readonly pacing?: number;
  readonly juice?: number;
  readonly complexity?: number;
}

export interface HeroSignature {
  readonly goods?: readonly string[];
  readonly bads?: readonly string[];
}

export interface HeroPresetSkeleton {
  readonly id: string;
  readonly kind: 'hero-skeleton';
  readonly version: 2;
  readonly gameType: string;
  readonly title: string;
  readonly description: string;
  readonly thumbnail?: string;
  readonly tags?: readonly string[];
  readonly concept?: string;
  readonly inputMethod?: HeroInputMethod;
  readonly extraModules?: readonly string[];
  readonly emphasis?: HeroEmphasis;
  readonly signature?: HeroSignature;
  readonly assetHints?: Readonly<Record<string, string>>;
}

/**
 * Params accepted by ConversationAgent.buildGameConfig() — kept in sync with
 * the create_game tool input shape in conversation-agent.ts:433.
 */
export interface BuildGameConfigParams {
  game_type: string;
  theme?: string;
  art_style?: string;
  duration?: number;
  input_method?: string;
  extra_modules?: string[];
  want_background?: boolean;
  asset_descriptions?: Record<string, string>;
}

export interface LoadedHeroPreset {
  readonly createParams: BuildGameConfigParams;
  readonly metaOverrides?: Readonly<Record<string, unknown>>;
  readonly heroPresetId: string;
}

// ── Type guard ──────────────────────────────────────────────────

const ALLOWED_INPUT_METHODS: ReadonlySet<string> = new Set([
  'FaceInput',
  'HandInput',
  'BodyInput',
  'TouchInput',
  'DeviceInput',
  'AudioInput',
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is readonly string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export function isHeroSkeleton(value: unknown): value is HeroPresetSkeleton {
  if (!isRecord(value)) return false;
  return value.kind === 'hero-skeleton';
}

// ── Emphasis mapping ────────────────────────────────────────────

/**
 * Map emphasis.difficulty (0..1) to a Timer duration (seconds).
 *
 * Rationale: difficulty scales inversely with failure tolerance, so higher
 * difficulty warrants a longer session to showcase mastery. Linear mapping
 * keeps the rule inspectable:
 *   difficulty=0.0 → 20s (short casual)
 *   difficulty=0.5 → 40s
 *   difficulty=1.0 → 60s (extended challenge)
 */
function difficultyToDuration(difficulty: number): number {
  const clamped = Math.max(0, Math.min(1, difficulty));
  return Math.round(20 + clamped * 40);
}

// ── Signature / assetHints expansion ────────────────────────────

function expandSignature(
  signature: HeroSignature | undefined,
  hints: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  const out: Record<string, string> = {};

  if (signature?.goods) {
    signature.goods.forEach((label, i) => {
      if (typeof label === 'string' && label.length > 0) {
        out[`good_${i + 1}`] = label;
      }
    });
  }

  if (signature?.bads) {
    signature.bads.forEach((label, i) => {
      if (typeof label === 'string' && label.length > 0) {
        out[`bad_${i + 1}`] = label;
      }
    });
  }

  if (hints) {
    for (const [key, value] of Object.entries(hints)) {
      if (typeof value === 'string' && value.length > 0) {
        out[key] = value;
      }
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

// ── Validation ──────────────────────────────────────────────────

function assertHeroSkeleton(value: unknown): HeroPresetSkeleton {
  if (!isRecord(value)) {
    throw new Error('hero-skeleton: input is not an object');
  }
  if (value.kind !== 'hero-skeleton') {
    throw new Error(
      `hero-skeleton: expected kind="hero-skeleton" but got ${JSON.stringify(value.kind)}`,
    );
  }
  if (value.version !== 2) {
    throw new Error(
      `hero-skeleton: unsupported version ${JSON.stringify(value.version)}, expected 2`,
    );
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error('hero-skeleton: missing required field "id"');
  }
  if (typeof value.gameType !== 'string' || value.gameType.length === 0) {
    throw new Error('hero-skeleton: missing required field "gameType"');
  }
  if (typeof value.title !== 'string') {
    throw new Error('hero-skeleton: missing required field "title"');
  }
  if (typeof value.description !== 'string') {
    throw new Error('hero-skeleton: missing required field "description"');
  }

  // Optional: inputMethod
  if (
    value.inputMethod !== undefined &&
    (typeof value.inputMethod !== 'string' ||
      !ALLOWED_INPUT_METHODS.has(value.inputMethod))
  ) {
    throw new Error(
      `hero-skeleton: invalid inputMethod ${JSON.stringify(value.inputMethod)}`,
    );
  }

  // Optional: extraModules must be string[]
  if (value.extraModules !== undefined && !isStringArray(value.extraModules)) {
    throw new Error('hero-skeleton: extraModules must be string[]');
  }

  return value as unknown as HeroPresetSkeleton;
}

// ── Public loader ───────────────────────────────────────────────

/**
 * Parse a hero-skeleton preset JSON and produce params suitable for
 * ConversationAgent.buildGameConfig(). Immutable — does not mutate input.
 */
export function loadHeroSkeleton(json: unknown): LoadedHeroPreset {
  const skeleton = assertHeroSkeleton(json);

  const assetDescriptions = expandSignature(
    skeleton.signature,
    skeleton.assetHints,
  );

  const duration =
    skeleton.emphasis?.difficulty !== undefined
      ? difficultyToDuration(skeleton.emphasis.difficulty)
      : undefined;

  const createParams: BuildGameConfigParams = {
    game_type: skeleton.gameType,
  };

  if (skeleton.inputMethod) {
    createParams.input_method = skeleton.inputMethod;
  }
  if (skeleton.extraModules && skeleton.extraModules.length > 0) {
    createParams.extra_modules = [...skeleton.extraModules];
  }
  if (duration !== undefined) {
    createParams.duration = duration;
  }
  if (assetDescriptions) {
    createParams.asset_descriptions = assetDescriptions;
  }

  const metaOverrides: Readonly<Record<string, unknown>> = {
    name: skeleton.title,
    description: skeleton.description,
    heroPresetId: skeleton.id,
    ...(skeleton.concept ? { concept: skeleton.concept } : {}),
    ...(skeleton.thumbnail ? { thumbnail: skeleton.thumbnail } : {}),
    ...(skeleton.signature?.goods?.length ? { signatureGoods: [...skeleton.signature.goods] } : {}),
    ...(skeleton.signature?.bads?.length ? { signatureBads: [...skeleton.signature.bads] } : {}),
  };

  return {
    createParams,
    metaOverrides,
    heroPresetId: skeleton.id,
  };
}
