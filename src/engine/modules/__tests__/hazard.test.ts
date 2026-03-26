import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Hazard } from '../mechanic/hazard';

describe('Hazard', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const hazard = new Hazard('hazard-1', params);
    engine.addModule(hazard);
    engine.eventBus.emit('gameflow:resume');
    return { engine, hazard };
  }

  it('should have correct default schema values', () => {
    const hazard = new Hazard('hazard-1');
    const params = hazard.getParams();

    // BaseModule spreads object defaults with { ...default }, so [] becomes {}
    expect(params.hazards).toEqual({});
    expect(params.damage).toBe(1);
    expect(params.damageEvent).toBe('collision:damage');
    expect(params.layer).toBe('hazards');
    expect(params.asset).toBe('');
    expect(params.oscillateSpeed).toBe(100);
    expect(params.oscillateRange).toBe(100);
  });

  it('should keep static hazard positions unchanged', () => {
    const { hazard } = setup({
      hazards: [
        { x: 100, y: 200, width: 50, height: 50, pattern: 'static' },
      ],
    });

    hazard.update(1000);

    const positions = hazard.getHazardPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0].x).toBe(100);
    expect(positions[0].y).toBe(200);
    expect(positions[0].width).toBe(50);
    expect(positions[0].height).toBe(50);
  });

  it('should move oscillating hazard along X axis using sin', () => {
    const { hazard } = setup({
      hazards: [
        { x: 100, y: 200, width: 50, height: 50, pattern: 'oscillate' },
      ],
      oscillateSpeed: 100,
      oscillateRange: 100,
    });

    // At dt=0, elapsed=0, sin(0)=0 => x stays at 100
    hazard.update(0);
    const pos0 = hazard.getHazardPositions();
    expect(pos0[0].x).toBeCloseTo(100, 1);
    expect(pos0[0].y).toBe(200); // Y unchanged for oscillate

    // After 1 second, elapsed=1, sin(1 * (100/100)) = sin(1)
    hazard.update(1000);
    const pos1 = hazard.getHazardPositions();
    expect(pos1[0].x).toBeCloseTo(100 + Math.sin(1) * 100, 1);
    expect(pos1[0].y).toBe(200); // Y still unchanged
  });

  it('should move rotating hazard using cos/sin for both axes', () => {
    const { hazard } = setup({
      hazards: [
        { x: 100, y: 200, width: 50, height: 50, pattern: 'rotate' },
      ],
      oscillateSpeed: 100,
      oscillateRange: 100,
    });

    // At dt=0, elapsed=0, cos(0)=1, sin(0)=0
    hazard.update(0);
    const pos0 = hazard.getHazardPositions();
    expect(pos0[0].x).toBeCloseTo(200, 1); // 100 + cos(0)*100 = 200
    expect(pos0[0].y).toBeCloseTo(200, 1); // 200 + sin(0)*100 = 200

    // After 1 second, elapsed=1, angle = 1*(100/100) = 1
    hazard.update(1000);
    const pos1 = hazard.getHazardPositions();
    expect(pos1[0].x).toBeCloseTo(100 + Math.cos(1) * 100, 1);
    expect(pos1[0].y).toBeCloseTo(200 + Math.sin(1) * 100, 1);
  });

  it('should emit damage event on collision hit', () => {
    const { engine, hazard } = setup({
      hazards: [
        { x: 100, y: 100, width: 50, height: 50, pattern: 'static' },
      ],
      damage: 3,
      damageEvent: 'collision:damage',
    });

    const damageHandler = vi.fn();
    engine.eventBus.on('collision:damage', damageHandler);

    const hit = hazard.checkCollision(125, 125); // inside 100..150, 100..150

    expect(hit).toBe(true);
    expect(damageHandler).toHaveBeenCalledOnce();
    expect(damageHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        damage: 3,
        x: 125,
        y: 125,
      }),
    );
  });

  it('should NOT emit damage event on collision miss', () => {
    const { engine, hazard } = setup({
      hazards: [
        { x: 100, y: 100, width: 50, height: 50, pattern: 'static' },
      ],
    });

    const damageHandler = vi.fn();
    engine.eventBus.on('collision:damage', damageHandler);

    const hit = hazard.checkCollision(300, 300); // outside the hazard rect

    expect(hit).toBe(false);
    expect(damageHandler).not.toHaveBeenCalled();
  });

  it('should detect collision when player radius overlaps hazard rect', () => {
    const { engine, hazard } = setup({
      hazards: [
        { x: 100, y: 100, width: 50, height: 50, pattern: 'static' },
      ],
    });

    const damageHandler = vi.fn();
    engine.eventBus.on('collision:damage', damageHandler);

    // Player center at (90, 125) with radius 15 — extends into hazard rect (100-150, 100-150)
    // Point (90, 125) is outside rect, but circle edge at x=90+15=105 is inside
    const hit = hazard.checkCollision(90, 125, 15);
    expect(hit).toBe(true);
    expect(damageHandler).toHaveBeenCalledOnce();
  });

  it('should miss when player radius does not reach hazard', () => {
    const { engine, hazard } = setup({
      hazards: [
        { x: 100, y: 100, width: 50, height: 50, pattern: 'static' },
      ],
    });

    const damageHandler = vi.fn();
    engine.eventBus.on('collision:damage', damageHandler);

    // Player center at (80, 125) with radius 15 — edge at x=95, doesn't reach rect start at x=100
    const hit = hazard.checkCollision(80, 125, 15);
    expect(hit).toBe(false);
    expect(damageHandler).not.toHaveBeenCalled();
  });

  it('should skip hazards with zero or negative dimensions', () => {
    const { engine, hazard } = setup({
      hazards: [
        { x: 100, y: 100, width: 0, height: 50, pattern: 'static' },
        { x: 200, y: 200, width: -10, height: 50, pattern: 'static' },
        { x: 300, y: 300, width: 50, height: 0, pattern: 'static' },
      ],
    });

    const damageHandler = vi.fn();
    engine.eventBus.on('collision:damage', damageHandler);

    // Even inside the nominal area, should not trigger for invalid dimensions
    hazard.checkCollision(100, 125);
    hazard.checkCollision(200, 225);
    hazard.checkCollision(300, 300);

    expect(damageHandler).not.toHaveBeenCalled();
  });

  it('should reset hazard states to initial positions', () => {
    const { hazard } = setup({
      hazards: [
        { x: 100, y: 200, width: 50, height: 50, pattern: 'oscillate' },
      ],
      oscillateSpeed: 100,
      oscillateRange: 100,
    });

    // Move the hazard
    hazard.update(1000);
    const posAfterMove = hazard.getHazardPositions();
    expect(posAfterMove[0].x).not.toBe(100);

    // Reset
    hazard.reset();
    const posAfterReset = hazard.getHazardPositions();
    expect(posAfterReset[0].x).toBe(100);
    expect(posAfterReset[0].y).toBe(200);
  });
});
