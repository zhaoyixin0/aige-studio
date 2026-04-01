import { describe, it, expect } from 'vitest';
import { ContractRegistry } from '../contract-registry';
import { createModuleRegistry } from '@/engine/module-setup';

describe('ContractRegistry', () => {
  describe('fromRegistry()', () => {
    it('should create a ContractRegistry from a ModuleRegistry', () => {
      const registry = createModuleRegistry();
      const contracts = ContractRegistry.fromRegistry(registry);
      expect(contracts).toBeInstanceOf(ContractRegistry);
    });

    it('should contain all module types from the registry', () => {
      const registry = createModuleRegistry();
      const contracts = ContractRegistry.fromRegistry(registry);
      const knownTypes = contracts.getKnownTypes();

      // Must include all types from the module registry
      for (const type of registry.getTypes()) {
        expect(knownTypes.has(type)).toBe(true);
      }
    });
  });

  describe('getKnownTypes()', () => {
    it('should return a ReadonlySet of all module types', () => {
      const registry = createModuleRegistry();
      const contracts = ContractRegistry.fromRegistry(registry);
      const types = contracts.getKnownTypes();

      expect(types.size).toBeGreaterThan(50); // 59 modules registered
      expect(types.has('Spawner')).toBe(true);
      expect(types.has('Collision')).toBe(true);
      expect(types.has('TouchInput')).toBe(true);
      expect(types.has('GameFlow')).toBe(true);
    });
  });

  describe('getEmits()', () => {
    it('should return emits for modules that declare them', () => {
      const registry = createModuleRegistry();
      const contracts = ContractRegistry.fromRegistry(registry);

      // Spawner already declares emits in its contracts
      const spawnerEmits = contracts.getEmits('Spawner');
      expect(spawnerEmits).toContain('spawner:created');
      expect(spawnerEmits).toContain('spawner:destroyed');
    });

    it('should return empty array for unknown module types', () => {
      const registry = createModuleRegistry();
      const contracts = ContractRegistry.fromRegistry(registry);

      const emits = contracts.getEmits('NonExistentModule');
      expect(emits).toEqual([]);
    });
  });

  describe('getConsumes()', () => {
    it('should return consumes for modules that declare them', () => {
      const registry = createModuleRegistry();
      const contracts = ContractRegistry.fromRegistry(registry);

      // Health already declares consumes
      const healthConsumes = contracts.getConsumes('Health');
      expect(healthConsumes.length).toBeGreaterThan(0);
    });
  });

  describe('dynamic consumes from params', () => {
    it('Shield should declare damageEvent in consumes', () => {
      const registry = createModuleRegistry();
      const contracts = ContractRegistry.fromRegistry(registry);
      const consumes = contracts.getConsumes('Shield');
      expect(consumes).toContain('collision:damage');
    });

    it('CameraFollow should declare shakeEvent in consumes when set', () => {
      const registry = createModuleRegistry();
      const contracts = ContractRegistry.fromRegistry(registry);
      // Default shakeEvent is empty, so consumes should only have player:move
      const consumes = contracts.getConsumes('CameraFollow');
      expect(consumes).toContain('player:move');
    });

    it('Gravity should include toggleEvent in consumes when set', () => {
      const registry = createModuleRegistry();
      const contracts = ContractRegistry.fromRegistry(registry);
      const consumes = contracts.getConsumes('Gravity');
      expect(consumes).toContain('jump:start');
      expect(consumes).toContain('dash:start');
      expect(consumes).toContain('dash:end');
    });
  });

  describe('getAllEmittedEvents()', () => {
    it('should aggregate all emits from all modules', () => {
      const registry = createModuleRegistry();
      const contracts = ContractRegistry.fromRegistry(registry);
      const allEvents = contracts.getAllEmittedEvents();

      // Known events from existing contract modules
      expect(allEvents.has('spawner:created')).toBe(true);
      expect(allEvents.has('collision:hit')).toBe(true);
      expect(allEvents.has('health:change')).toBe(true);
      expect(allEvents.has('player:move')).toBe(true);
      expect(allEvents.has('projectile:fire')).toBe(true);
    });
  });
});
