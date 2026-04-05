import * as planck from 'planck';
import type { IPhysics2DAdapter } from './i-physics2d-adapter';
import type {
  RigidBody2DConfig,
  Collider2DConfig,
  RaycastHit,
  ContactEvent,
} from '../types';

interface BodyEntry {
  body: planck.Body;
  entityId: string;
  tags: string[];
}

export class PlanckAdapter implements IPhysics2DAdapter {
  private world: planck.World | null = null;
  private readonly bodies = new Map<string, BodyEntry>();
  private readonly ppm: number;
  private contacts: ContactEvent[] = [];
  private endContacts: ContactEvent[] = [];

  constructor(pixelsPerMeter: number) {
    this.ppm = pixelsPerMeter;
  }

  createWorld(gravityX: number, gravityY: number): void {
    this.world = new planck.World({
      gravity: planck.Vec2(gravityX, gravityY),
    });

    this.world.on('begin-contact', (contact: planck.Contact) => {
      this.handleContact(contact, this.contacts);
    });

    this.world.on('end-contact', (contact: planck.Contact) => {
      this.handleContact(contact, this.endContacts);
    });
  }

  createBody(entityId: string, config: RigidBody2DConfig, x: number, y: number): void {
    if (!this.world) return;

    const bodyDef: planck.BodyDef = {
      type: config.type,
      position: planck.Vec2(x / this.ppm, y / this.ppm),
      linearDamping: config.linearDamping ?? 0,
      angularDamping: config.angularDamping ?? 0,
      fixedRotation: config.fixedRotation ?? false,
      gravityScale: config.gravityScale ?? 1,
    };

    const body = this.world.createBody(bodyDef);

    if (config.mass && config.mass > 0 && config.type === 'dynamic') {
      body.setMassData({
        mass: config.mass,
        center: planck.Vec2(0, 0),
        I: 0,
      });
    }

    this.bodies.set(entityId, { body, entityId, tags: [] });
  }

  addCollider(entityId: string, config: Collider2DConfig): void {
    const entry = this.bodies.get(entityId);
    if (!entry) return;

    const opts = {
      density: config.density ?? 1,
      restitution: config.restitution ?? 0,
      friction: config.friction ?? 0.3,
      isSensor: config.isSensor ?? false,
    };

    let shape: planck.Shape;
    const s = config.shape;
    const ox = (s.offset?.[0] ?? 0) / this.ppm;
    const oy = (s.offset?.[1] ?? 0) / this.ppm;

    switch (s.kind) {
      case 'Circle':
        shape = new planck.Circle(planck.Vec2(ox, oy), s.radius / this.ppm);
        break;
      case 'Box':
        shape = planck.Box(
          s.width / 2 / this.ppm,
          s.height / 2 / this.ppm,
          planck.Vec2(ox, oy),
          0,
        );
        break;
      case 'Edge': {
        const pts = s.points.map((p) => planck.Vec2(p[0] / this.ppm, p[1] / this.ppm));
        shape = new planck.Chain(pts, false);
        break;
      }
    }

    const fixture = entry.body.createFixture(shape, opts);
    if (config.tag) {
      fixture.setUserData({ tag: config.tag });
      entry.tags.push(config.tag);
    }
  }

  removeBody(entityId: string): void {
    const entry = this.bodies.get(entityId);
    if (!entry || !this.world) return;
    this.world.destroyBody(entry.body);
    this.bodies.delete(entityId);
  }

  step(dt: number): void {
    if (!this.world) return;
    this.world.step(dt);
  }

  getPosition(entityId: string): { x: number; y: number } | null {
    const entry = this.bodies.get(entityId);
    if (!entry) return null;
    const pos = entry.body.getPosition();
    return { x: pos.x * this.ppm, y: pos.y * this.ppm };
  }

  getAngle(entityId: string): number {
    const entry = this.bodies.get(entityId);
    if (!entry) return 0;
    return entry.body.getAngle();
  }

