import { describe, it, expect } from 'vitest';
import { BaseModule } from '@/engine/modules/base-module';
import type { ModuleContracts } from '../contracts';
import type { ModuleSchema } from '../types';

// Concrete test module to verify default getContracts()
class TestModule extends BaseModule {
  readonly type = 'TestModule';
  update(_dt: number): void {}
  getSchema(): ModuleSchema {
    return {};
  }
}

// Module that declares contracts
class ArmedModule extends BaseModule {
  readonly type = 'ArmedModule';
  update(_dt: number): void {}
  getSchema(): ModuleSchema {
    return {};
  }

  getContracts(): ModuleContracts {
    return {
      collisionProvider: {
        layer: 'projectiles',
        radius: 8,
        spawnEvent: 'projectile:fire',
        destroyEvent: 'projectile:destroyed',
      },
      damageSource: {
        amount: 10,
      },
    };
  }
}

describe('ModuleContracts', () => {
  describe('BaseModule default', () => {
    it('should return empty contracts by default', () => {
      const mod = new TestModule('test-1');
      const contracts = mod.getContracts();
      expect(contracts).toEqual({});
    });

    it('should not have collisionProvider by default', () => {
      const mod = new TestModule('test-1');
      const contracts = mod.getContracts();
      expect(contracts.collisionProvider).toBeUndefined();
      expect(contracts.damageReceiver).toBeUndefined();
      expect(contracts.damageSource).toBeUndefined();
      expect(contracts.playerPosition).toBeUndefined();
    });
  });

  describe('Module with contracts', () => {
    it('should return declared contracts', () => {
      const mod = new ArmedModule('armed-1');
      const contracts = mod.getContracts();

      expect(contracts.collisionProvider).toBeDefined();
      expect(contracts.collisionProvider!.layer).toBe('projectiles');
      expect(contracts.collisionProvider!.radius).toBe(8);
      expect(contracts.collisionProvider!.spawnEvent).toBe('projectile:fire');
      expect(contracts.collisionProvider!.destroyEvent).toBe('projectile:destroyed');
    });

    it('should return damageSource with correct amount', () => {
      const mod = new ArmedModule('armed-1');
      const contracts = mod.getContracts();

      expect(contracts.damageSource).toBeDefined();
      expect(contracts.damageSource!.amount).toBe(10);
    });

    it('should not have contracts it did not declare', () => {
      const mod = new ArmedModule('armed-1');
      const contracts = mod.getContracts();

      expect(contracts.damageReceiver).toBeUndefined();
      expect(contracts.playerPosition).toBeUndefined();
    });
  });

  describe('Contract interface structure', () => {
    it('should support collisionProvider with getActiveObjects', () => {
      const objects = [
        { id: 'obj-1', x: 10, y: 20 },
        { id: 'obj-2', x: 30, y: 40 },
      ];

      const contracts: ModuleContracts = {
        collisionProvider: {
          layer: 'enemies',
          radius: 24,
          getActiveObjects: () => objects,
        },
      };

      expect(contracts.collisionProvider!.getActiveObjects!()).toEqual(objects);
    });

    it('should support damageReceiver with handle callback', () => {
      const damages: Array<{ targetId: string; amount: number }> = [];

      const contracts: ModuleContracts = {
        damageReceiver: {
          handle: (targetId, amount) => {
            damages.push({ targetId, amount });
          },
        },
      };

      contracts.damageReceiver!.handle('enemy-1', 25);
      expect(damages).toEqual([{ targetId: 'enemy-1', amount: 25 }]);
    });

    it('should support playerPosition with getPosition and setPosition', () => {
      let pos = { x: 100, y: 200 };

      const contracts: ModuleContracts = {
        playerPosition: {
          getPosition: () => ({ ...pos }),
          setPosition: (x, y) => { pos = { x, y }; },
          radius: 32,
        },
      };

      expect(contracts.playerPosition!.getPosition()).toEqual({ x: 100, y: 200 });
      contracts.playerPosition!.setPosition!(150, 250);
      expect(pos).toEqual({ x: 150, y: 250 });
      expect(contracts.playerPosition!.radius).toBe(32);
    });
  });
});
