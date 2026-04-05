import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlanckAdapter } from '../adapters/planck-adapter';

describe('PlanckAdapter', () => {
  let adapter: PlanckAdapter;
  const PPM = 33.33; // pixels per meter

  beforeEach(() => {
    adapter = new PlanckAdapter(PPM);
    adapter.createWorld(0, 9.81);
  });

  afterEach(() => {
    adapter.destroy();
  });

  it('creates a world with gravity', () => {
    // World created in beforeEach — just verify no error
    expect(adapter).toBeDefined();
  });

  it('creates a dynamic body', () => {
    adapter.createBody('ball', { type: 'dynamic' }, 100, 200);
    expect(adapter.hasBody('ball')).toBe(true);
  });

  it('creates a static body', () => {
    adapter.createBody('ground', { type: 'static' }, 0, 500);
    expect(adapter.hasBody('ground')).toBe(true);
  });

  it('creates a kinematic body', () => {
    adapter.createBody('platform', { type: 'kinematic' }, 200, 300);
    expect(adapter.hasBody('platform')).toBe(true);
  });

  it('adds circle collider to body', () => {
    adapter.createBody('ball', { type: 'dynamic' }, 100, 200);
    adapter.addCollider('ball', { shape: { kind: 'Circle', radius: 16 } });
    // No error = success
    expect(adapter.hasBody('ball')).toBe(true);
  });

  it('adds box collider to body', () => {
    adapter.createBody('box', { type: 'dynamic' }, 100, 200);
    adapter.addCollider('box', { shape: { kind: 'Box', width: 32, height: 32 } });
    expect(adapter.hasBody('box')).toBe(true);
  });

  it('adds edge collider to body', () => {
    adapter.createBody('wall', { type: 'static' }, 0, 0);
    adapter.addCollider('wall', { shape: { kind: 'Edge', points: [[0, 0], [100, 0], [100, 100]] } });
    expect(adapter.hasBody('wall')).toBe(true);
  });

  it('removes a body', () => {
    adapter.createBody('temp', { type: 'dynamic' }, 0, 0);
    adapter.removeBody('temp');
    expect(adapter.hasBody('temp')).toBe(false);
  });

  it('removeBody is safe for unknown entityId', () => {
    adapter.removeBody('nonexistent');
    // No error
  });

  it('steps the world without error', () => {
    adapter.createBody('ball', { type: 'dynamic', gravityScale: 1 }, 100, 100);
    adapter.addCollider('ball', { shape: { kind: 'Circle', radius: 16 } });
    adapter.step(1 / 60);
    // Ball should have fallen
    const pos = adapter.getPosition('ball');
    expect(pos).not.toBeNull();
  });

  it('dynamic body falls under gravity', () => {
    adapter.createBody('ball', { type: 'dynamic' }, 100, 100);
    adapter.addCollider('ball', { shape: { kind: 'Circle', radius: 16 }, density: 1 });
    const before = adapter.getPosition('ball')!;
    for (let i = 0; i < 10; i++) adapter.step(1 / 60);
    const after = adapter.getPosition('ball')!;
    // Gravity is positive Y (downward), so y should increase (in pixel space)
    expect(after.y).toBeGreaterThan(before.y);
  });

  it('static body does not move', () => {
    adapter.createBody('ground', { type: 'static' }, 100, 500);
    adapter.addCollider('ground', { shape: { kind: 'Box', width: 1000, height: 20 } });
    for (let i = 0; i < 10; i++) adapter.step(1 / 60);
    const pos = adapter.getPosition('ground')!;
    expect(pos.x).toBeCloseTo(100, 0);
    expect(pos.y).toBeCloseTo(500, 0);
  });

  it('getVelocity returns velocity in pixels/s', () => {
    adapter.createBody('ball', { type: 'dynamic' }, 100, 100);
    adapter.addCollider('ball', { shape: { kind: 'Circle', radius: 16 }, density: 1 });
    for (let i = 0; i < 10; i++) adapter.step(1 / 60);
    const vel = adapter.getVelocity('ball')!;
    expect(vel.y).toBeGreaterThan(0); // falling
  });

  it('setPosition moves body immediately', () => {
    adapter.createBody('ball', { type: 'dynamic' }, 100, 100);
    adapter.setPosition('ball', 500, 300);
    const pos = adapter.getPosition('ball')!;
    expect(pos.x).toBeCloseTo(500, 0);
    expect(pos.y).toBeCloseTo(300, 0);
  });

  it('setVelocity changes velocity', () => {
    adapter.createBody('ball', { type: 'dynamic' }, 100, 100);
    adapter.addCollider('ball', { shape: { kind: 'Circle', radius: 16 }, density: 1 });
    adapter.setVelocity('ball', 200, 0);
    const vel = adapter.getVelocity('ball')!;
    expect(vel.x).toBeCloseTo(200, 0);
  });

  it('applyForce affects velocity over time', () => {
    adapter.createBody('ball', { type: 'dynamic' }, 100, 100);
    adapter.addCollider('ball', { shape: { kind: 'Circle', radius: 16 }, density: 1 });
    adapter.applyForce('ball', 1000, 0);
    adapter.step(1 / 60);
    const vel = adapter.getVelocity('ball')!;
    expect(vel.x).toBeGreaterThan(0);
  });

  it('getContacts detects collision', () => {
    // Create ground and falling ball
    adapter.createBody('ground', { type: 'static' }, 540, 1000);
    adapter.addCollider('ground', { shape: { kind: 'Box', width: 1080, height: 20 } });

    adapter.createBody('ball', { type: 'dynamic' }, 540, 900);
    adapter.addCollider('ball', { shape: { kind: 'Circle', radius: 16 }, density: 1 });

    // Accumulate contacts across multiple steps
    let totalContacts = 0;
    for (let i = 0; i < 120; i++) {
      adapter.step(1 / 60);
      totalContacts += adapter.getContacts().length;
    }

    expect(totalContacts).toBeGreaterThan(0);
  });

  it('getPosition returns null for unknown entity', () => {
    expect(adapter.getPosition('ghost')).toBeNull();
  });

  it('getVelocity returns null for unknown entity', () => {
    expect(adapter.getVelocity('ghost')).toBeNull();
  });

  it('destroy cleans up world', () => {
    adapter.createBody('ball', { type: 'dynamic' }, 100, 100);
    adapter.destroy();
    expect(adapter.hasBody('ball')).toBe(false);
  });

  it('supports body config options', () => {
    adapter.createBody('ball', {
      type: 'dynamic',
      linearDamping: 0.5,
      angularDamping: 0.1,
      fixedRotation: true,
      gravityScale: 0.5,
    }, 100, 100);
    expect(adapter.hasBody('ball')).toBe(true);
  });

  it('supports collider sensor mode', () => {
    adapter.createBody('trigger', { type: 'static' }, 100, 100);
    adapter.addCollider('trigger', {
      shape: { kind: 'Box', width: 64, height: 64 },
      isSensor: true,
    });
    expect(adapter.hasBody('trigger')).toBe(true);
  });
});
