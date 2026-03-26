import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { EquipmentSlot } from '../mechanic/equipment-slot';
import type { Equipment } from '../mechanic/equipment-slot';

describe('EquipmentSlot', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const mod = new EquipmentSlot('eq-1', params);
    engine.addModule(mod);
    engine.eventBus.emit('gameflow:resume');
    return { engine, mod };
  }

  const sword: Equipment = {
    id: 'sword-1',
    name: 'Iron Sword',
    slot: 'weapon',
    stats: { attack: 5, speed: 1 },
    asset: 'sword.png',
  };

  const shield: Equipment = {
    id: 'shield-1',
    name: 'Wood Shield',
    slot: 'armor',
    stats: { defense: 3 },
    asset: 'shield.png',
  };

  const helmet: Equipment = {
    id: 'helmet-1',
    name: 'Iron Helmet',
    slot: 'helmet',
    stats: { defense: 2 },
    asset: 'helmet.png',
  };

  it('should start with no equipment', () => {
    const { mod } = setup();
    expect(mod.getAllEquipped()).toHaveLength(0);
    expect(mod.getAggregatedStats()).toEqual({});
  });

  it('should equip item to correct slot', () => {
    const { mod } = setup();
    mod.addEquipment(sword);
    const result = mod.equip('sword-1');
    expect(result).toBe(true);
    expect(mod.getEquipped('weapon')).toMatchObject({ id: 'sword-1' });
    expect(mod.getAllEquipped()).toHaveLength(1);
  });

  it('should aggregate stats from all equipped items', () => {
    const { mod } = setup();
    mod.addEquipment(sword);
    mod.addEquipment(shield);
    mod.equip('sword-1');
    mod.equip('shield-1');
    const stats = mod.getAggregatedStats();
    expect(stats.attack).toBe(5);
    expect(stats.speed).toBe(1);
    expect(stats.defense).toBe(3);
  });

  it('should unequip item and return to available pool', () => {
    const { mod } = setup();
    mod.addEquipment(sword);
    mod.equip('sword-1');
    const removed = mod.unequip('weapon');
    expect(removed).toMatchObject({ id: 'sword-1' });
    expect(mod.getEquipped('weapon')).toBeUndefined();
    // equip again to verify it's back in available
    const result = mod.equip('sword-1');
    expect(result).toBe(true);
  });

  it('should not equip to invalid slot (not in configured slots)', () => {
    const { mod } = setup({ slots: ['weapon', 'armor'] });
    mod.addEquipment(helmet);
    const result = mod.equip('helmet-1');
    expect(result).toBe(false);
    expect(mod.getEquipped('helmet')).toBeUndefined();
  });

  it('should emit equipment:equip on equip', () => {
    const { engine, mod } = setup();
    const handler = vi.fn();
    engine.eventBus.on('equipment:equip', handler);
    mod.addEquipment(sword);
    mod.equip('sword-1');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ slot: 'weapon', item: expect.objectContaining({ id: 'sword-1' }) }),
    );
  });

  it('should emit equipment:stats when stats change', () => {
    const { engine, mod } = setup();
    const handler = vi.fn();
    engine.eventBus.on('equipment:stats', handler);
    mod.addEquipment(sword);
    mod.equip('sword-1');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ stats: expect.objectContaining({ attack: 5 }) }),
    );
  });

  it('should replace existing item when equipping to occupied slot', () => {
    const { mod } = setup();
    const sword2: Equipment = {
      id: 'sword-2',
      name: 'Steel Sword',
      slot: 'weapon',
      stats: { attack: 10 },
      asset: 'sword2.png',
    };
    mod.addEquipment(sword);
    mod.addEquipment(sword2);
    mod.equip('sword-1');
    expect(mod.getEquipped('weapon')).toMatchObject({ id: 'sword-1' });
    mod.equip('sword-2');
    expect(mod.getEquipped('weapon')).toMatchObject({ id: 'sword-2' });
    // old item should be back in available
    const result = mod.equip('sword-1');
    expect(result).toBe(true);
  });

  it('should reset all equipment on reset', () => {
    const { mod } = setup();
    mod.addEquipment(sword);
    mod.addEquipment(shield);
    mod.equip('sword-1');
    mod.equip('shield-1');
    expect(mod.getAllEquipped()).toHaveLength(2);
    mod.reset();
    expect(mod.getAllEquipped()).toHaveLength(0);
    expect(mod.getAggregatedStats()).toEqual({});
  });
});
