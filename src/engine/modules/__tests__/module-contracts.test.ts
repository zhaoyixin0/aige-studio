import { describe, it, expect } from 'vitest';
import { Spawner } from '../mechanic/spawner';
import { Projectile } from '../mechanic/projectile';
import { EnemyAI } from '../mechanic/enemy-ai';
import { PlayerMovement } from '../mechanic/player-movement';
import { Collectible } from '../mechanic/collectible';
import { Health } from '../mechanic/health';

describe('Module Contracts', () => {
  describe('Spawner', () => {
    it('should declare collisionProvider with items layer', () => {
      const spawner = new Spawner('s1', {
        items: [{ asset: 'apple', weight: 1, layer: 'items' }],
      });
      const c = spawner.getContracts();

      expect(c.collisionProvider).toBeDefined();
      expect(c.collisionProvider!.layer).toBe('items');
      expect(c.collisionProvider!.spawnEvent).toBe('spawner:created');
      expect(c.collisionProvider!.destroyEvent).toBe('spawner:destroyed');
      expect(typeof c.collisionProvider!.getActiveObjects).toBe('function');
    });

    it('should return spawned objects from getActiveObjects', () => {
      const spawner = new Spawner('s1', {
        items: [{ asset: 'apple', weight: 1 }],
        frequency: 1,
      });
      // Manually spawn via the public method
      const obj = spawner.spawn();
      expect(obj).not.toBeNull();

      const c = spawner.getContracts();
      const active = c.collisionProvider!.getActiveObjects!();
      expect(active.length).toBeGreaterThanOrEqual(1);
      expect(active[0]).toHaveProperty('id');
      expect(active[0]).toHaveProperty('x');
      expect(active[0]).toHaveProperty('y');
    });

    it('should use spriteSize/2 as radius', () => {
      const spawner = new Spawner('s1', { spriteSize: 64 });
      const c = spawner.getContracts();
      expect(c.collisionProvider!.radius).toBe(32);
    });

    it('should not declare damage contracts', () => {
      const spawner = new Spawner('s1', {});
      const c = spawner.getContracts();
      expect(c.damageReceiver).toBeUndefined();
      expect(c.damageSource).toBeUndefined();
      expect(c.playerPosition).toBeUndefined();
    });
  });

  describe('Projectile', () => {
    it('should declare collisionProvider + damageSource', () => {
      const proj = new Projectile('p1', { damage: 15, collisionRadius: 10 });
      const c = proj.getContracts();

      expect(c.collisionProvider).toBeDefined();
      expect(c.collisionProvider!.layer).toBe('projectiles');
      expect(c.collisionProvider!.radius).toBe(10);
      expect(c.collisionProvider!.spawnEvent).toBe('projectile:fire');
      expect(c.collisionProvider!.destroyEvent).toBe('projectile:destroyed');
      expect(typeof c.collisionProvider!.getActiveObjects).toBe('function');

      expect(c.damageSource).toBeDefined();
      expect(c.damageSource!.amount).toBe(15);
    });

    it('should use default damage and radius from schema', () => {
      const proj = new Projectile('p1', {});
      const c = proj.getContracts();

      expect(c.collisionProvider!.radius).toBe(8);
      expect(c.damageSource!.amount).toBe(10);
    });

    it('should not declare damageReceiver or playerPosition', () => {
      const proj = new Projectile('p1', {});
      const c = proj.getContracts();
      expect(c.damageReceiver).toBeUndefined();
      expect(c.playerPosition).toBeUndefined();
    });
  });

  describe('EnemyAI', () => {
    it('should declare collisionProvider + damageReceiver + damageSource', () => {
      const ai = new EnemyAI('e1', { hp: 50, attackDamage: 20 });
      const c = ai.getContracts();

      expect(c.collisionProvider).toBeDefined();
      expect(c.collisionProvider!.layer).toBe('enemies');
      expect(c.collisionProvider!.spawnEvent).toBe('wave:spawn');
      expect(c.collisionProvider!.destroyEvent).toBe('enemy:death');
      expect(c.collisionProvider!.moveEvent).toBe('enemy:move');
      expect(typeof c.collisionProvider!.getActiveObjects).toBe('function');

      expect(c.damageReceiver).toBeDefined();
      expect(typeof c.damageReceiver!.handle).toBe('function');

      expect(c.damageSource).toBeDefined();
      expect(c.damageSource!.amount).toBe(20);
    });

    it('should route damage through damageReceiver.handle', () => {
      const ai = new EnemyAI('e1', { hp: 50 });
      ai.addEnemy('enemy-1', 0, 0);

      const c = ai.getContracts();
      c.damageReceiver!.handle('enemy-1', 25);

      const enemy = ai.getEnemy('enemy-1');
      expect(enemy!.hp).toBe(25);
    });

    it('should return active enemies from getActiveObjects', () => {
      const ai = new EnemyAI('e1', { hp: 50 });
      ai.addEnemy('enemy-1', 100, 200);
      ai.addEnemy('enemy-2', 300, 400);

      const c = ai.getContracts();
      const active = c.collisionProvider!.getActiveObjects!();
      expect(active).toHaveLength(2);
      expect(active).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'enemy-1', x: 100, y: 200 }),
          expect.objectContaining({ id: 'enemy-2', x: 300, y: 400 }),
        ]),
      );
    });
  });

  describe('PlayerMovement', () => {
    it('should declare playerPosition contract', () => {
      const pm = new PlayerMovement('pm1', {});
      const c = pm.getContracts();

      expect(c.playerPosition).toBeDefined();
      expect(typeof c.playerPosition!.getPosition).toBe('function');
      expect(typeof c.playerPosition!.radius).toBe('number');
    });

    it('should return current position from getPosition', () => {
      const pm = new PlayerMovement('pm1', {});
      const c = pm.getContracts();
      const pos = c.playerPosition!.getPosition();

      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
    });

    it('should not declare collision or damage contracts', () => {
      const pm = new PlayerMovement('pm1', {});
      const c = pm.getContracts();
      expect(c.collisionProvider).toBeUndefined();
      expect(c.damageReceiver).toBeUndefined();
      expect(c.damageSource).toBeUndefined();
    });
  });

  describe('Collectible', () => {
    it('should declare collisionProvider with configured layer', () => {
      const col = new Collectible('c1', {
        items: [{ x: 10, y: 20, value: 1, type: 'coin' }],
        layer: 'collectibles',
      });
      const c = col.getContracts();

      expect(c.collisionProvider).toBeDefined();
      expect(c.collisionProvider!.layer).toBe('collectibles');
      expect(typeof c.collisionProvider!.getActiveObjects).toBe('function');
    });

    it('should return active items from getActiveObjects', () => {
      const col = new Collectible('c1', {
        items: [
          { x: 10, y: 20, value: 1, type: 'coin' },
          { x: 30, y: 40, value: 2, type: 'gem' },
        ],
      });
      const c = col.getContracts();
      const active = c.collisionProvider!.getActiveObjects!();
      expect(active).toHaveLength(2);
    });

    it('should not declare damage or player contracts', () => {
      const col = new Collectible('c1', {});
      const c = col.getContracts();
      expect(c.damageReceiver).toBeUndefined();
      expect(c.damageSource).toBeUndefined();
      expect(c.playerPosition).toBeUndefined();
    });
  });

  describe('Health', () => {
    it('should declare damageReceiver contract', () => {
      const health = new Health('h1', { maxHp: 100 });
      const c = health.getContracts();

      expect(c.damageReceiver).toBeDefined();
      expect(typeof c.damageReceiver!.handle).toBe('function');
    });

    it('should route damage through damageReceiver.handle', () => {
      const health = new Health('h1', { maxHp: 100 });
      health.registerEntity('player_1');

      const c = health.getContracts();
      c.damageReceiver!.handle('player_1', 30);

      const entity = health.getEntity('player_1');
      expect(entity!.hp).toBe(70);
    });

    it('should not declare collision or player contracts', () => {
      const health = new Health('h1', {});
      const c = health.getContracts();
      expect(c.collisionProvider).toBeUndefined();
      expect(c.damageSource).toBeUndefined();
      expect(c.playerPosition).toBeUndefined();
    });
  });
});
