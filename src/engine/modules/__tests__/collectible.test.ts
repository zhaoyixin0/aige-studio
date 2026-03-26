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

  it('should auto-pickup on checkCollision hit with default magnetRadius', () => {
    const { engine, collectible } = setup();
    const handler = vi.fn();
    engine.eventBus.on('collectible:pickup', handler);

    // Item 0 is at (100, 100). default magnetRadius=16, threshold: 10+16 = 26
    // Distance from (110, 110) to (100,100) = ~14.14, which is < 26
    const hit = collectible.checkCollision(110, 110, 10);
    expect(hit).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(collectible.getActiveItems()).toHaveLength(2);
  });

  it('should use custom magnetRadius for collision threshold', () => {
    const { collectible } = setup({ magnetRadius: 0 });

    // Item 0 at (100, 100). With magnetRadius=0, threshold = radius only = 10
    // Distance from (110, 110) to (100,100) = ~14.14, which is > 10
    const miss = collectible.checkCollision(110, 110, 10);
    expect(miss).toBe(false);

    // Closer: distance from (105, 105) to (100,100) = ~7.07 < 10
    const hit = collectible.checkCollision(105, 105, 10);
    expect(hit).toBe(true);
  });

  it('should use large magnetRadius for magnet power-up effect', () => {
    const { collectible } = setup({ magnetRadius: 100 });

    // Item 0 at (100, 100). magnetRadius=100, threshold = 10+100 = 110
    // Distance from (200, 100) to (100,100) = 100 < 110
    const hit = collectible.checkCollision(200, 100, 10);
    expect(hit).toBe(true);
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
    void collectible.getItemPositions(); // snapshot before update

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

  it('should use custom floatAmplitude for animation', () => {
    const engine = new Engine();
    const collectible = new Collectible('col-1', {
      items: sampleItems,
      floatAmplitude: 20,
    });
    engine.addModule(collectible);
    engine.eventBus.emit('gameflow:resume');

    collectible.update(785); // sin(785/500 + 0) = sin(1.57) ≈ 1.0
    const positions = collectible.getItemPositions();

    // With amplitude=20, max offset should be ~20 (not 6)
    const offset = Math.abs(positions[0].displayY - positions[0].y);
    expect(offset).toBeGreaterThan(10); // well above default 6
  });

  it('should use custom floatFrequency for animation speed', () => {
    // Slow frequency setup
    const engine1 = new Engine();
    const c1 = new Collectible('col-1', {
      items: sampleItems,
      floatFrequency: 1000,
    });
    engine1.addModule(c1);
    engine1.eventBus.emit('gameflow:resume');

    c1.update(250);
    const posSlow = c1.getItemPositions();
    // Use item index 1 to avoid sin(0 + 0) = 0 issue
    const offsetSlow = Math.abs(posSlow[1].displayY - posSlow[1].y);

    // Default frequency (500) setup
    const engine2 = new Engine();
    const c2 = new Collectible('col-2', {
      items: sampleItems,
    });
    engine2.addModule(c2);
    engine2.eventBus.emit('gameflow:resume');

    c2.update(250);
    const posFast = c2.getItemPositions();
    const offsetFast = Math.abs(posFast[1].displayY - posFast[1].y);

    // Faster frequency (500) should produce larger offset at same elapsed time
    expect(offsetFast).toBeGreaterThan(offsetSlow);
  });
});
