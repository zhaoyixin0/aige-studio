import { describe, it, expect } from 'vitest';
import type {
  BodyType2D,
  RigidBody2DConfig,
  ColliderShape2D,
  Collider2DConfig,
  RaycastHit,
  PhysicsBody,
  PhysicsWorldConfig,
} from '../types';

describe('Physics2D Types', () => {
  it('BodyType2D has three options', () => {
    const types: BodyType2D[] = ['static', 'dynamic', 'kinematic'];
    expect(types).toHaveLength(3);
  });

  it('RigidBody2DConfig supports all physics params', () => {
    const body: RigidBody2DConfig = {
      type: 'dynamic',
      linearDamping: 0.1,
      angularDamping: 0.05,
      fixedRotation: true,
      gravityScale: 1,
      mass: 2,
    };
    expect(body.type).toBe('dynamic');
    expect(body.fixedRotation).toBe(true);
  });

  it('ColliderShape2D supports Circle', () => {
    const shape: ColliderShape2D = { kind: 'Circle', radius: 32 };
    expect(shape.kind).toBe('Circle');
    expect(shape.radius).toBe(32);
  });

  it('ColliderShape2D supports Box', () => {
    const shape: ColliderShape2D = { kind: 'Box', width: 64, height: 32 };
    expect(shape.kind).toBe('Box');
  });

  it('ColliderShape2D supports Edge', () => {
    const shape: ColliderShape2D = { kind: 'Edge', points: [[0, 0], [100, 0], [100, 100]] };
    expect(shape.kind).toBe('Edge');
    expect(shape.points).toHaveLength(3);
  });

  it('ColliderShape2D supports offset', () => {
    const shape: ColliderShape2D = { kind: 'Circle', radius: 16, offset: [5, -3] };
    expect(shape.offset).toEqual([5, -3]);
  });

  it('Collider2DConfig bundles shape with physics params', () => {
    const collider: Collider2DConfig = {
      shape: { kind: 'Box', width: 50, height: 50 },
      isSensor: false,
      density: 1,
      restitution: 0.5,
      friction: 0.3,
      tag: 'wall',
    };
    expect(collider.restitution).toBe(0.5);
    expect(collider.tag).toBe('wall');
  });

  it('RaycastHit contains hit info', () => {
    const hit: RaycastHit = {
      point: [100, 200],
      normal: [0, -1],
      distance: 150,
      entityId: 'wall_1',
      colliderTag: 'wall',
    };
    expect(hit.distance).toBe(150);
  });

  it('PhysicsBody tracks entity + body state', () => {
    const body: PhysicsBody = {
      entityId: 'ball_1',
      bodyConfig: { type: 'dynamic' },
      colliders: [{ shape: { kind: 'Circle', radius: 16 } }],
      x: 100,
      y: 200,
      angle: 0,
      velocityX: 50,
      velocityY: -30,
    };
    expect(body.entityId).toBe('ball_1');
    expect(body.velocityX).toBe(50);
  });

  it('PhysicsWorldConfig has gravity and scale', () => {
    const config: PhysicsWorldConfig = {
      gravityX: 0,
      gravityY: 9.81,
      pixelsPerMeter: 33.33,
      fixedTimeStep: 1 / 60,
      maxSubSteps: 5,
    };
    expect(config.pixelsPerMeter).toBeCloseTo(33.33);
    expect(config.maxSubSteps).toBe(5);
  });
});
