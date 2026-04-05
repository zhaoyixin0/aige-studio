import type {
  RigidBody2DConfig,
  Collider2DConfig,
  RaycastHit,
  ContactEvent,
} from '../types';

export interface IPhysics2DAdapter {
  createWorld(gravityX: number, gravityY: number): void;
  createBody(entityId: string, config: RigidBody2DConfig, x: number, y: number): void;
  addCollider(entityId: string, config: Collider2DConfig): void;
  removeBody(entityId: string): void;

  step(dt: number): void;

  getPosition(entityId: string): { x: number; y: number } | null;
  getAngle(entityId: string): number;
  getVelocity(entityId: string): { x: number; y: number } | null;

  setPosition(entityId: string, x: number, y: number): void;
  setVelocity(entityId: string, vx: number, vy: number): void;
  applyForce(entityId: string, fx: number, fy: number): void;
  applyImpulse(entityId: string, ix: number, iy: number): void;

  raycast(
    fromX: number, fromY: number,
    toX: number, toY: number,
  ): RaycastHit | null;

  getContacts(): readonly ContactEvent[];
  getEndContacts(): readonly ContactEvent[];
  hasBody(entityId: string): boolean;

  destroy(): void;
}
