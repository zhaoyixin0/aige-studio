import { ALL_GAME_TYPES, getGamePreset } from '@/agent/game-presets';
import type { GameConfig, ModuleConfig } from '@/engine/core';

export interface TestCase {
  name: string;
  gameType: string;
  variant: 'baseline' | 'remove' | 'add';
  removedModule?: string;
  addedModule?: string;
  config: GameConfig;
}

// Modules that can be optionally added to any game type
const ADDABLE_MODULES: Array<{ type: string; params: Record<string, any> }> = [
  { type: 'ComboSystem', params: { comboWindow: 1500, multiplierStep: 0.5, maxMultiplier: 4 } },
  { type: 'DifficultyRamp', params: { mode: 'time', rules: [] } },
  { type: 'PowerUp', params: { powerUpTypes: [] } },
  { type: 'Gravity', params: { strength: 980, terminalVelocity: 800 } },
  { type: 'CoyoteTime', params: { coyoteFrames: 6, bufferFrames: 6 } },
  { type: 'Dash', params: { distance: 150, duration: 150, cooldown: 500 } },
  { type: 'Knockback', params: { force: 300, duration: 200 } },
  { type: 'IFrames', params: { duration: 1000 } },
  { type: 'CameraFollow', params: { mode: 'center', smoothing: 0.1 } },
  { type: 'Inventory', params: { resources: [{ name: 'coin', max: 100, initial: 0 }] } },
  { type: 'Checkpoint', params: { checkpoints: [{ x: 400, y: 300, width: 30, height: 50 }] } },
];

// Modules that should never be removed (game won't function)
const CORE_MODULES = new Set(['GameFlow', 'TouchInput', 'FaceInput', 'HandInput', 'BodyInput', 'DeviceInput', 'AudioInput']);

function buildConfig(gameType: string, modules: ModuleConfig[]): GameConfig {
  return {
    version: '1.0.0',
    meta: {
      name: `${gameType}-test`,
      description: '',
      thumbnail: null,
      createdAt: new Date().toISOString(),
      theme: 'fruit',
    },
    canvas: { width: 1080, height: 1920 },
    modules,
    assets: {},
  };
}

function presetToModules(gameType: string): ModuleConfig[] {
  const preset = getGamePreset(gameType as any);
  if (!preset) return [];
  return Object.entries(preset).map(([type, params], i) => ({
    id: `${type.toLowerCase()}_${i}`,
    type,
    enabled: true,
    params: params as Record<string, any>,
  }));
}

export class CombinationGenerator {
  /**
   * Generate test cases from all 15 game presets:
   * 1. Baseline — each preset as-is
   * 2. Remove variants — remove one optional module at a time
   * 3. Add variants — add one compatible module at a time (if not already present)
   */
  static fromPresets(): TestCase[] {
    const cases: TestCase[] = [];

    for (const gameType of ALL_GAME_TYPES) {
      const baseModules = presetToModules(gameType);
      if (baseModules.length === 0) continue;

      // 1. Baseline
      cases.push({
        name: `${gameType}/baseline`,
        gameType,
        variant: 'baseline',
        config: buildConfig(gameType, baseModules),
      });

      // 2. Remove variants — skip core modules
      const removable = baseModules.filter((m) => !CORE_MODULES.has(m.type));
      for (const mod of removable) {
        const reduced = baseModules.filter((m) => m.id !== mod.id);
        cases.push({
          name: `${gameType}/remove-${mod.type}`,
          gameType,
          variant: 'remove',
          removedModule: mod.type,
          config: buildConfig(gameType, reduced),
        });
      }

      // 3. Add variants — only add if not already present
      const presentTypes = new Set(baseModules.map((m) => m.type));
      for (const addable of ADDABLE_MODULES) {
        if (presentTypes.has(addable.type)) continue;
        const extended = [
          ...baseModules,
          {
            id: `${addable.type.toLowerCase()}_added`,
            type: addable.type,
            enabled: true,
            params: addable.params,
          },
        ];
        cases.push({
          name: `${gameType}/add-${addable.type}`,
          gameType,
          variant: 'add',
          addedModule: addable.type,
          config: buildConfig(gameType, extended),
        });
      }
    }

    return cases;
  }
}
