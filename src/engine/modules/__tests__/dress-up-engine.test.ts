import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { DressUpEngine } from '../mechanic/dress-up-engine';

describe('DressUpEngine', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const dressUp = new DressUpEngine('du-1', {
      layers: ['hat', 'glasses', 'shirt'],
      maxPerLayer: 1,
      ...params,
    });
    engine.addModule(dressUp);
    return { engine, dressUp };
  }

  it('should equip an item on a valid layer', () => {
    const { engine, dressUp } = setup();
    const handler = vi.fn();
    engine.eventBus.on('dressup:equip', handler);

    const result = dressUp.equip('hat', 'red-hat');

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ layer: 'hat', itemId: 'red-hat' }),
    );
    expect(dressUp.getEquipped('hat')).toEqual([
      { layer: 'hat', itemId: 'red-hat' },
    ]);
  });

  it('should reject equip on invalid layer', () => {
    const { dressUp } = setup();
    const result = dressUp.equip('wings', 'angel-wings');
    expect(result).toBe(false);
  });

  it('should unequip and replace when exceeding maxPerLayer', () => {
    const { engine, dressUp } = setup({ maxPerLayer: 1 });
    const unequipHandler = vi.fn();
    engine.eventBus.on('dressup:unequip', unequipHandler);

    dressUp.equip('hat', 'red-hat');
    dressUp.equip('hat', 'blue-hat');

    expect(unequipHandler).toHaveBeenCalledWith(
      expect.objectContaining({ layer: 'hat', itemId: 'red-hat' }),
    );

    const equipped = dressUp.getEquipped('hat');
    expect(equipped).toHaveLength(1);
    expect(equipped[0].itemId).toBe('blue-hat');
  });

  it('should return snapshot of all equipped items', () => {
    const { engine, dressUp } = setup();
    const snapshotHandler = vi.fn();
    engine.eventBus.on('dressup:snapshot', snapshotHandler);

    dressUp.equip('hat', 'top-hat');
    dressUp.equip('glasses', 'sunglasses');

    const snapshot = dressUp.snapshot();

    expect(snapshot).toHaveLength(2);
    expect(snapshotHandler).toHaveBeenCalled();
  });
});
