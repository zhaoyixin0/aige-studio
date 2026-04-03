/**
 * B9: Schema params extension tests.
 * Validates that new params exist in getSchema() with correct types/defaults,
 * and that configure() accepts them without error.
 */
import { describe, it, expect } from 'vitest';
import { Scorer } from '../mechanic/scorer';
import { Spawner } from '../mechanic/spawner';
import { Collision } from '../mechanic/collision';
import { Lives } from '../mechanic/lives';
import { Runner } from '../mechanic/runner';
import { Jump } from '../mechanic/jump';
import { PlayerMovement } from '../mechanic/player-movement';
import { DifficultyRamp } from '../mechanic/difficulty-ramp';
import { Projectile } from '../mechanic/projectile';
import { WaveSpawner } from '../mechanic/wave-spawner';
import { Aim } from '../mechanic/aim';
import { SoundFX } from '../feedback/sound-fx';
import { GameFlow } from '../feedback/game-flow';

// ---------------------------------------------------------------------------
// Helper: assert a schema field exists with given type and default
// ---------------------------------------------------------------------------
function expectSchemaField(
  schema: Record<string, any>,
  key: string,
  type: string,
  defaultValue: unknown,
) {
  expect(schema).toHaveProperty(key);
  expect(schema[key].type).toBe(type);
  expect(schema[key].default).toEqual(defaultValue);
}

function expectSelectField(
  schema: Record<string, any>,
  key: string,
  defaultValue: string,
  options: string[],
) {
  expect(schema).toHaveProperty(key);
  expect(schema[key].type).toBe('select');
  expect(schema[key].default).toBe(defaultValue);
  expect(schema[key].options).toEqual(options);
}

