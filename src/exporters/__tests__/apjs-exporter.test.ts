import { describe, it, expect } from 'vitest';
import { ApjsExporter } from '../apjs-exporter';
import type { ApjsExportResult } from '../apjs-exporter';
import {
  getTranslator,
  SpawnerTranslator,
  CollisionTranslator,
  ScorerTranslator,
  TimerTranslator,
  GameFlowTranslator,
} from '../apjs-translators';
import type { GameConfig, ModuleConfig } from '@/engine/core';

const MOCK_CONFIG: GameConfig = {
  version: '1.0.0',
  meta: { name: 'Test Game', description: 'A test game', thumbnail: null, createdAt: '' },
  canvas: { width: 1080, height: 1920 },
  modules: [
    {
      id: 'spawner_1',
      type: 'Spawner',
      enabled: true,
      params: { frequency: 1.5, speed: { min: 100, max: 200 }, direction: 'down', maxCount: 10 },
    },
    {
      id: 'collision_1',
      type: 'Collision',
      enabled: true,
      params: { rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }] },
    },
    {
      id: 'scorer_1',
      type: 'Scorer',
      enabled: true,
      params: { perHit: 10, deductOnMiss: false },
    },
    {
      id: 'timer_1',
      type: 'Timer',
      enabled: true,
      params: { duration: 30, mode: 'countdown', onEnd: 'finish' },
    },
    {
      id: 'gameflow_1',
      type: 'GameFlow',
      enabled: true,
      params: { countdown: 3, onFinish: 'show_result' },
    },
  ],
  assets: {},
};

// ---------- ApjsExporter integration tests ----------

