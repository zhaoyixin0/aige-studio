import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'dead';

export interface EnemyInstance {
  id: string;
  x: number;
  y: number;
  state: AIState;
  hp: number;
  maxHp: number;
  stateTimer: number;
  waypointIndex: number;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function moveToward(
  ex: number,
  ey: number,
  tx: number,
  ty: number,
  speed: number,
  dt: number
): { x: number; y: number } {
  const dx = tx - ex;
  const dy = ty - ey;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return { x: ex, y: ey };
  const step = Math.min(speed * (dt / 1000), d);
  return { x: ex + (dx / d) * step, y: ey + (dy / d) * step };
}

export class EnemyAI extends BaseModule {
  readonly type = 'EnemyAI';

  private enemies = new Map<string, EnemyInstance>();
  private playerX = 0;
  private playerY = 0;
  private attackTimers = new Map<string, number>();
  private deathEmitted = new Set<string>();

  getSchema(): ModuleSchema {
    return {
      behavior: {
        type: 'select',
        label: 'Behavior',
        default: 'patrol',
        options: ['patrol', 'chase', 'stationary'],
      },
      speed: { type: 'range', label: 'Speed', default: 100, min: 20, max: 500 },
      detectionRange: { type: 'range', label: 'Detection Range', default: 200, min: 50, max: 800 },
      attackRange: { type: 'range', label: 'Attack Range', default: 50, min: 20, max: 200 },
      attackCooldown: { type: 'range', label: 'Attack Cooldown (ms)', default: 1000, min: 200, max: 5000, unit: 'ms' },
      attackDamage: { type: 'range', label: 'Attack Damage', default: 10, min: 1, max: 100 },
      hp: { type: 'range', label: 'HP', default: 50, min: 1, max: 9999 },
      fleeHpThreshold: { type: 'range', label: 'Flee HP Threshold', default: 0.2, min: 0, max: 1, step: 0.05 },
      waypoints: { type: 'object', label: 'Waypoints', default: [] },
      asset: { type: 'string', label: 'Enemy Asset Key', default: 'enemy_1' },
    };
  }