// ---------------------------------------------------------------------------
// 1. Scorer
// ---------------------------------------------------------------------------
describe('Scorer schema params (B9)', () => {
  function makeScorer(params: Record<string, any> = {}) {
    return new Scorer('scorer-b9', params);
  }

  it('has comboWindow with default 2', () => {
    const schema = makeScorer().getSchema();
    expectSchemaField(schema, 'comboWindow', 'number', 2);
  });

  it('has comboMultiplierStep with default 0.5', () => {
    const schema = makeScorer().getSchema();
    expectSchemaField(schema, 'comboMultiplierStep', 'number', 0.5);
  });

  it('has critMultiplier with default 2', () => {
    const schema = makeScorer().getSchema();
    expectSchemaField(schema, 'critMultiplier', 'number', 2);
  });

  it('preserves existing deductOnMiss param', () => {
    const schema = makeScorer().getSchema();
    expectSchemaField(schema, 'deductOnMiss', 'boolean', false);
  });

  it('preserves existing scorePerSecond param', () => {
    const schema = makeScorer().getSchema();
    expectSchemaField(schema, 'scorePerSecond', 'number', 0);
  });

  it('configure() accepts new params without error', () => {
    const scorer = makeScorer();
    expect(() => {
      scorer.configure({ comboWindow: 3, comboMultiplierStep: 1, critMultiplier: 3 });
    }).not.toThrow();
    const params = scorer.getParams();
    expect(params.comboWindow).toBe(3);
    expect(params.comboMultiplierStep).toBe(1);
    expect(params.critMultiplier).toBe(3);
  });

  it('defaults are applied when no params provided', () => {
    const scorer = makeScorer();
    const params = scorer.getParams();
    expect(params.comboWindow).toBe(2);
    expect(params.comboMultiplierStep).toBe(0.5);
    expect(params.critMultiplier).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 2. Spawner
// ---------------------------------------------------------------------------
describe('Spawner schema params (B9)', () => {
  function makeSpawner(params: Record<string, any> = {}) {
    return new Spawner('spawner-b9', params);
  }

  it('has obstacleVariant select with default "normal"', () => {
    const schema = makeSpawner().getSchema();
    expectSelectField(schema, 'obstacleVariant', 'normal', ['normal', 'large', 'fast']);
  });

  it('has spawnSafeZone with default 50', () => {
    const schema = makeSpawner().getSchema();
    expectSchemaField(schema, 'spawnSafeZone', 'number', 50);
  });

  it('has dropShadow with default false', () => {
    const schema = makeSpawner().getSchema();
    expectSchemaField(schema, 'dropShadow', 'boolean', false);
  });

  it('has maxConcurrent with default 10', () => {
    // maxCount already exists with default 10 — verify maxConcurrent alias also exists
    const schema = makeSpawner().getSchema();
    expectSchemaField(schema, 'maxConcurrent', 'number', 10);
  });

  it('preserves existing maxCount param', () => {
    const schema = makeSpawner().getSchema();
    expect(schema).toHaveProperty('maxCount');
    expect(schema.maxCount.default).toBe(10);
  });

  it('configure() accepts new params without error', () => {
    const spawner = makeSpawner();
    expect(() => {
      spawner.configure({
        obstacleVariant: 'large',
        spawnSafeZone: 100,
        dropShadow: true,
        maxConcurrent: 20,
      });
    }).not.toThrow();
    const params = spawner.getParams();
    expect(params.obstacleVariant).toBe('large');
    expect(params.spawnSafeZone).toBe(100);
    expect(params.dropShadow).toBe(true);
    expect(params.maxConcurrent).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 3. Collision
// ---------------------------------------------------------------------------
describe('Collision schema params (B9)', () => {
  function makeCollision(params: Record<string, any> = {}) {
    return new Collision('collision-b9', params);
  }

  it('has hitboxWidth with default 40', () => {
    const schema = makeCollision().getSchema();
    expectSchemaField(schema, 'hitboxWidth', 'number', 40);
  });

  it('has hitboxHeight with default 40', () => {
    const schema = makeCollision().getSchema();
    expectSchemaField(schema, 'hitboxHeight', 'number', 40);
  });

  it('has collisionBuffer with default 0', () => {
    const schema = makeCollision().getSchema();
    expectSchemaField(schema, 'collisionBuffer', 'number', 0);
  });

  it('preserves existing hitboxScale param', () => {
    const schema = makeCollision().getSchema();
    expect(schema).toHaveProperty('hitboxScale');
    expect(schema.hitboxScale.default).toBe(1.0);
  });

  it('configure() accepts new params without error', () => {
    const collision = makeCollision();
    expect(() => {
      collision.configure({ hitboxWidth: 60, hitboxHeight: 80, collisionBuffer: 5 });
    }).not.toThrow();
    const params = collision.getParams();
    expect(params.hitboxWidth).toBe(60);
    expect(params.hitboxHeight).toBe(80);
    expect(params.collisionBuffer).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 4. Lives
// ---------------------------------------------------------------------------
describe('Lives schema params (B9)', () => {
  function makeLives(params: Record<string, any> = {}) {
    return new Lives('lives-b9', params);
  }

  it('has damageAmount with default 1', () => {
    const schema = makeLives().getSchema();
    expectSchemaField(schema, 'damageAmount', 'number', 1);
  });

  it('has shieldDuration with default 0', () => {
    const schema = makeLives().getSchema();
    expectSchemaField(schema, 'shieldDuration', 'number', 0);
  });

  it('preserves existing count param', () => {
    const schema = makeLives().getSchema();
    expect(schema).toHaveProperty('count');
    expect(schema.count.default).toBe(3);
  });

  it('configure() accepts new params without error', () => {
    const lives = makeLives();
    expect(() => {
      lives.configure({ damageAmount: 2, shieldDuration: 3 });
    }).not.toThrow();
    const params = lives.getParams();
    expect(params.damageAmount).toBe(2);
    expect(params.shieldDuration).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 5. Runner
// ---------------------------------------------------------------------------
describe('Runner schema params (B9)', () => {
  function makeRunner(params: Record<string, any> = {}) {
    return new Runner('runner-b9', params);
  }

  it('has trackWidth with default 300', () => {
    const schema = makeRunner().getSchema();
    expectSchemaField(schema, 'trackWidth', 'number', 300);
  });

  it('has steeringSensitivity with default 1', () => {
    const schema = makeRunner().getSchema();
    expectSchemaField(schema, 'steeringSensitivity', 'number', 1);
  });

  it('has slideDistance with default 100', () => {
    const schema = makeRunner().getSchema();
    expectSchemaField(schema, 'slideDistance', 'number', 100);
  });

  it('preserves existing laneCount param', () => {
    const schema = makeRunner().getSchema();
    expect(schema).toHaveProperty('laneCount');
    expect(schema.laneCount.default).toBe(3);
  });

  it('configure() accepts new params without error', () => {
    const runner = makeRunner();
    expect(() => {
      runner.configure({ trackWidth: 400, steeringSensitivity: 2, slideDistance: 150 });
    }).not.toThrow();
    const params = runner.getParams();
    expect(params.trackWidth).toBe(400);
    expect(params.steeringSensitivity).toBe(2);
    expect(params.slideDistance).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// 6. Jump
// ---------------------------------------------------------------------------
describe('Jump schema params (B9)', () => {
  function makeJump(params: Record<string, any> = {}) {
    return new Jump('jump-b9', params);
  }

  it('has doubleJumpWindow with default 0.3', () => {
    const schema = makeJump().getSchema();
    expectSchemaField(schema, 'doubleJumpWindow', 'number', 0.3);
  });

  it('has landingBuffer with default 0.1', () => {
    const schema = makeJump().getSchema();
    expectSchemaField(schema, 'landingBuffer', 'number', 0.1);
  });

  it('has jumpScoreMultiplier with default 1', () => {
    const schema = makeJump().getSchema();
    expectSchemaField(schema, 'jumpScoreMultiplier', 'number', 1);
  });

  it('preserves existing jumpForce param', () => {
    const schema = makeJump().getSchema();
    expect(schema).toHaveProperty('jumpForce');
    expect(schema.jumpForce.default).toBe(500);
  });

  it('configure() accepts new params without error', () => {
    const jump = makeJump();
    expect(() => {
      jump.configure({ doubleJumpWindow: 0.5, landingBuffer: 0.2, jumpScoreMultiplier: 2 });
    }).not.toThrow();
    const params = jump.getParams();
    expect(params.doubleJumpWindow).toBe(0.5);
    expect(params.landingBuffer).toBe(0.2);
    expect(params.jumpScoreMultiplier).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 7. PlayerMovement — verify defaultY and followLerp are exposed
// ---------------------------------------------------------------------------
describe('PlayerMovement schema params (B9)', () => {
  function makePM(params: Record<string, any> = {}) {
    return new PlayerMovement('pm-b9', params);
  }

  it('has defaultY exposed in schema', () => {
    const schema = makePM().getSchema();
    expect(schema).toHaveProperty('defaultY');
    expect(schema.defaultY.default).toBe(0.85);
  });

  it('has followLerp exposed in schema (as followSpeed)', () => {
    const schema = makePM().getSchema();
    // The follow-mode lerp factor is exposed as "followSpeed"
    expect(schema).toHaveProperty('followSpeed');
    expect(schema.followSpeed.default).toBe(0.15);
  });
});

// ---------------------------------------------------------------------------
// 8. DifficultyRamp
// ---------------------------------------------------------------------------
describe('DifficultyRamp schema params (B9)', () => {
  function makeDR(params: Record<string, any> = {}) {
    return new DifficultyRamp('dr-b9', params);
  }

  it('has initialDifficulty with default 1', () => {
    const schema = makeDR().getSchema();
    expectSchemaField(schema, 'initialDifficulty', 'number', 1);
  });

  it('has maxDifficulty with default 10', () => {
    const schema = makeDR().getSchema();
    expectSchemaField(schema, 'maxDifficulty', 'number', 10);
  });

  it('preserves existing target param', () => {
    const schema = makeDR().getSchema();
    expect(schema).toHaveProperty('target');
    expect(schema.target.default).toBe('');
  });

  it('configure() accepts new params without error', () => {
    const dr = makeDR();
    expect(() => {
      dr.configure({ initialDifficulty: 2, maxDifficulty: 15 });
    }).not.toThrow();
    const params = dr.getParams();
    expect(params.initialDifficulty).toBe(2);
    expect(params.maxDifficulty).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// 9. Projectile (medium priority)
// ---------------------------------------------------------------------------
describe('Projectile schema params (B9)', () => {
  function makeProjectile(params: Record<string, any> = {}) {
    return new Projectile('proj-b9', params);
  }

  it('has clipCapacity with default 30', () => {
    const schema = makeProjectile().getSchema();
    expectSchemaField(schema, 'clipCapacity', 'number', 30);
  });

  it('has recoil with default 0', () => {
    const schema = makeProjectile().getSchema();
    expectSchemaField(schema, 'recoil', 'number', 0);
  });

  it('has burstLimit with default 1', () => {
    const schema = makeProjectile().getSchema();
    expectSchemaField(schema, 'burstLimit', 'number', 1);
  });

  it('has fireInterval with default 0.1', () => {
    const schema = makeProjectile().getSchema();
    expectSchemaField(schema, 'fireInterval', 'number', 0.1);
  });

  it('preserves existing speed param', () => {
    const schema = makeProjectile().getSchema();
    expect(schema).toHaveProperty('speed');
    expect(schema.speed.default).toBe(600);
  });

  it('configure() accepts new params without error', () => {
    const proj = makeProjectile();
    expect(() => {
      proj.configure({ clipCapacity: 10, recoil: 5, burstLimit: 3, fireInterval: 0.2 });
    }).not.toThrow();
    const params = proj.getParams();
    expect(params.clipCapacity).toBe(10);
    expect(params.recoil).toBe(5);
    expect(params.burstLimit).toBe(3);
    expect(params.fireInterval).toBe(0.2);
  });
});

// ---------------------------------------------------------------------------
// 10. WaveSpawner (medium priority)
// ---------------------------------------------------------------------------
describe('WaveSpawner schema params (B9)', () => {
  function makeWS(params: Record<string, any> = {}) {
    return new WaveSpawner('ws-b9', params);
  }

  it('has waveInterval with default 5', () => {
    const schema = makeWS().getSchema();
    expectSchemaField(schema, 'waveInterval', 'number', 5);
  });

  it('has maxBulletsPerWave with default 10', () => {
    const schema = makeWS().getSchema();
    expectSchemaField(schema, 'maxBulletsPerWave', 'number', 10);
  });

  it('preserves existing enemiesPerWave param', () => {
    const schema = makeWS().getSchema();
    expect(schema).toHaveProperty('enemiesPerWave');
    expect(schema.enemiesPerWave.default).toBe(5);
  });

  it('configure() accepts new params without error', () => {
    const ws = makeWS();
    expect(() => {
      ws.configure({ waveInterval: 10, maxBulletsPerWave: 20 });
    }).not.toThrow();
    const params = ws.getParams();
    expect(params.waveInterval).toBe(10);
    expect(params.maxBulletsPerWave).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 11. Aim (medium priority)
// ---------------------------------------------------------------------------
describe('Aim schema params (B9)', () => {
  function makeAim(params: Record<string, any> = {}) {
    return new Aim('aim-b9', params);
  }

  it('has crosshairWidth with default 32', () => {
    const schema = makeAim().getSchema();
    expectSchemaField(schema, 'crosshairWidth', 'number', 32);
  });

  it('has crosshairPattern select with default "crosshair"', () => {
    const schema = makeAim().getSchema();
    expectSelectField(schema, 'crosshairPattern', 'crosshair', ['crosshair', 'dot', 'circle']);
  });

  it('preserves existing mode param', () => {
    const schema = makeAim().getSchema();
    expect(schema).toHaveProperty('mode');
    expect(schema.mode.default).toBe('auto');
  });

  it('configure() accepts new params without error', () => {
    const aim = makeAim();
    expect(() => {
      aim.configure({ crosshairWidth: 48, crosshairPattern: 'dot' });
    }).not.toThrow();
    const params = aim.getParams();
    expect(params.crosshairWidth).toBe(48);
    expect(params.crosshairPattern).toBe('dot');
  });
});

// ---------------------------------------------------------------------------
// 12. SoundFX (medium priority)
// ---------------------------------------------------------------------------
describe('SoundFX schema params (B9)', () => {
  function makeSFX(params: Record<string, any> = {}) {
    return new SoundFX('sfx-b9', params);
  }

  it('has bgmAsset with default ""', () => {
    const schema = makeSFX().getSchema();
    expectSchemaField(schema, 'bgmAsset', 'string', '');
  });

  it('has hitSoundAsset with default ""', () => {
    const schema = makeSFX().getSchema();
    expectSchemaField(schema, 'hitSoundAsset', 'string', '');
  });

  it('has feedbackVolume with default 0.8', () => {
    const schema = makeSFX().getSchema();
    expectSchemaField(schema, 'feedbackVolume', 'number', 0.8);
  });

  it('preserves existing volume param', () => {
    const schema = makeSFX().getSchema();
    expect(schema).toHaveProperty('volume');
    expect(schema.volume.default).toBe(0.8);
  });

  it('configure() accepts new params without error', () => {
    const sfx = makeSFX();
    expect(() => {
      sfx.configure({ bgmAsset: 'bgm1', hitSoundAsset: 'hit1', feedbackVolume: 0.5 });
    }).not.toThrow();
    const params = sfx.getParams();
    expect(params.bgmAsset).toBe('bgm1');
    expect(params.hitSoundAsset).toBe('hit1');
    expect(params.feedbackVolume).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// 13. GameFlow (medium priority)
// ---------------------------------------------------------------------------
describe('GameFlow schema params (B9)', () => {
  function makeGF(params: Record<string, any> = {}) {
    return new GameFlow('gf-b9', params);
  }

  it('has failRestartDelay with default 1', () => {
    const schema = makeGF().getSchema();
    expectSchemaField(schema, 'failRestartDelay', 'number', 1);
  });

  it('has pauseAllowed with default true', () => {
    const schema = makeGF().getSchema();
    expectSchemaField(schema, 'pauseAllowed', 'boolean', true);
  });

  it('preserves existing countdown param', () => {
    const schema = makeGF().getSchema();
    expect(schema).toHaveProperty('countdown');
    expect(schema.countdown.default).toBe(3);
  });

  it('configure() accepts new params without error', () => {
    const gf = makeGF();
    expect(() => {
      gf.configure({ failRestartDelay: 2, pauseAllowed: false });
    }).not.toThrow();
    const params = gf.getParams();
    expect(params.failRestartDelay).toBe(2);
    expect(params.pauseAllowed).toBe(false);
  });
});