describe('ApjsExporter', () => {
  it('should export a result with mainScript, sceneManifest, and requiredCapabilities', () => {
    const exporter = new ApjsExporter();
    const result = exporter.export(MOCK_CONFIG);

    expect(result).toHaveProperty('mainScript');
    expect(result).toHaveProperty('sceneManifest');
    expect(result).toHaveProperty('requiredCapabilities');
    expect(typeof result.mainScript).toBe('string');
    expect(Array.isArray(result.requiredCapabilities)).toBe(true);
  });

  it('should produce mainScript with correct imports', () => {
    const exporter = new ApjsExporter();
    const result = exporter.export(MOCK_CONFIG);

    expect(result.mainScript).toContain("require('Scene')");
    expect(result.mainScript).toContain("require('Time')");
    expect(result.mainScript).toContain("require('Patches')");
  });

  it('should include game config name in mainScript', () => {
    const exporter = new ApjsExporter();
    const result = exporter.export(MOCK_CONFIG);

    expect(result.mainScript).toContain('Game Config: Test Game');
  });

  it('should end mainScript with startGame() call', () => {
    const exporter = new ApjsExporter();
    const result = exporter.export(MOCK_CONFIG);

    expect(result.mainScript).toContain('startGame();');
  });

  it('should detect FACE_TRACKING capability for FaceInput modules', () => {
    const config: GameConfig = {
      ...MOCK_CONFIG,
      modules: [
        { id: 'face_1', type: 'FaceInput', enabled: true, params: { tracking: 'headXY' } },
      ],
    };
    const exporter = new ApjsExporter();
    const result = exporter.export(config);

    expect(result.requiredCapabilities).toContain('FACE_TRACKING');
    expect(result.mainScript).toContain("require('FaceTracking')");
  });

  it('should detect TOUCH capability for TouchInput modules', () => {
    const config: GameConfig = {
      ...MOCK_CONFIG,
      modules: [
        { id: 'touch_1', type: 'TouchInput', enabled: true, params: { gesture: 'tap' } },
      ],
    };
    const exporter = new ApjsExporter();
    const result = exporter.export(config);

    expect(result.requiredCapabilities).toContain('TOUCH');
    expect(result.mainScript).toContain("require('TouchGestures')");
  });

  it('should detect HAND_TRACKING capability for HandInput modules', () => {
    const config: GameConfig = {
      ...MOCK_CONFIG,
      modules: [
        { id: 'hand_1', type: 'HandInput', enabled: true, params: {} },
      ],
    };
    const exporter = new ApjsExporter();
    const result = exporter.export(config);

    expect(result.requiredCapabilities).toContain('HAND_TRACKING');
    expect(result.mainScript).toContain("require('HandTracking')");
  });

  it('should detect AUDIO capability for AudioInput modules', () => {
    const config: GameConfig = {
      ...MOCK_CONFIG,
      modules: [
        { id: 'audio_1', type: 'AudioInput', enabled: true, params: {} },
      ],
    };
    const exporter = new ApjsExporter();
    const result = exporter.export(config);

    expect(result.requiredCapabilities).toContain('AUDIO');
    expect(result.mainScript).toContain("require('Audio')");
  });

  it('should not include capability imports when not needed', () => {
    const config: GameConfig = {
      ...MOCK_CONFIG,
      modules: [
        { id: 'scorer_1', type: 'Scorer', enabled: true, params: { perHit: 10 } },
      ],
    };
    const exporter = new ApjsExporter();
    const result = exporter.export(config);

    expect(result.requiredCapabilities).toEqual([]);
    expect(result.mainScript).not.toContain("require('FaceTracking')");
    expect(result.mainScript).not.toContain("require('TouchGestures')");
    expect(result.mainScript).not.toContain("require('HandTracking')");
    expect(result.mainScript).not.toContain("require('Audio')");
  });

  it('should include scene manifest with all enabled modules', () => {
    const exporter = new ApjsExporter();
    const result = exporter.export(MOCK_CONFIG);
    const manifest = result.sceneManifest as { root: { children: Array<{ name: string }> } };

    expect(manifest.root.children).toHaveLength(5);
    expect(manifest.root.children.map((c) => c.name)).toEqual([
      'spawner_1',
      'collision_1',
      'scorer_1',
      'timer_1',
      'gameflow_1',
    ]);
  });

  it('should exclude disabled modules from export', () => {
    const config: GameConfig = {
      ...MOCK_CONFIG,
      modules: [
        { id: 'spawner_1', type: 'Spawner', enabled: true, params: { frequency: 1 } },
        { id: 'scorer_1', type: 'Scorer', enabled: false, params: { perHit: 10 } },
        { id: 'timer_1', type: 'Timer', enabled: false, params: { duration: 30 } },
      ],
    };
    const exporter = new ApjsExporter();
    const result = exporter.export(config);

    // Only spawner should be in the script
    expect(result.mainScript).toContain('Spawner');
    expect(result.mainScript).not.toContain('Scorer: scorer_1');
    expect(result.mainScript).not.toContain('Timer (countdown): timer_1');

    // Only spawner in manifest
    const manifest = result.sceneManifest as { root: { children: Array<{ name: string }> } };
    expect(manifest.root.children).toHaveLength(1);
    expect(manifest.root.children[0].name).toBe('spawner_1');
  });

  it('should produce comment for unsupported module types', () => {
    const config: GameConfig = {
      ...MOCK_CONFIG,
      modules: [
        { id: 'unknown_1', type: 'UnknownModule', enabled: true, params: {} },
      ],
    };
    const exporter = new ApjsExporter();
    const result = exporter.export(config);

    expect(result.mainScript).toContain('// Unsupported module: UnknownModule');
  });
});

// ---------- Translator registry tests ----------

describe('getTranslator', () => {
  it('should return SpawnerTranslator for Spawner type', () => {
    const translator = getTranslator('Spawner');
    expect(translator).toBeInstanceOf(SpawnerTranslator);
  });

  it('should return CollisionTranslator for Collision type', () => {
    const translator = getTranslator('Collision');
    expect(translator).toBeInstanceOf(CollisionTranslator);
  });

  it('should return ScorerTranslator for Scorer type', () => {
    const translator = getTranslator('Scorer');
    expect(translator).toBeInstanceOf(ScorerTranslator);
  });

  it('should return TimerTranslator for Timer type', () => {
    const translator = getTranslator('Timer');
    expect(translator).toBeInstanceOf(TimerTranslator);
  });

  it('should return GameFlowTranslator for GameFlow type', () => {
    const translator = getTranslator('GameFlow');
    expect(translator).toBeInstanceOf(GameFlowTranslator);
  });

  it('should return undefined for unknown module type', () => {
    expect(getTranslator('NonExistent')).toBeUndefined();
  });
});

