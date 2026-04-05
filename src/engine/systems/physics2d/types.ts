export type BodyType2D = 'static' | 'dynamic' | 'kinematic';

export interface RigidBody2DConfig {
  readonly type: BodyType2D;
  readonly linearDamping?: number;
  readonly angularDamping?: number;
  readonly fixedRotation?: boolean;
  readonly gravityScale?: number;
  readonly mass?: number;
}

export type ColliderShape2D =
  | { readonly kind: 'Circle'; readonly radius: number; readonly offset?: readonly [number, number] }
  | { readonly kind: 'Box'; readonly width: number; readonly height: number; readonly offset?: readonly [number, number] }
  | { readonly kind: 'Edge'; readonly points: ReadonlyArray<readonly [number, number]>; readonly offset?: readonly [number, number] };

export interface Collider2DConfig {
  readonly shape: ColliderShape2D;
  readonly isSensor?: boolean;
  readonly density?: number;
  readonly restitution?: number;
  readonly friction?: number;
  readonly tag?: string;
}

export interface RaycastHit {
  readonly point: readonly [number, number];
  readonly normal: readonly [number, number];
  readonly distance: number;
  readonly entityId: string;
  readonly colliderTag?: string;
}

export interface PhysicsBody {
  readonly entityId: string;
  readonly bodyConfig: RigidBody2DConfig;
  readonly colliders: readonly Collider2DConfig[];
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly velocityX: number;
  readonly velocityY: number;
}

export interface PhysicsWorldConfig {
  readonly gravityX: number;
  readonly gravityY: number;
  readonly pixelsPerMeter: number;
  readonly fixedTimeStep: number;
  readonly maxSubSteps: number;
}

export interface ContactEvent {
  readonly entityIdA: string;
  readonly entityIdB: string;
  readonly tagA?: string;
  readonly tagB?: string;
  readonly point: readonly [number, number];
  readonly normal: readonly [number, number];
}
