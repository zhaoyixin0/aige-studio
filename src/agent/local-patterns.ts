import type { GameConfig } from '@/engine/core/index.ts';

export interface LocalMatch {
  type: 'update_param' | 'enable_module' | 'disable_module';
  moduleId: string;
  param?: string;
  value?: unknown;
  action?: 'increase' | 'decrease' | 'set';
  message: string;
}

/** Chinese param name to English param mapping for common terms */
const PARAM_ALIASES: Record<string, string[]> = {
  '速度': ['speed', 'velocity'],
  '频率': ['frequency', 'spawnFrequency'],
  '分数': ['score', 'pointsPerHit'],
  '时间': ['duration', 'time', 'remaining'],
  '生命': ['count', 'lives'],
  '大小': ['size', 'radius'],
  '难度': ['difficulty', 'stepSize'],
  '数量': ['maxCount', 'count'],
  '间隔': ['interval', 'frequency'],
};

/** Chinese module aliases for fuzzy matching */
const MODULE_ALIASES: Record<string, string[]> = {
  '计时器': ['Timer'],
  '计时': ['Timer'],
  '生命': ['Lives'],
  '生命系统': ['Lives'],
  '得分': ['Scorer'],
  '计分': ['Scorer'],
  '计分器': ['Scorer'],
  '粒子': ['ParticleVFX'],
  '特效': ['ParticleVFX'],
  '粒子特效': ['ParticleVFX'],
  '音效': ['SoundFX'],
  '声音': ['SoundFX'],
  '难度': ['DifficultyRamp'],
  '生成器': ['Spawner'],
  '碰撞': ['Collision'],
  '随机': ['Randomizer'],
  '界面': ['UIOverlay'],
  '结果': ['ResultScreen'],
  '结算': ['ResultScreen'],
};

const PATTERNS: Array<{
  regex: RegExp;
  handler: (match: RegExpMatchArray, config: GameConfig) => LocalMatch | null;
}> = [
  {
    regex: /(?:把)?(.+?)(?:调高|增加|加大|提高|调快)(?:一点)?/,
    handler: (match, config) =>
      findAndAdjust(match[1].trim(), config, 'increase'),
  },
  {
    regex: /(?:把)?(.+?)(?:调低|减少|降低|减小|调慢)(?:一点)?/,
    handler: (match, config) =>
      findAndAdjust(match[1].trim(), config, 'decrease'),
  },
  {
    regex: /(?:把)?(.+?)(?:改成|设为|设置为|设成)\s*(\S+)/,
    handler: (match, config) =>
      findAndSet(match[1].trim(), match[2], config),
  },
  {
    regex: /(?:开启|打开|启用)(.+)/,
    handler: (match, config) =>
      findModuleToggle(match[1].trim(), config, 'enable_module'),
  },
  {
    regex: /(?:关闭|禁用|去掉|移除)(.+)/,
    handler: (match, config) =>
      findModuleToggle(match[1].trim(), config, 'disable_module'),
  },
];

export function tryLocalMatch(
  input: string,
  config: GameConfig,
): LocalMatch | null {
  const trimmed = input.trim();
  for (const pattern of PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      const result = pattern.handler(match, config);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Find a module and param matching a Chinese keyword, then adjust the value
 * by 10-20% (increase or decrease).
 */
function findAndAdjust(
  keyword: string,
  config: GameConfig,
  action: 'increase' | 'decrease',
): LocalMatch | null {
  const paramNames = findParamNames(keyword);
  if (paramNames.length === 0) return null;

  for (const mod of config.modules) {
    for (const paramName of paramNames) {
      if (paramName in mod.params) {
        const currentValue = mod.params[paramName];
        if (typeof currentValue !== 'number') continue;

        const factor = action === 'increase' ? 1.15 : 0.85;
        const newValue = Math.round(currentValue * factor * 100) / 100;
        const label = action === 'increase' ? '提高' : '降低';

        return {
          type: 'update_param',
          moduleId: mod.id,
          param: paramName,
          value: newValue,
          action,
          message: `已将 ${mod.type} 的 ${paramName} 从 ${currentValue} ${label}到 ${newValue}`,
        };
      }
    }
  }

  return null;
}

/**
 * Find a module and param matching a Chinese keyword, then set to a specific value.
 */
function findAndSet(
  keyword: string,
  rawValue: string,
  config: GameConfig,
): LocalMatch | null {
  const paramNames = findParamNames(keyword);
  if (paramNames.length === 0) return null;

  const parsedValue = parseValue(rawValue);

  for (const mod of config.modules) {
    for (const paramName of paramNames) {
      if (paramName in mod.params) {
        return {
          type: 'update_param',
          moduleId: mod.id,
          param: paramName,
          value: parsedValue,
          action: 'set',
          message: `已将 ${mod.type} 的 ${paramName} 设置为 ${String(parsedValue)}`,
        };
      }
    }
  }

  return null;
}

/**
 * Find a module by Chinese name and toggle its enabled state.
 */
function findModuleToggle(
  keyword: string,
  config: GameConfig,
  type: 'enable_module' | 'disable_module',
): LocalMatch | null {
  // Try alias-based matching first
  const aliasTypes = MODULE_ALIASES[keyword];
  if (aliasTypes) {
    for (const aliasType of aliasTypes) {
      const mod = config.modules.find(
        (m) => m.type.toLowerCase() === aliasType.toLowerCase(),
      );
      if (mod) {
        const label = type === 'enable_module' ? '开启' : '关闭';
        return {
          type,
          moduleId: mod.id,
          message: `已${label} ${mod.type}`,
        };
      }
    }
  }

  // Try fuzzy matching on module type names
  for (const mod of config.modules) {
    if (
      mod.type.toLowerCase().includes(keyword.toLowerCase()) ||
      keyword.toLowerCase().includes(mod.type.toLowerCase())
    ) {
      const label = type === 'enable_module' ? '开启' : '关闭';
      return {
        type,
        moduleId: mod.id,
        message: `已${label} ${mod.type}`,
      };
    }
  }

  return null;
}

/**
 * Look up English param names from a Chinese keyword using PARAM_ALIASES.
 */
function findParamNames(keyword: string): string[] {
  for (const [chineseName, englishNames] of Object.entries(PARAM_ALIASES)) {
    if (keyword.includes(chineseName)) {
      return englishNames;
    }
  }
  return [];
}

/**
 * Parse a raw string value into the appropriate type (number, boolean, or string).
 */
function parseValue(raw: string): unknown {
  // Try number
  const num = Number(raw);
  if (!isNaN(num)) return num;

  // Try boolean
  if (raw === 'true' || raw === '是' || raw === '开') return true;
  if (raw === 'false' || raw === '否' || raw === '关') return false;

  return raw;
}
