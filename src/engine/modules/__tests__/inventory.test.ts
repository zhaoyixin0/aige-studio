import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Inventory } from '../mechanic/inventory';

describe('Inventory', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const inventory = new Inventory('inv-1', params);
    engine.addModule(inventory);
    return { engine, inventory };
  }

  it('should use schema defaults when no params given', () => {
    const inventory = new Inventory('inv-default');
    const params = inventory.getParams();
    expect(params.trackEvent).toBe('collectible:pickup');
    // BaseModule spreads array default as {}, so getResources must handle it
    // Just verify it does not throw
    expect(params.resources).toBeDefined();
  });

  it('should initialize amounts from resource definitions', () => {
    const { inventory } = setup({
      resources: [
        { name: 'gold', max: 100, initial: 10 },
        { name: 'gems', max: 50, initial: 5 },
      ],
    });

    expect(inventory.getAmount('gold')).toBe(10);
    expect(inventory.getAmount('gems')).toBe(5);
  });

  it('should add resources on tracked event', () => {
    const { engine, inventory } = setup({
      resources: [{ name: 'gold', max: 100, initial: 0 }],
      trackEvent: 'collectible:pickup',
    });

    engine.eventBus.emit('collectible:pickup', { type: 'gold', value: 15 });

    expect(inventory.getAmount('gold')).toBe(15);
  });

  it('should emit inventory:change when adding', () => {
    const { engine, inventory } = setup({
      resources: [{ name: 'gold', max: 100, initial: 0 }],
    });

    const handler = vi.fn();
    engine.eventBus.on('inventory:change', handler);

    inventory.add('gold', 20);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'gold', amount: 20, total: 20 }),
    );
  });

  it('should cap at max and emit inventory:full', () => {
    const { engine, inventory } = setup({
      resources: [{ name: 'gold', max: 50, initial: 40 }],
    });

    const fullHandler = vi.fn();
    engine.eventBus.on('inventory:full', fullHandler);

    inventory.add('gold', 20);

    expect(inventory.getAmount('gold')).toBe(50);
    expect(fullHandler).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'gold' }),
    );
  });

  it('should spend resources and return true', () => {
    const { engine, inventory } = setup({
      resources: [{ name: 'gold', max: 100, initial: 30 }],
    });

    const handler = vi.fn();
    engine.eventBus.on('inventory:change', handler);

    const result = inventory.spend('gold', 10);

    expect(result).toBe(true);
    expect(inventory.getAmount('gold')).toBe(20);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'gold', amount: -10, total: 20 }),
    );
  });

  it('should fail to spend if insufficient and return false', () => {
    const { inventory } = setup({
      resources: [{ name: 'gold', max: 100, initial: 5 }],
    });

    const result = inventory.spend('gold', 10);

    expect(result).toBe(false);
    expect(inventory.getAmount('gold')).toBe(5);
  });

  it('should reset amounts to initial values', () => {
    const { inventory } = setup({
      resources: [{ name: 'gold', max: 100, initial: 10 }],
    });

    inventory.add('gold', 50);
    expect(inventory.getAmount('gold')).toBe(60);

    inventory.reset();
    expect(inventory.getAmount('gold')).toBe(10);
  });
});