// ---------- Individual translator tests ----------

describe('SpawnerTranslator', () => {
  it('should generate Time.setInterval based spawn code', () => {
    const translator = new SpawnerTranslator();
    const config: ModuleConfig = {
      id: 'sp1',
      type: 'Spawner',
      enabled: true,
      params: { frequency: 2, speed: { min: 50, max: 150 }, direction: 'down', maxCount: 5 },
    };
    const code = translator.translate(config);

    expect(code).toContain('Time.setInterval');
    expect(code).toContain('spawn_sp1');
    expect(code).toContain('2000'); // 2s * 1000
    expect(code).toContain("direction: 'down'");
    expect(code).toContain('>= 5'); // maxCount check
  });

  it('should use default values when params are missing', () => {
    const translator = new SpawnerTranslator();
    const config: ModuleConfig = { id: 'sp2', type: 'Spawner', enabled: true, params: {} };
    const code = translator.translate(config);

    expect(code).toContain('1500'); // default 1.5s
    expect(code).toContain('>= 10'); // default maxCount
  });

  it('should require no special capabilities', () => {
    const translator = new SpawnerTranslator();
    expect(translator.getRequiredCapabilities()).toEqual([]);
  });
});

describe('CollisionTranslator', () => {
  it('should generate distance-based collision checks', () => {
    const translator = new CollisionTranslator();
    const config: ModuleConfig = {
      id: 'col1',
      type: 'Collision',
      enabled: true,
      params: { rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }] },
    };
    const code = translator.translate(config);

    expect(code).toContain('checkCollisions_col1');
    expect(code).toContain('Math.sqrt');
    expect(code).toContain('collisionThreshold');
    expect(code).toContain('collisionLayer_player');
    expect(code).toContain('collisionLayer_items');
    expect(code).toContain('objB.hidden = true');
  });

  it('should handle empty rules gracefully', () => {
    const translator = new CollisionTranslator();
    const config: ModuleConfig = {
      id: 'col2',
      type: 'Collision',
      enabled: true,
      params: { rules: [] },
    };
    const code = translator.translate(config);

    expect(code).toContain('checkCollisions_col2');
    // Should still produce valid code
    expect(code).toContain('Time.setInterval');
  });

  it('should require no special capabilities', () => {
    const translator = new CollisionTranslator();
    expect(translator.getRequiredCapabilities()).toEqual([]);
  });
});

describe('ScorerTranslator', () => {
  it('should generate score tracking with Patches output', () => {
    const translator = new ScorerTranslator();
    const config: ModuleConfig = {
      id: 'sc1',
      type: 'Scorer',
      enabled: true,
      params: { perHit: 25 },
    };
    const code = translator.translate(config);

    expect(code).toContain('score_sc1');
    expect(code).toContain('+= 25');
    expect(code).toContain("Patches.inputs.setScalar('score'");
  });

  it('should include miss deduction when deductOnMiss is true', () => {
    const translator = new ScorerTranslator();
    const config: ModuleConfig = {
      id: 'sc2',
      type: 'Scorer',
      enabled: true,
      params: { perHit: 10, deductOnMiss: true, deductAmount: 5 },
    };
    const code = translator.translate(config);

    expect(code).toContain('onMiss_sc2');
    expect(code).toContain('- 5');
  });

  it('should not include miss deduction when deductOnMiss is false', () => {
    const translator = new ScorerTranslator();
    const config: ModuleConfig = {
      id: 'sc3',
      type: 'Scorer',
      enabled: true,
      params: { perHit: 10, deductOnMiss: false },
    };
    const code = translator.translate(config);

    expect(code).not.toContain('onMiss_sc3');
  });

  it('should require no special capabilities', () => {
    const translator = new ScorerTranslator();
    expect(translator.getRequiredCapabilities()).toEqual([]);
  });
});

