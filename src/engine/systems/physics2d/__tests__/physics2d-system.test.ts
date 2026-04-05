import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Physics2DSystem } from '../physics2d-system';
import type { PhysicsWorldConfig } from '../types';

describe('Physics2DSystem', () => {
  let system: Physics2DSystem;
  let onEvent: ReturnType<typeof vi.fn>;

  const config: PhysicsWorldConfig = {
    gravityX: 0,
    gravityY: 9.81,
    pixelsPerMeter: 33.33,
    fixedTimeStep: 1 / 60,
    maxSubSteps: 5,
  };

  beforeEach(() => {
    onEvent = vi.fn();
    system = new Physics2DSystem(config, onEvent as (event: string, data: Record<string, unknown>) => void);
  });

  afterEach(() => {
    system.destroy();
  });

  it('creates the system without error', () => {
    expect(system).toBeDefined();
  });

  it('adds a dynamic body and steps', () => {
    system.addBody('ball', { type: 'dynamic' }, [{ shape: { kind: 'Circle', radius: 16 }, density: 1 }], 100, 100);
    system.update(1 / 60);
    const pos = system.getPosition('ball');
    expect(pos).not.toBeNull();
  });

  it('dynamic body falls under gravity', () => {
    system.addBody('ball', { type: 'dynamic' }, [{ shape: { kind: 'Circle', radius: 16 }, density: 1 }], 100, 100);
    const before = system.getPosition('ball')!;
    system.update(0.5); // half second
    const after = system.getPosition('ball')!;
    expect(after.y).toBeGreaterThan(before.y);
  });

  it('static body does not move', () => {
    system.addBody('ground', { type: 'static' }, [{ shape: { kind: 'Box', width: 1000, height: 20 } }], 540, 1000);
    system.update(0.5);
    const pos = system.getPosition('ground')!;
    expect(pos.x).toBeCloseTo(540, 0);
    expect(pos.y).toBeCloseTo(1000, 0);
  });

  it('fixed-step accumulator caps sub-steps', () => {
    system.addBody('ball', { type: 'dynamic' }, [{ shape: { kind: 'Circle', radius: 16 }, density: 1 }], 100, 100);
    // Large dt = 1s, maxSubSteps=5 so only 5 * (1/60) = 0.083s effective
    system.update(1.0);
    const pos = system.getPosition('ball')!;
    // Ball should have fallen but not as much as 1s of free fall
    expect(pos.y).toBeGreaterThan(100);
    expect(pos.y).toBeLessThan(600); // capped
  });

  it('emits physics2d:contact-begin on collision', () => {
    system.addBody('ground', { type: 'static' }, [{ shape: { kind: 'Box', width: 1080, height: 20 } }], 540, 500);
    system.addBody('ball', { type: 'dynamic' }, [{ shape: { kind: 'Circle', radius: 16 }, density: 1 }], 540, 400);

    // Step enough for ball to fall and hit ground
    for (let i = 0; i < 60; i++) system.update(1 / 60);

    expect(onEvent).toHaveBeenCalledWith(
      'physics2d:contact-begin',
      expect.objectContaining({
        entityIdA: expect.any(String),
        entityIdB: expect.any(String),
      }),
    );
  });

  it('removeBody cleans up', () => {
    system.addBody('temp', { type: 'dynamic' }, [{ shape: { kind: 'Circle', radius: 16 } }], 100, 100);
    system.removeBody('temp');
    expect(system.getPosition('temp')).toBeNull();
  });

  it('setVelocity and getVelocity round-trip', () => {
    system.addBody('ball', { type: 'dynamic' }, [{ shape: { kind: 'Circle', radius: 16 }, density: 1 }], 100, 100);
    system.setVelocity('ball', 300, -100);
    const vel = system.getVelocity('ball')!;
    expect(vel.x).toBeCloseTo(300, 0);
    expect(vel.y).toBeCloseTo(-100, 0);
  });

  it('applyImpulse affects velocity', () => {
    system.addBody('ball', { type: 'dynamic' }, [{ shape: { kind: 'Circle', radius: 16 }, density: 1 }], 100, 100);
    system.applyImpulse('ball', 500, 0);
    system.update(1 / 60);
    const vel = system.getVelocity('ball')!;
    expect(vel.x).toBeGreaterThan(0);
  });

  it('getAllBodies returns all registered bodies', () => {
    system.addBody('a', { type: 'dynamic' }, [{ shape: { kind: 'Circle', radius: 8 } }], 0, 0);
    system.addBody('b', { type: 'static' }, [{ shape: { kind: 'Box', width: 10, height: 10 } }], 0, 0);
    expect(system.getAllBodyIds()).toEqual(['a', 'b']);
  });

  it('clear removes all bodies', () => {
    system.addBody('a', { type: 'dynamic' }, [{ shape: { kind: 'Circle', radius: 8 } }], 0, 0);
    system.addBody('b', { type: 'dynamic' }, [{ shape: { kind: 'Circle', radius: 8 } }], 0, 0);
    system.clear();
    expect(system.getAllBodyIds()).toEqual([]);
  });
});
