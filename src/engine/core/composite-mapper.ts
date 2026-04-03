/**
 * CompositeMapper — maps L1 abstract values to concrete L2/L3 parameter changes.
 *
 * L1 params:
 *   difficulty: 简单 | 普通 | 困难
 *   pacing:     慢 | 中 | 快
 *   emotion:    沉静 | 热血 | 欢乐
 *
 * Output: array of { moduleId, changes } ready for batchUpdateParams().
 */

export interface L1Values {
  readonly difficulty: string;
  readonly pacing: string;
  readonly emotion: string;
}

export interface MappedChange {
  readonly moduleId: string;
  readonly changes: Readonly<Record<string, unknown>>;
}

// --- Difficulty mappings ---

const DIFFICULTY_SCALE: Record<string, number> = {
  '简单': 0.6,
  '普通': 1.0,
  '困难': 1.5,
};

function mapDifficulty(level: string, gameType: string): Record<string, Record<string, unknown>> {
  const scale = DIFFICULTY_SCALE[level] ?? 1.0;
  const base: Record<string, Record<string, unknown>> = {
    spawner: {
      frequency: +(0.8 * scale).toFixed(2),
      speed: Math.round(200 * scale),
    },
    lives: {
      count: Math.max(1, Math.round(3 / scale)),
    },
    scorer: {
      perHit: Math.round(10 * scale),
    },
    collision: {
      hitboxScale: +(1.2 / scale).toFixed(2),
    },
  };

  // Game-type specific overrides
  if (gameType === 'shooting' || gameType === 'action-rpg') {
    base.health = { maxHp: Math.round(100 / scale) };
    base.projectile = { speed: Math.round(400 * scale) };
  }
  if (gameType === 'platformer') {
    base.gravity = { strength: +(0.5 * scale).toFixed(2) };
  }
  if (gameType === 'quiz') {
    base.timer = { duration: Math.round(30 / scale) };
  }

  return base;
}

// --- Pacing mappings ---

const PACING_SCALE: Record<string, number> = {
  '慢': 0.6,
  '中': 1.0,
  '快': 1.5,
};

function mapPacing(level: string, gameType: string): Record<string, Record<string, unknown>> {
  const scale = PACING_SCALE[level] ?? 1.0;
  const base: Record<string, Record<string, unknown>> = {
    spawner: {
      frequency: +(1.0 * scale).toFixed(2),
    },
  };

  if (gameType === 'runner' || gameType === 'racing') {
    base.runner = {
      speed: Math.round(600 * scale),
      maxSpeed: Math.round(1200 * scale),
    };
  }
  if (gameType === 'rhythm') {
    base['beat-map'] = {
      bpm: Math.round(120 * scale),
    };
  }

  return base;
}

// --- Emotion mappings ---

const EMOTION_MAP: Record<string, Record<string, Record<string, unknown>>> = {
  '沉静': {
    'particle-vfx': { burstScale: 0.5 },
    'sound-fx': { feedbackVolume: 0.4 },
  },
  '热血': {
    'particle-vfx': { burstScale: 1.5 },
    'sound-fx': { feedbackVolume: 1.0 },
    'camera-follow': { shakeIntensity: 1.2 },
  },
  '欢乐': {
    'particle-vfx': { burstScale: 1.0 },
    'sound-fx': { feedbackVolume: 0.8 },
  },
};

function mapEmotion(level: string): Record<string, Record<string, unknown>> {
  return EMOTION_MAP[level] ?? EMOTION_MAP['欢乐']!;
}

// --- Merge utility ---

function mergeChangeMaps(
  ...maps: Record<string, Record<string, unknown>>[]
): MappedChange[] {
  const merged = new Map<string, Record<string, unknown>>();

  for (const map of maps) {
    for (const [moduleId, changes] of Object.entries(map)) {
      const existing = merged.get(moduleId);
      merged.set(moduleId, existing ? { ...existing, ...changes } : { ...changes });
    }
  }

  return Array.from(merged.entries()).map(([moduleId, changes]) => ({
    moduleId,
    changes,
  }));
}

// --- Public API ---

export function applyL1Preset(l1: L1Values, gameType: string): MappedChange[] {
  const difficultyMap = mapDifficulty(l1.difficulty, gameType);
  const pacingMap = mapPacing(l1.pacing, gameType);
  const emotionMap = mapEmotion(l1.emotion);

  return mergeChangeMaps(difficultyMap, pacingMap, emotionMap);
}