  getContracts(): ModuleContracts {
    const attackDamage = (this.params.attackDamage as number) ?? 10;

    return {
      collisionProvider: {
        layer: 'enemies',
        radius: 24,
        spawnEvent: 'wave:spawn',
        destroyEvent: 'enemy:death',
        moveEvent: 'enemy:move',
        getActiveObjects: () =>
          Array.from(this.enemies.values())
            .filter((e) => e.state !== 'dead')
            .map((e) => ({ id: e.id, x: e.x, y: e.y })),
      },
      damageReceiver: {
        handle: (targetId, amount) => this.damageEnemy(targetId, amount),
      },
      damageSource: {
        amount: attackDamage,
      },
      emits: ['enemy:move', 'enemy:attack', 'enemy:death'],
      consumes: ['player:move', 'projectile:hit'],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('player:move', (data?: any) => {
      if (data && typeof data.x === 'number') {
        this.playerX = data.x;
        this.playerY = data.y;
      }
    });

    this.on('projectile:hit', (data?: any) => {
      if (data && typeof data.targetId === 'string') {
        this.damageEnemy(data.targetId, data.damage ?? 0);
      }
    });
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;

    const speed = (this.params.speed as number) ?? 100;
    const detectionRange = (this.params.detectionRange as number) ?? 200;
    const attackRange = (this.params.attackRange as number) ?? 50;
    const attackCooldown = (this.params.attackCooldown as number) ?? 1000;
    const attackDamage = (this.params.attackDamage as number) ?? 10;
    const fleeThreshold = (this.params.fleeHpThreshold as number) ?? 0.2;
    const waypoints = (this.params.waypoints as Array<{ x: number; y: number }>) ?? [];

    for (const enemy of this.enemies.values()) {
      if (enemy.state === 'dead') continue;

      let updated: EnemyInstance = { ...enemy, stateTimer: enemy.stateTimer + dt };
      const playerDist = dist(updated.x, updated.y, this.playerX, this.playerY);

      // Check flee condition
      if (updated.state !== 'flee' && updated.hp < updated.maxHp * fleeThreshold && updated.hp > 0) {
        updated = { ...updated, state: 'flee' };
      }

      switch (updated.state) {
        case 'idle':
          if (playerDist < detectionRange) {
            updated = { ...updated, state: 'chase' };
          }
          break;

        case 'patrol': {
          if (playerDist < detectionRange) {
            updated = { ...updated, state: 'chase' };
            break;
          }
          if (waypoints.length === 0) break;
          let wpIdx = updated.waypointIndex % waypoints.length;
          if (dist(updated.x, updated.y, waypoints[wpIdx].x, waypoints[wpIdx].y) < 4) {
            const nextIdx = (updated.waypointIndex + 1) % waypoints.length;
            updated = { ...updated, waypointIndex: nextIdx };
            wpIdx = nextIdx;
          }
          const wp = waypoints[wpIdx];
          const pos = moveToward(updated.x, updated.y, wp.x, wp.y, speed, dt);
          updated = { ...updated, x: pos.x, y: pos.y };
          if (dist(updated.x, updated.y, wp.x, wp.y) < 4) {
            updated = { ...updated, waypointIndex: (updated.waypointIndex + 1) % waypoints.length };
          }
          this.emit('enemy:move', { id: updated.id, x: updated.x, y: updated.y, state: updated.state });
          break;
        }

        case 'chase': {
          if (playerDist < attackRange) {
            updated = { ...updated, state: 'attack' };
            break;
          }
          if (playerDist > detectionRange * 1.5) {
            updated = { ...updated, state: 'patrol' };
            break;
          }
          const pos = moveToward(updated.x, updated.y, this.playerX, this.playerY, speed, dt);
          updated = { ...updated, x: pos.x, y: pos.y };
          this.emit('enemy:move', { id: updated.id, x: updated.x, y: updated.y, state: updated.state });
          break;
        }

        case 'attack': {
          if (playerDist > attackRange) {
            updated = { ...updated, state: 'chase' };
            break;
          }
          const timer = (this.attackTimers.get(updated.id) ?? 0) + dt;
          if (timer >= attackCooldown) {
            this.attackTimers.set(updated.id, timer - attackCooldown);
            this.emit('enemy:attack', { id: updated.id, damage: attackDamage });
          } else {
            this.attackTimers.set(updated.id, timer);
          }
          break;
        }

        case 'flee': {
          const dx = updated.x - this.playerX;
          const dy = updated.y - this.playerY;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 0) {
            updated = {
              ...updated,
              x: updated.x + (dx / d) * speed * (dt / 1000),
              y: updated.y + (dy / d) * speed * (dt / 1000),
            };
          }
          this.emit('enemy:move', { id: updated.id, x: updated.x, y: updated.y, state: updated.state });
          break;
        }
      }

      this.enemies.set(updated.id, updated);
    }
  }

  addEnemy(id: string, x: number, y: number): void {
    const maxHp = (this.params.hp as number) ?? 50;
    this.enemies.set(id, {
      id,
      x,
      y,
      state: 'idle',
      hp: maxHp,
      maxHp,
      stateTimer: 0,
      waypointIndex: 0,
    });
    this.attackTimers.set(id, 0);
  }

  removeEnemy(id: string): void {
    this.enemies.delete(id);
    this.attackTimers.delete(id);
    this.deathEmitted.delete(id);
  }

  getEnemy(id: string): EnemyInstance | undefined {
    return this.enemies.get(id);
  }

  getActiveEnemies(): EnemyInstance[] {
    return Array.from(this.enemies.values());
  }

  damageEnemy(id: string, amount: number): void {
    const enemy = this.enemies.get(id);
    if (!enemy || enemy.state === 'dead') return;
    const newHp = Math.max(0, enemy.hp - amount);
    if (newHp === 0) {
      const updated: EnemyInstance = { ...enemy, hp: newHp, state: 'dead' };
      this.enemies.set(id, updated);
      if (!this.deathEmitted.has(id)) {
        this.deathEmitted.add(id);
        this.emit('enemy:death', { id, x: updated.x, y: updated.y });
      }
    } else {
      this.enemies.set(id, { ...enemy, hp: newHp });
    }
  }

  reset(): void {
    this.enemies.clear();
    this.attackTimers.clear();
    this.deathEmitted.clear();
  }
}
