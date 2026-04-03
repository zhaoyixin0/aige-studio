import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Randomizer } from '../mechanic/randomizer';

describe('Randomizer', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const randomizer = new Randomizer('rand-1', {
      items: [
        { asset: 'prize-a', label: 'Prize A', weight: 1 },
        { asset: 'prize-b', label: 'Prize B', weight: 1 },
        { asset: 'prize-c', label: 'Prize C', weight: 1 },
      ],
      animation: 'instant',
      spinDuration: 1, // 1 second
      trigger: 'tap',
      ...params,
    });
    engine.addModule(randomizer);
    engine.eventBus.emit('gameflow:resume');
    return { engine, randomizer };
  }

  it('should spin and emit randomizer:result with selected item', () => {
    const { engine, randomizer } = setup({ spinDuration: 1 });
    const resultHandler = vi.fn();
    engine.eventBus.on('randomizer:result', resultHandler);

    randomizer.spin();
    expect(randomizer.isSpinning()).toBe(true);

    // Advance past spin duration
    engine.tick(1100);

    expect(randomizer.isSpinning()).toBe(false);
    expect(resultHandler).toHaveBeenCalledOnce();

    const result = resultHandler.mock.calls[0][0];
    expect(result).toHaveProperty('item');
    expect(result).toHaveProperty('index');
    expect(result.index).toBeGreaterThanOrEqual(0);
    expect(result.index).toBeLessThan(3);
  });

  it('should respect weights (high weight item selected more often)', () => {
    const { engine, randomizer } = setup({
      items: [
        { asset: 'common', label: 'Common', weight: 100 },
        { asset: 'rare', label: 'Rare', weight: 1 },
      ],
      spinDuration: 0.1, // fast spins for testing
    });

    const results: number[] = [];
    engine.eventBus.on('randomizer:result', (data: any) => {
      results.push(data.index);
    });

    // Run many spins
    for (let i = 0; i < 200; i++) {
      randomizer.spin();
      engine.tick(200); // past spinDuration
    }

    const commonCount = results.filter((i) => i === 0).length;
    const rareCount = results.filter((i) => i === 1).length;

    // Common (weight 100) should be selected far more often than Rare (weight 1)
    expect(commonCount).toBeGreaterThan(rareCount * 5);
  });

  it('should auto-spin on gameflow:resume when trigger is auto', () => {
    // Build without auto gameflow:resume so we can attach spy first
    const engine = new Engine();
    const randomizer = new Randomizer('rand-1', {
      items: [
        { asset: 'prize-a', label: 'Prize A', weight: 1 },
        { asset: 'prize-b', label: 'Prize B', weight: 1 },
      ],
      animation: 'instant',
      spinDuration: 0.5,
      trigger: 'auto',
    });
    engine.addModule(randomizer);

    const spinHandler = vi.fn();
    engine.eventBus.on('randomizer:spinning', spinHandler);

    // Now emit gameflow:resume — should trigger auto-spin
    engine.eventBus.emit('gameflow:resume');

    expect(spinHandler).toHaveBeenCalledOnce();
    expect(randomizer.isSpinning()).toBe(true);
  });

  it('should not advance spin timer when gameflow is paused', () => {
    const engine = new Engine();
    const randomizer = new Randomizer('rand-1', {
      items: [
        { asset: 'prize-a', label: 'Prize A', weight: 1 },
      ],
      animation: 'instant',
      spinDuration: 1,
      trigger: 'tap',
    });
    engine.addModule(randomizer);
    // Do NOT emit gameflow:resume — module stays paused

    randomizer.spin();
    expect(randomizer.isSpinning()).toBe(true);

    // Timer should not advance while paused
    randomizer.update(2000);
    expect(randomizer.isSpinning()).toBe(true); // still spinning, not resolved
  });

  it('should auto-spin again after result in auto mode', () => {
    const { engine, randomizer } = setup({ trigger: 'auto', spinDuration: 0.5 });
    const resultHandler = vi.fn();
    engine.eventBus.on('randomizer:result', resultHandler);

    // Already spinning from setup's gameflow:resume
    expect(randomizer.isSpinning()).toBe(true);

    // Complete first spin — deferred auto-spin fires in same tick
    engine.tick(600);
    expect(resultHandler).toHaveBeenCalledOnce();

    // Should already be spinning again (deferred auto-spin)
    expect(randomizer.isSpinning()).toBe(true);

    // Complete second spin
    engine.tick(600);
    expect(resultHandler).toHaveBeenCalledTimes(2);
  });

  // ─── SpinWheel-specific params ──────────────────────────────

  describe('SpinWheel schema params', () => {
    it('should include all 14 schema fields', () => {
      const randomizer = new Randomizer('rand-1');
      const schema = randomizer.getSchema();
      const expectedKeys = [
        'items',
        'animation',
        'spinDuration',
        'trigger',
        'sectorCount',
        'spinSpeed',
        'settleDuration',
        'pointerWidth',
        'decelCurve',
        'prizeMultiplier',
        'pointerJitter',
        'wheelRadius',
        'pointerOffset',
        'showLabels',
      ];
      for (const key of expectedKeys) {
        expect(schema).toHaveProperty(key);
      }
      expect(Object.keys(schema)).toHaveLength(14);
    });

    it('should have sensible default values for all new params', () => {
      const randomizer = new Randomizer('rand-1');
      const params = randomizer.getParams();

      expect(params.sectorCount).toBe(8);
      expect(params.spinSpeed).toBe(720);
      expect(params.settleDuration).toBe(1.5);
      expect(params.pointerWidth).toBe(20);
      expect(params.decelCurve).toBe('easeOutCubic');
      expect(params.prizeMultiplier).toBe(1);
      expect(params.pointerJitter).toBe(0.3);
      expect(params.wheelRadius).toBe(150);
      expect(params.pointerOffset).toBe(0);
      expect(params.showLabels).toBe(true);
    });

    it('should accept new params via configure() without breaking existing', () => {
      const { randomizer } = setup();
      const originalParams = randomizer.getParams();

      randomizer.configure({
        sectorCount: 12,
        spinSpeed: 900,
        decelCurve: 'easeOutQuad',
      });

      const updated = randomizer.getParams();

      // New params updated
      expect(updated.sectorCount).toBe(12);
      expect(updated.spinSpeed).toBe(900);
      expect(updated.decelCurve).toBe('easeOutQuad');

      // Existing params preserved
      expect(updated.items).toEqual(originalParams.items);
      expect(updated.animation).toBe(originalParams.animation);
      expect(updated.spinDuration).toBe(originalParams.spinDuration);
      expect(updated.trigger).toBe(originalParams.trigger);
    });
  });

  describe('weighted pick distribution', () => {
    it('should produce statistically correct distribution over many trials', () => {
      const { engine, randomizer } = setup({
        items: [
          { asset: 'a', label: 'A', weight: 3 },
          { asset: 'b', label: 'B', weight: 2 },
          { asset: 'c', label: 'C', weight: 1 },
        ],
        spinDuration: 0.05,
      });

      const counts = [0, 0, 0];
      engine.eventBus.on('randomizer:result', (data: any) => {
        counts[data.index]++;
      });

      const trials = 600;
      for (let i = 0; i < trials; i++) {
        randomizer.spin();
        engine.tick(100);
      }

      const total = counts[0] + counts[1] + counts[2];
      expect(total).toBe(trials);

      // With weights 3:2:1, expected proportions: 50%, 33%, 17%
      // Allow 15% tolerance for randomness
      expect(counts[0] / total).toBeGreaterThan(0.35);
      expect(counts[0] / total).toBeLessThan(0.65);
      expect(counts[1] / total).toBeGreaterThan(0.18);
      expect(counts[1] / total).toBeLessThan(0.48);
      expect(counts[2] / total).toBeGreaterThan(0.02);
      expect(counts[2] / total).toBeLessThan(0.32);
    });
  });

  describe('wheel animation mode', () => {
    it('should emit randomizer:result after spinDuration + settleDuration in wheel mode', () => {
      const { engine, randomizer } = setup({
        animation: 'wheel',
        spinDuration: 2,
        settleDuration: 1.0,
      });

      const resultHandler = vi.fn();
      engine.eventBus.on('randomizer:result', resultHandler);

      randomizer.spin();

      // Halfway through spin — no result yet
      engine.tick(1500);
      expect(resultHandler).not.toHaveBeenCalled();
      expect(randomizer.isSpinning()).toBe(true);

      // Past spinDuration but within settleDuration — still settling
      engine.tick(600);
      expect(resultHandler).not.toHaveBeenCalled();
      expect(randomizer.isSpinning()).toBe(true);

      // Past spinDuration + settleDuration — result emitted
      engine.tick(1000);
      expect(resultHandler).toHaveBeenCalledOnce();
      expect(randomizer.isSpinning()).toBe(false);
    });

    it('should emit randomizer:settling event when entering settle phase in wheel mode', () => {
      const { engine, randomizer } = setup({
        animation: 'wheel',
        spinDuration: 1,
        settleDuration: 1.0,
      });

      const settlingHandler = vi.fn();
      engine.eventBus.on('randomizer:settling', settlingHandler);

      randomizer.spin();

      // Past spinDuration — should start settling
      engine.tick(1100);
      expect(settlingHandler).toHaveBeenCalledOnce();
    });

    it('should not add settleDuration for non-wheel animations', () => {
      const { engine, randomizer } = setup({
        animation: 'instant',
        spinDuration: 1,
        settleDuration: 2.0, // should be ignored for instant
      });

      const resultHandler = vi.fn();
      engine.eventBus.on('randomizer:result', resultHandler);

      randomizer.spin();
      engine.tick(1100);

      // Should resolve at spinDuration, ignoring settleDuration
      expect(resultHandler).toHaveBeenCalledOnce();
    });
  });

  describe('prizeMultiplier', () => {
    it('should include prizeMultiplier in result payload', () => {
      const { engine, randomizer } = setup({
        spinDuration: 0.1,
        prizeMultiplier: 3,
      });

      const resultHandler = vi.fn();
      engine.eventBus.on('randomizer:result', resultHandler);

      randomizer.spin();
      engine.tick(200);

      expect(resultHandler).toHaveBeenCalledOnce();
      const result = resultHandler.mock.calls[0][0];
      expect(result.prizeMultiplier).toBe(3);
    });

    it('should default prizeMultiplier to 1 in result', () => {
      const { engine, randomizer } = setup({
        spinDuration: 0.1,
      });

      const resultHandler = vi.fn();
      engine.eventBus.on('randomizer:result', resultHandler);

      randomizer.spin();
      engine.tick(200);

      const result = resultHandler.mock.calls[0][0];
      expect(result.prizeMultiplier).toBe(1);
    });
  });

  describe('contracts', () => {
    it('should include randomizer:settling in emits for wheel-capable module', () => {
      const randomizer = new Randomizer('rand-1');
      const contracts = randomizer.getContracts();

      expect(contracts.emits).toContain('randomizer:spinning');
      expect(contracts.emits).toContain('randomizer:result');
      expect(contracts.emits).toContain('randomizer:settling');
    });
  });

  describe('getSpinProgress', () => {
    it('should report progress accounting for settleDuration in wheel mode', () => {
      const { engine, randomizer } = setup({
        animation: 'wheel',
        spinDuration: 2,
        settleDuration: 2,
      });

      randomizer.spin();
      // At 1s into a 2+2=4s total → 25%
      engine.tick(1000);
      const progress = randomizer.getSpinProgress();
      expect(progress).toBeCloseTo(0.25, 1);
    });

    it('should report progress based on spinDuration only for non-wheel modes', () => {
      const { engine, randomizer } = setup({
        animation: 'instant',
        spinDuration: 2,
        settleDuration: 2, // ignored for non-wheel
      });

      randomizer.spin();
      engine.tick(1000);
      const progress = randomizer.getSpinProgress();
      // 1s / 2s = 0.5
      expect(progress).toBeCloseTo(0.5, 1);
    });
  });
});
