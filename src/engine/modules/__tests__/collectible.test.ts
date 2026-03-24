import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Collectible } from '../mechanic/collectible';

describe('Collectible', () => {
  const sampleItems = [
    { x: 100, y: 100, value: 10, type: 'coin' },
    { x: 200, y: 200, value: 20, type: 'gem' },
    { x: 300, y: 300, value: 50, type: 'star' },
  ];

  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const collectible = new Collectible('col-1', {
      items: sampleItems,
      ...params,
    });
    engine.addModule(collectible);
    return { engine, collectible };
  }

  it('should have correct defaults', () => {
    const collectible = new Collectible('col-default');
    const p = collectible.getParams();

    expect(p.layer).toBe('collectibles');
    expect(p.asset).toBe('');
    expect(p.floatAnimation).toBe(true);
    // BaseModule spreads array defaults as {}, so use Array.isArray guard
    expect(collectible.getActiveItems()).toEqual([]);
  });

  it('should track items and allow pickup', () => {
    const { collectible } = setup();

    expect(collectible.getActiveItems()).toHaveLength(3);

    collectible.pickup(0);
    expect(collectible.getActiveItems()).toHaveLength(2);
    expect(collectible.getActiveItems()[0]).toEqual(sampleItems[1]);
  });

  it('should emit collectible:pickup event', () => {
    const { engine, collectible } = setup();
    const handler = vi.fn();
    engine.eventBus.on('collectible:pickup', handler);

    collectible.pickup(1);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 1,
        type: 'gem',
        value: 20,
        x: 200,
        y: 200,
      }),
    );
  });

  it('should emit collectible:allCollected when all items are picked up', () => {
    const { engine, collectible } = setup();
    const handler = vi.fn();
    engine.eventBus.on('collectible:allCollected', handler);

    collectible.pickup(0);
    collectible.pickup(1);
    expect(handler).not.toHaveBeenCalled();

    collectible.pickup(2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not pickup the same item twice', () => {
    const { engine, collectible } = setup();
    const handler = vi.fn();
    engine.eventBus.on('collectible:pickup', handler);

    collectible.pickup(0);
    collectible.pickup(0);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(collectible.getActiveItems()).toHaveLength(2);
  });

  it('should auto-pickup on checkCollision hit', () => {
    const { engine, collectible } = setup();
    const handler = vi.fn();
    engine.eventBus.on('collectible:pickup', handler);

    // Item 0 is at (100, 100). radius+16 threshold: 10+16 = 26
    // Distance from (110, 110) to (100,100) = ~14.14, which is < 26
    const hit = collectible.checkCollision(110, 110, 10);
    expect(hit).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(collectible.getActiveItems()).toHaveLength(2);
  });

  it('should return false when checkCollision misses', () => {
    const { collectible } = setup();

    // Far away from all items
    const hit = collectible.checkCollision(999, 999, 10);
    expect(hit).toBe(false);
    expect(collectible.getActiveItems()).toHaveLength(3);
  });

  it('should apply float animation offset to displayY', () => {
    const { collectible } = setup();

    // At elapsed=0 the sin values may or may not be zero depending on index
    const posBefore = collectible.getItemPositions();

    // Advance time to change the sine wave
    collectible.update(250);
    const posAfter = collectible.getItemPositions();

    // At least one item's displayY should differ from its base y after update
    const changed = posAfter.some((pos) => pos.displayY !== pos.y);
    expect(changed).toBe(true);
  });

  it('should not apply float offset when floatAnimation is false', () => {
    const { collectible } = setup({ floatAnimation: false });

    collectible.update(500);
    const positions = collectible.getItemPositions();

    for (const pos of positions) {
      expect(pos.displayY).toBe(pos.y);
    }
  });

  it('should reset collected set and elapsed', () => {
    const { collectible } = setup();

    collectible.pickup(0);
    collectible.pickup(1);
    collectible.update(1000);

    expect(collectible.getActiveItems()).toHaveLength(1);

    collectible.reset();

    expect(collectible.getActiveItems()).toHaveLength(3);

    // After reset, positions at elapsed=0 should have the initial sine offsets
    const positions = collectible.getItemPositions();
    // With elapsed=0, offset = sin(0 + i) * 6, so item 0 has sin(0)*6 = 0
    expect(positions[0].displayY).toBe(positions[0].y + Math.sin(0) * 6);
  });
});