  getVelocity(entityId: string): { x: number; y: number } | null {
    const entry = this.bodies.get(entityId);
    if (!entry) return null;
    const vel = entry.body.getLinearVelocity();
    return { x: vel.x * this.ppm, y: vel.y * this.ppm };
  }

  setPosition(entityId: string, x: number, y: number): void {
    const entry = this.bodies.get(entityId);
    if (!entry) return;
    entry.body.setPosition(planck.Vec2(x / this.ppm, y / this.ppm));
  }

  setVelocity(entityId: string, vx: number, vy: number): void {
    const entry = this.bodies.get(entityId);
    if (!entry) return;
    entry.body.setLinearVelocity(planck.Vec2(vx / this.ppm, vy / this.ppm));
  }

  applyForce(entityId: string, fx: number, fy: number): void {
    const entry = this.bodies.get(entityId);
    if (!entry) return;
    entry.body.applyForceToCenter(planck.Vec2(fx / this.ppm, fy / this.ppm), true);
  }

  applyImpulse(entityId: string, ix: number, iy: number): void {
    const entry = this.bodies.get(entityId);
    if (!entry) return;
    entry.body.applyLinearImpulse(planck.Vec2(ix / this.ppm, iy / this.ppm), entry.body.getWorldCenter(), true);
  }

  raycast(fromX: number, fromY: number, toX: number, toY: number): RaycastHit | null {
    if (!this.world) return null;

    let closest: RaycastHit | null = null;

    this.world.rayCast(
      planck.Vec2(fromX / this.ppm, fromY / this.ppm),
      planck.Vec2(toX / this.ppm, toY / this.ppm),
      (fixture: planck.Fixture, point: planck.Vec2, normal: planck.Vec2, fraction: number) => {
        const body = fixture.getBody();
        const entityId = this.findEntityId(body);
        if (!entityId) return fraction;

        const ud = fixture.getUserData() as { tag?: string } | null;
        const dist = Math.sqrt(
          ((point.x * this.ppm) - fromX) ** 2 +
          ((point.y * this.ppm) - fromY) ** 2,
        );

        closest = {
          point: [point.x * this.ppm, point.y * this.ppm],
          normal: [normal.x, normal.y],
          distance: dist,
          entityId,
          colliderTag: ud?.tag,
        };

        return fraction; // continue to find closest
      },
    );

    return closest;
  }

  getContacts(): readonly ContactEvent[] {
    const result = [...this.contacts];
    this.contacts = [];
    return result;
  }

  getEndContacts(): readonly ContactEvent[] {
    const result = [...this.endContacts];
    this.endContacts = [];
    return result;
  }

  hasBody(entityId: string): boolean {
    return this.bodies.has(entityId);
  }

  destroy(): void {
    this.bodies.clear();
    this.contacts = [];
    if (this.world) {
      for (let b = this.world.getBodyList(); b; b = b.getNext()) {
        this.world.destroyBody(b);
      }
    }
    this.world = null;
  }

  private findEntityId(body: planck.Body): string | undefined {
    for (const [id, entry] of this.bodies) {
      if (entry.body === body) return id;
    }
    return undefined;
  }

  private handleContact(contact: planck.Contact, target: ContactEvent[]): void {
    const fixtureA = contact.getFixtureA();
    const fixtureB = contact.getFixtureB();
    const bodyA = fixtureA.getBody();
    const bodyB = fixtureB.getBody();

    const idA = this.findEntityId(bodyA);
    const idB = this.findEntityId(bodyB);
    if (!idA || !idB) return;

    const udA = fixtureA.getUserData() as { tag?: string } | null;
    const udB = fixtureB.getUserData() as { tag?: string } | null;

    const manifold = contact.getWorldManifold(null);
    const pt = manifold?.points?.[0];
    const nm = manifold?.normal;

    target.push({
      entityIdA: idA,
      entityIdB: idB,
      tagA: udA?.tag,
      tagB: udB?.tag,
      point: pt ? [pt.x * this.ppm, pt.y * this.ppm] : [0, 0],
      normal: nm ? [nm.x, nm.y] : [0, 0],
    });
  }
}
