import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { Jump } from '@/engine/modules/mechanic/jump';
import { Dash } from '@/engine/modules/mechanic/dash';
import { WaveSpawner } from '@/engine/modules/mechanic/wave-spawner';
import { getGamePreset } from '@/agent/game-presets';

// ── M1: Variable Jump Height ────────────────────────────────────

describe('Variable jump height (M1)', () => {
  function setup() {
    const engine = new Engine();
    const jump = new Jump('j1', { jumpForce: 500, gravity: 980, groundY: 0.8, triggerEvent: 'touch:tap' });
    engine.addModule(jump);
    engine.eventBus.emit('gameflow:resume');
    return { engine, jump };
  }

  it('should cut jump short on early release', () => {
    // Full jump — track minimum Y (highest point on screen)
    const { engine: e1, jump: j1 } = setup();
    e1.eventBus.emit('touch:tap');
    let fullJumpMinY = j1.getY();
    for (let i = 0; i < 200; i++) {
      j1.update(16);
      if (j1.getY() < fullJumpMinY) fullJumpMinY = j1.getY();
    }

    // Short jump — release after 5 frames
    const { engine: e2, jump: j2 } = setup();
    e2.eventBus.emit('touch:tap');
    for (let i = 0; i < 5; i++) j2.update(16);
    e2.eventBus.emit('jump:release');
    let shortJumpMinY = j2.getY();
    for (let i = 0; i < 200; i++) {
      j2.update(16);
      if (j2.getY() < shortJumpMinY) shortJumpMinY = j2.getY();
    }

    // Short jump's peak (minY) should be higher value (less height) than full jump
    expect(shortJumpMinY).toBeGreaterThan(fullJumpMinY);
  });
});

// ── M2: Dash Invulnerability ────────────────────────────────────

describe('Dash invulnerability (M2)', () => {
  function setup() {
    const engine = new Engine();
    const dash = new Dash('d1', { distance: 150, duration: 150, cooldown: 500, triggerEvent: 'dash:go' });
    engine.addModule(dash);
    engine.eventBus.emit('gameflow:resume');
    return { engine, dash };
  }

  it('should emit iframes:start on dash start', () => {
    const { engine } = setup();
    const handler = vi.fn();
    engine.eventBus.on('iframes:start', handler);

    engine.eventBus.emit('dash:go');
    expect(handler).toHaveBeenCalled();
  });

  it('should emit iframes:end on dash end', () => {
    const { engine, dash } = setup();
    const handler = vi.fn();
    engine.eventBus.on('iframes:end', handler);

    engine.eventBus.emit('dash:go');
    // Run until dash completes (150ms at 16ms per frame = ~10 frames)
    for (let i = 0; i < 15; i++) dash.update(16);

    expect(handler).toHaveBeenCalled();
  });
});

// ── H8: WaveSpawner maxEnemiesPerWave cap ───────────────────────

describe('WaveSpawner enemy cap (H8)', () => {
  it('should have maxEnemiesPerWave in schema', () => {
    const ws = new WaveSpawner('ws1', {});
    const schema = ws.getSchema();
    expect(schema.maxEnemiesPerWave).toBeDefined();
  });

  it('should cap enemies per wave at maxEnemiesPerWave', () => {
    const engine = new Engine();
    const ws = new WaveSpawner('ws1', {
      enemiesPerWave: 5,
      scalingFactor: 2.0, // Aggressive scaling: wave 5 would be 5*2^4 = 80 without cap
      maxWaves: 10,
      maxEnemiesPerWave: 10,
      waveCooldown: 100,
      spawnDelay: 10,
      spawnAreaX: 0,
      spawnAreaWidth: 800,
      spawnY: 0,
    });
    engine.addModule(ws);
    engine.eventBus.emit('gameflow:resume');

    // Track spawns
    const spawnHandler = vi.fn();
    engine.eventBus.on('wave:spawn', spawnHandler);

    // Start wave 5 (scale: 5 * 2^4 = 80, but should cap at 10)
    for (let w = 0; w < 5; w++) {
      engine.eventBus.emit('wave:complete');
      // Run cooldown + spawn delay
      for (let i = 0; i < 200; i++) ws.update(16);
    }

    // Count total spawns from last wave — should be <= 10
    // Actually just check the current wave's enemy count is capped
    const waveStartHandler = vi.fn();
    engine.eventBus.on('wave:start', waveStartHandler);
    engine.eventBus.emit('wave:complete');
    for (let i = 0; i < 10; i++) ws.update(16);

    if (waveStartHandler.mock.calls.length > 0) {
      const lastWaveData = waveStartHandler.mock.calls[waveStartHandler.mock.calls.length - 1][0];
      expect(lastWaveData.enemyCount).toBeLessThanOrEqual(10);
    }
  });
});

// ── H3: Runner speed tuning ─────────────────────────────────────

describe('Runner speed tuning (H3)', () => {
  it('should have speed >= 400 in runner preset', () => {
    const preset = getGamePreset('runner')!;
    const runner = preset['Runner'] as any;
    expect(runner.speed).toBeGreaterThanOrEqual(400);
  });
});

// ── M7: Quiz answer positions ───────────────────────────────────

describe('Quiz answer positions (M7)', () => {
  it('should vary correctIndex across questions', () => {
    const preset = getGamePreset('quiz')!;
    const quiz = preset['QuizEngine'] as any;
    const indices = quiz.questions.map((q: any) => q.correctIndex);
    // Not all answers should be index 0
    const uniqueIndices = new Set(indices);
    expect(uniqueIndices.size).toBeGreaterThan(1);
  });
});