describe('TimerTranslator', () => {
  it('should generate countdown logic', () => {
    const translator = new TimerTranslator();
    const config: ModuleConfig = {
      id: 'tm1',
      type: 'Timer',
      enabled: true,
      params: { duration: 60, mode: 'countdown', onEnd: 'finish' },
    };
    const code = translator.translate(config);

    expect(code).toContain('timeRemaining_tm1 = 60');
    expect(code).toContain('Time.setInterval');
    expect(code).toContain('-= 1');
    expect(code).toContain('timerEnded');
    expect(code).toContain('finishGame()');
  });

  it('should generate stopwatch logic', () => {
    const translator = new TimerTranslator();
    const config: ModuleConfig = {
      id: 'tm2',
      type: 'Timer',
      enabled: true,
      params: { duration: 30, mode: 'stopwatch' },
    };
    const code = translator.translate(config);

    expect(code).toContain('timeElapsed_tm2 = 0');
    expect(code).toContain('+= 1');
    expect(code).not.toContain('finishGame');
  });

  it('should not call finishGame when onEnd is none', () => {
    const translator = new TimerTranslator();
    const config: ModuleConfig = {
      id: 'tm3',
      type: 'Timer',
      enabled: true,
      params: { duration: 30, mode: 'countdown', onEnd: 'none' },
    };
    const code = translator.translate(config);

    expect(code).not.toContain('finishGame()');
  });

  it('should require no special capabilities', () => {
    const translator = new TimerTranslator();
    expect(translator.getRequiredCapabilities()).toEqual([]);
  });
});

describe('GameFlowTranslator', () => {
  it('should generate state machine with startGame and finishGame', () => {
    const translator = new GameFlowTranslator();
    const config: ModuleConfig = {
      id: 'gf1',
      type: 'GameFlow',
      enabled: true,
      params: { countdown: 3, onFinish: 'show_result' },
    };
    const code = translator.translate(config);

    expect(code).toContain("gameState_gf1 = 'ready'");
    expect(code).toContain('function startGame()');
    expect(code).toContain('function finishGame()');
    expect(code).toContain("'countdown'");
    expect(code).toContain("'playing'");
    expect(code).toContain("'finished'");
  });

  it('should include showResult patch for show_result finish mode', () => {
    const translator = new GameFlowTranslator();
    const config: ModuleConfig = {
      id: 'gf2',
      type: 'GameFlow',
      enabled: true,
      params: { countdown: 3, onFinish: 'show_result' },
    };
    const code = translator.translate(config);

    expect(code).toContain("setBoolean('showResult', true)");
  });

  it('should include auto-restart for restart finish mode', () => {
    const translator = new GameFlowTranslator();
    const config: ModuleConfig = {
      id: 'gf3',
      type: 'GameFlow',
      enabled: true,
      params: { countdown: 3, onFinish: 'restart' },
    };
    const code = translator.translate(config);

    expect(code).toContain('startGame()');
    expect(code).toContain('Time.setTimeout');
  });

  it('should skip countdown interval when countdown is 0', () => {
    const translator = new GameFlowTranslator();
    const config: ModuleConfig = {
      id: 'gf4',
      type: 'GameFlow',
      enabled: true,
      params: { countdown: 0, onFinish: 'none' },
    };
    const code = translator.translate(config);

    // Should go directly to playing without interval
    expect(code).toContain("gameState_gf4 = 'playing'");
    expect(code).not.toContain('countdownInterval');
  });

  it('should require no special capabilities', () => {
    const translator = new GameFlowTranslator();
    expect(translator.getRequiredCapabilities()).toEqual([]);
  });
});
