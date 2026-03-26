import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { EnemyDrop } from '../mechanic/enemy-drop';
import type { LootEntry } from '../mechanic/enemy-drop';

describe('EnemyDrop', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const mod = new EnemyDrop('drop-1', params);
    engine.addModule(mod);
    engine.eventBus.emit('gameflow:resume');
    return { engine, mod };
  }

  const basicLoot: LootEntry[] = [
    { item: 'coin', weight: 1, minCount: 1, maxCount: 3, type: 'collectible' },
  ];

  it('should emit drop:spawn on triggerEvent when roll succeeds', () => {
    const { engine } = setup({ lootTable: basicLoot, dropChance: 1 });
    const handler = vi.fn();
    engine.eventBus.on('drop:spawn', handler);
    engine.eventBus.emit('enemy:death', { x: 100, y: 200 });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ x: 100, y: 200, item: 'coin', type: 'collectible' }),
    );
  });

  it('should emit levelup:xp on every trigger', () => {
    const { engine } = setup({ lootTable: basicLoot, xpAmount: 25, dropChance: 0 });
    const handler = vi.fn();
    engine.eventBus.on('levelup:xp', handler);
    engine.eventBus.emit('enemy:death', { x: 0, y: 0 });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ amount: 25 }));
  });

  it('should respect dropChance: 0 chance means no drops', () => {
    const { engine } = setup({ lootTable: basicLoot, dropChance: 0 });
    const handler = vi.fn();
    engine.eventBus.on('drop:spawn', handler);
    engine.eventBus.emit('enemy:death', { x: 0, y: 0 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('should respect dropChance: 1 always drops', () => {
    const { engine } = setup({ lootTable: basicLoot, dropChance: 1 });
    const handler = vi.fn();
    engine.eventBus.on('drop:spawn', handler);
    engine.eventBus.emit('enemy:death', { x: 0, y: 0 });
    expect(handler).toHaveBeenCalled();
  });

  it('should pick from weighted loot table', () => {
    // Two items: heavy item has weight 1000, light item has weight 1
    // With enough rolls we should statistically always pick heavy
    const lootTable: LootEntry[] = [
      { item: 'rare', weight: 1, minCount: 1, maxCount: 1, type: 'collectible' },
      { item: 'common', weight: 10000, minCount: 1, maxCount: 1, type: 'collectible' },
    ];
    const { engine } = setup({ lootTable, dropChance: 1 });
    const spawnedItems: string[] = [];
    engine.eventBus.on('drop:spawn', (data: any) => spawnedItems.push(data.item));
    // fire 10 times, common should appear the vast majority
    for (let i = 0; i < 10; i++) {
      engine.eventBus.emit('enemy:death', { x: 0, y: 0 });
    }
    const commonCount = spawnedItems.filter((i) => i === 'common').length;
    expect(commonCount).toBeGreaterThanOrEqual(9);
  });

  it('should respect count range (minCount to maxCount)', () => {
    const lootTable: LootEntry[] = [
      { item: 'coin', weight: 1, minCount: 3, maxCount: 3, type: 'collectible' },
    ];
    const { engine } = setup({ lootTable, dropChance: 1 });
    const handler = vi.fn();
    engine.eventBus.on('drop:spawn', handler);
    engine.eventBus.emit('enemy:death', { x: 0, y: 0 });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ count: 3 }));
  });

  it('should handle empty loot table (only XP)', () => {
    const { engine } = setup({ lootTable: [], xpAmount: 10, dropChance: 1 });
    const dropHandler = vi.fn();
    const xpHandler = vi.fn();
    engine.eventBus.on('drop:spawn', dropHandler);
    engine.eventBus.on('levelup:xp', xpHandler);
    engine.eventBus.emit('enemy:death', { x: 0, y: 0 });
    expect(dropHandler).not.toHaveBeenCalled();
    expect(xpHandler).toHaveBeenCalledWith(expect.objectContaining({ amount: 10 }));
  });

  it('should reset without error', () => {
    const { mod } = setup({ lootTable: basicLoot });
    expect(() => mod.reset()).not.toThrow();
  });
});
