import { PlanckAdapter } from './adapters/planck-adapter';
import type { IPhysics2DAdapter } from './adapters/i-physics2d-adapter';
import type {
  RigidBody2DConfig,
  Collider2DConfig,
  PhysicsWorldConfig,
  RaycastHit,
  ContactEvent,
} from './types';

type EventEmitter = (event: string, data: Record<string, unknown>) => void;

export class Physics2DSystem {
  private readonly adapter: IPhysics2DAdapter;
  private readonly config: PhysicsWorldConfig;
  private readonly emit: EventEmitter;
  private readonly bodyIds: string[] = [];
  private accumulator = 0;

  constructor(config: PhysicsWorldConfig, emit: EventEmitter) {
    this.config = config;
    this.emit = emit;
    this.adapter = new PlanckAdapter(config.pixelsPerMeter);
    this.adapter.createWorld(config.gravityX, config.gravityY);
  }

  addBody(
    entityId: string,
    bodyConfig: RigidBody2DConfig,
    colliders: readonly Collider2DConfig[],
    x: number,
    y: number,
  ): void {
    this.adapter.createBody(entityId, bodyConfig, x, y);
    for (const c of colliders) {
      this.adapter.addCollider(entityId, c);
    }
    this.bodyIds.push(entityId);
  }

  removeBody(entityId: string): void {
    this.adapter.removeBody(entityId);
    const idx = this.bodyIds.indexOf(entityId);
    if (idx !== -1) this.bodyIds.splice(idx, 1);
  }

  update(dt: number): void {
    this.accumulator += dt;

    let steps = 0;
    while (this.accumulator >= this.config.fixedTimeStep && steps < this.config.maxSubSteps) {
      this.adapter.step(this.config.fixedTimeStep);
      this.accumulator -= this.config.fixedTimeStep;
      steps++;

      // Emit contact events from this sub-step
      for (const c of this.adapter.getContacts()) {
        this.emitContact('physics2d:contact-begin', c);
      }
      for (const c of this.adapter.getEndContacts()) {
        this.emitContact('physics2d:contact-end', c);
      }
    }

    // Clamp accumulator to prevent spiral of death — only when cap was hit
    if (steps >= this.config.maxSubSteps) {
      this.accumulator = 0;
    }
  }

  getPosition(entityId: string): { x: number; y: number } | null {
    return this.adapter.getPosition(entityId);
  }

  getVelocity(entityId: string): { x: number; y: number } | null {
    return this.adapter.getVelocity(entityId);
  }

  getAngle(entityId: string): number {
    return this.adapter.getAngle(entityId);
  }

  setPosition(entityId: string, x: number, y: number): void {
    this.adapter.setPosition(entityId, x, y);
  }

  setVelocity(entityId: string, vx: number, vy: number): void {
    this.adapter.setVelocity(entityId, vx, vy);
  }

  applyForce(entityId: string, fx: number, fy: number): void {
    this.adapter.applyForce(entityId, fx, fy);
  }

  applyImpulse(entityId: string, ix: number, iy: number): void {
    this.adapter.applyImpulse(entityId, ix, iy);
  }

  raycast(fromX: number, fromY: number, toX: number, toY: number): RaycastHit | null {
    return this.adapter.raycast(fromX, fromY, toX, toY);
  }

  getAllBodyIds(): string[] {
    return [...this.bodyIds];
  }

  clear(): void {
    for (const id of [...this.bodyIds]) {
      this.adapter.removeBody(id);
    }
    this.bodyIds.length = 0;
  }

  private emitContact(event: string, c: ContactEvent): void {
    this.emit(event, {
      entityIdA: c.entityIdA,
      entityIdB: c.entityIdB,
      tagA: c.tagA,
      tagB: c.tagB,
      pointX: c.point[0],
      pointY: c.point[1],
      normalX: c.normal[0],
      normalY: c.normal[1],
    });
  }

  destroy(): void {
    this.clear();
    this.adapter.destroy();
  }
}
