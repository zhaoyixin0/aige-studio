// tools/m5/synthesizer.ts
// Converts ExpertIR → PresetTemplate.

import type { ExpertIR } from './types.ts';
import type { Command, ParamSpec, PresetTemplate } from '@/engine/systems/recipe-runner/types.ts';

/** Minimum core modules per game type. Keeps expert presets functional. */
const BASE_MODULES: Record<string, readonly { type: string; params: Record<string, unknown> }[]> = {
  catch: [
    { type: 'GameFlow', params: { countdown: 3, onFinish: 'show_result' } },
    { type: 'Spawner', params: { frequency: 1.5, maxCount: 5, direction: 'down' } },
    { type: 'Collision', params: { rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }] } },
    { type: 'Scorer', params: { perHit: 10 } },
    { type: 'Timer', params: { duration: 30, mode: 'countdown' } },
    { type: 'Lives', params: { count: 3 } },
  ],
  dodge: [
    { type: 'GameFlow', params: { countdown: 3, onFinish: 'show_result' } },
    { type: 'Spawner', params: { frequency: 1.2, maxCount: 6, direction: 'down' } },
    { type: 'Collision', params: { rules: [{ a: 'player', b: 'items', event: 'damage', destroy: ['b'] }] } },
    { type: 'Scorer', params: { scorePerSecond: 1 } },
    { type: 'Timer', params: { duration: 30, mode: 'countdown' } },
    { type: 'Lives', params: { count: 3 } },
  ],
  shooting: [
    { type: 'GameFlow', params: { countdown: 3, onFinish: 'show_result' } },
    { type: 'Projectile', params: { speed: 500 } },
    { type: 'WaveSpawner', params: { waveDuration: 15, maxEnemiesPerWave: 5 } },
    { type: 'Health', params: { maxHP: 100 } },
    { type: 'Scorer', params: { perHit: 10 } },
  ],
  puzzle: [
    { type: 'GameFlow', params: { countdown: 3, onFinish: 'show_result' } },
    { type: 'Timer', params: { duration: 60, mode: 'countdown' } },
    { type: 'Scorer', params: { perHit: 100 } },
  ],
  platformer: [
    { type: 'GameFlow', params: { countdown: 3, onFinish: 'show_result' } },
    { type: 'Gravity', params: { g: 980 } },
    { type: 'PlayerMovement', params: { speed: 300 } },
    { type: 'Jump', params: { force: 500 } },
    { type: 'Collision', params: {} },
  ],
  slingshot: [
    { type: 'GameFlow', params: { countdown: 3, onFinish: 'show_result' } },
    { type: 'Scorer', params: { perHit: 100 } },
  ],
  racing: [
    { type: 'GameFlow', params: { countdown: 3, onFinish: 'show_result' } },
    { type: 'Timer', params: { duration: 60, mode: 'countdown' } },
    { type: 'Scorer', params: { perHit: 10 } },
  ],
};

/** Default base modules for unknown game types. */
const DEFAULT_BASE_MODULES: readonly { type: string; params: Record<string, unknown> }[] = [
  { type: 'GameFlow', params: { countdown: 3, onFinish: 'show_result' } },
  { type: 'Timer', params: { duration: 30, mode: 'countdown' } },
  { type: 'Scorer', params: { perHit: 10 } },
];

/** Known fallback game type used when no mapping found. */
const FALLBACK_GAME_TYPE = 'tap';

/** Variable name → module param piping. */
const VARIABLE_PIPE: Record<string, { module: string; param: string }> = {
  duration: { module: 'Timer', param: 'duration' },
  projectileSpeed: { module: 'Projectile', param: 'speed' },
  gravityScale: { module: 'Gravity', param: 'scale' },
  pairCount: { module: 'MatchEngine', param: 'gridSize' },
  moleCount: { module: 'Spawner', param: 'maxCount' },
  spawnCount: { module: 'Spawner', param: 'maxCount' },
  speed: { module: 'PlayerMovement', param: 'speed' },
};

/**
 * Convert an ExpertIR to a PresetTemplate ready for the Recipe Runner.
 */
