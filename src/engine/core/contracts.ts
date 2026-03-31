/** Objects this module manages in the collision system */
export interface CollisionProviderContract {
  readonly layer: string;
  readonly radius: number;
  readonly spawnEvent?: string;
  readonly destroyEvent?: string;
  readonly moveEvent?: string;
  getActiveObjects?(): ReadonlyArray<{ id: string; x: number; y: number }>;
  /** Override layer per-object at spawn time (e.g., Spawner routes items to different layers by asset) */
  getLayerForObject?(data: { asset?: string; id?: string }): string;
}

/** This module's objects can receive damage */
export interface DamageReceiverContract {
  handle(targetId: string, amount: number): void;
}

/** This module's objects deal damage on collision */
export interface DamageSourceContract {
  readonly amount: number;
}

/** This module provides the player's position (one per game) */
export interface PlayerPositionContract {
  getPosition(): { x: number; y: number };
  setPosition?(x: number, y: number): void;
  readonly radius: number;
}

/** Full contracts bundle — all fields optional */
export interface ModuleContracts {
  readonly collisionProvider?: CollisionProviderContract;
  readonly damageReceiver?: DamageReceiverContract;
  readonly damageSource?: DamageSourceContract;
  readonly playerPosition?: PlayerPositionContract;
}