export function synthesize(ir: ExpertIR): PresetTemplate {
  const addedModuleTypes = new Set<string>();
  const commands: Command[] = [
    ...buildMetaCommands(ir),
    ...buildAssetCommands(ir),
    ...buildModuleCommands(ir, addedModuleTypes),
    ...buildParamPipeCommands(ir, addedModuleTypes),
  ];

  const confidence = computeConfidence(ir, addedModuleTypes);
  const tags: string[] = [...ir.tags, `confidence:${confidence.toFixed(2)}`];
  if (confidence < 0.6) tags.push('draft');

  return {
    id: ir.id,
    title: ir.title,
    description: `${ir.description} [source: ${ir.sourcePath}]`,
    gameType: ir.aigeGameType,
    tags,
    params: ir.params.map((p) => ({
      name: p.name,
      type: mapParamType(p.type),
      description: p.description,
    })),
    sequence: { id: ir.id, commands },
    requiredModules: [...addedModuleTypes],
  };
}

function buildMetaCommands(ir: ExpertIR): readonly Command[] {
  return [
    {
      name: 'setMeta',
      args: { sourcePath: ir.sourcePath, description: ir.description, gameTypeHint: ir.gameTypeHint ?? '' },
      comment: 'Expert preset metadata',
    },
    {
      name: 'configureCanvas',
      args: { width: 1080, height: 1920 },
      comment: 'AIGE standard canvas',
    },
  ];
}

function buildAssetCommands(ir: ExpertIR): readonly Command[] {
  return ir.assets.map((asset) => ({
    name: 'addAsset' as const,
    args: { assetId: asset.id, type: asset.type, src: asset.src },
    comment: `Asset: ${asset.src}`,
  }));
}

function buildModuleCommands(ir: ExpertIR, addedModuleTypes: Set<string>): readonly Command[] {
  const commands: Command[] = [];
  const baseModules = BASE_MODULES[ir.aigeGameType] ?? DEFAULT_BASE_MODULES;

  for (const mod of baseModules) {
    commands.push({
      name: 'addModule',
      args: { id: `${mod.type.toLowerCase()}_1`, type: mod.type, params: { ...mod.params } },
      comment: `Base module: ${mod.type}`,
    });
    addedModuleTypes.add(mod.type);
  }

  for (const hint of ir.moduleHints) {
    if (addedModuleTypes.has(hint.type)) continue;
    commands.push({
      name: 'addModule',
      args: { id: `${hint.type.toLowerCase()}_1`, type: hint.type, params: { ...hint.params } },
      comment: `Expert hint module: ${hint.type}`,
    });
    addedModuleTypes.add(hint.type);
  }

  return commands;
}

function buildParamPipeCommands(ir: ExpertIR, addedModuleTypes: Set<string>): readonly Command[] {
  const commands: Command[] = [];

  for (const param of ir.params) {
    const pipe = VARIABLE_PIPE[param.name];
    if (pipe && addedModuleTypes.has(pipe.module)) {
      commands.push({
        name: 'setParam',
        args: { moduleId: `${pipe.module.toLowerCase()}_1`, param: pipe.param, value: `$${param.name}` },
        comment: `Pipe ${param.name} → ${pipe.module}.${pipe.param}`,
      });
    }
  }

  return commands;
}

function computeConfidence(ir: ExpertIR, addedModules: Set<string>): number {
  let score = 0;
  if (ir.aigeGameType !== FALLBACK_GAME_TYPE || ir.gameTypeHint != null) score += 0.25;
  if (ir.assets.length >= 1) score += 0.15;
  if (addedModules.size >= 3) score += 0.35;
  if (ir.unmappedComponents.length === 0) score += 0.25;
  return score;
}

function mapParamType(irType: string): 'number' | 'string' | 'boolean' | 'enum' | 'vec2' | 'color' | 'assetId' {
  const valid = ['number', 'string', 'boolean', 'enum', 'vec2', 'color', 'assetId'];
  return valid.includes(irType) ? (irType as ReturnType<typeof mapParamType>) : 'string';
}
