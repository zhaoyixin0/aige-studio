import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { MovingPlatform } from '../mechanic/moving-platform';

describe('MovingPlatform', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const platform = new MovingPlatform('platform-1', params);
    engine.addModule(platform);
    engine.eventBus.emit('gameflow:resume');
    return { engine, platform };
  }

  it('should have correct default schema values', () => {
    const platform = new MovingPlatform('platform-1');
    const params = platform.getParams();

    // BaseModule spreads object defaults with { ...default }, so [] becomes {}
    expect(params.platforms).toEqual({});
    expect(params.layer).toBe('platforms');
    expect(params.asset).toBe('');
    expect(params.tileMode).toBe('stretch');
  });

  it('should move platform horizontally', () => {
    const { platform } = setup({
      platforms: [
        { x: 100, y: 200, width: 80, height: 20, pattern: 'horizontal', speed: 100, range: 50 },
      ],
    });

    platform.update(100); // 0.1 sec at speed 100 = 10px

    const positions = platform.getPlatformPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0].x).toBeCloseTo(110, 1);
    expect(positions[0].y).toBe(200);
  });

  it('should reverse direction at range boundary for horizontal', () => {
    const { platform } = setup({
      platforms: [
        { x: 100, y: 200, width: 80, height: 20, pattern: 'horizontal', speed: 100, range: 50 },
      ],
    });

    // Move for 0.5s => offset = 50, hits range boundary
    platform.update(500);

    const posAtEdge = platform.getPlatformPositions();
    expect(posAtEdge[0].x).toBeCloseTo(150, 1);

    // Next update should go in the opposite direction
    platform.update(100);
    const posAfterReverse = platform.getPlatformPositions();
    expect(posAfterReverse[0].x).toBeLessThan(150);
  });

  it('should move platform vertically', () => {
    const { platform } = setup({
      platforms: [
        { x: 100, y: 200, width: 80, height: 20, pattern: 'vertical', speed: 100, range: 50 },
      ],
    });

    platform.update(100); // 0.1 sec at speed 100 = 10px

    const positions = platform.getPlatformPositions();
    expect(positions[0].x).toBe(100);
    expect(positions[0].y).toBeCloseTo(210, 1);
  });

  it('should reverse direction at range boundary for vertical', () => {
    const { platform } = setup({
      platforms: [
        { x: 100, y: 200, width: 80, height: 20, pattern: 'vertical', speed: 100, range: 50 },
      ],
    });

    // Move for 0.5s => offset = 50, hits range boundary
    platform.update(500);

    const posAtEdge = platform.getPlatformPositions();
    expect(posAtEdge[0].y).toBeCloseTo(250, 1);

    // Next update should go in the opposite direction
    platform.update(100);
    const posAfterReverse = platform.getPlatformPositions();
    expect(posAfterReverse[0].y).toBeLessThan(250);
  });

  it('should emit platform:move event on update', () => {
    const { engine, platform } = setup({
      platforms: [
        { x: 100, y: 200, width: 80, height: 20, pattern: 'horizontal', speed: 100, range: 50 },
      ],
    });

    const moveHandler = vi.fn();
    engine.eventBus.on('platform:move', moveHandler);

    platform.update(100);

    expect(moveHandler).toHaveBeenCalledTimes(1);
    expect(moveHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 0,
        width: 80,
        height: 20,
      }),
    );
    // x should have moved
    const callData = moveHandler.mock.calls[0][0];
    expect(callData.x).toBeCloseTo(110, 1);
    expect(callData.y).toBe(200);
  });

  it('should reset platforms to initial positions', () => {
    const { platform } = setup({
      platforms: [
        { x: 100, y: 200, width: 80, height: 20, pattern: 'horizontal', speed: 100, range: 50 },
      ],
    });

    // Move the platform
    platform.update(200);

    const posAfterMove = platform.getPlatformPositions();
    expect(posAfterMove[0].x).not.toBe(100);

    // Reset
    platform.reset();

    const posAfterReset = platform.getPlatformPositions();
    expect(posAfterReset[0].x).toBe(100);
    expect(posAfterReset[0].y).toBe(200);
  });

  it('should detect collision with point inside platform', () => {
    const { platform } = setup({
      platforms: [
        { x: 100, y: 200, width: 80, height: 20, pattern: 'horizontal', speed: 0, range: 50 },
      ],
    });

    // Point inside platform rect (100..180, 200..220)
    expect(platform.checkCollision(140, 210)).toBe(true);
    // Point outside
    expect(platform.checkCollision(50, 210)).toBe(false);
    expect(platform.checkCollision(140, 300)).toBe(false);
  });

  it('should move platform in circular pattern', () => {
    const { platform } = setup({
      platforms: [
        { x: 100, y: 200, width: 80, height: 20, pattern: 'circular', speed: 1, range: 30 },
      ],
    });

    // At progress=0, cos(0)=1, sin(0)=0 => x=100+30=130, y=200+0=200
    // But initial position is (100, 200), after first update progress advances
    platform.update(0); // dt=0, progress stays 0
    const pos0 = platform.getPlatformPositions();
    expect(pos0[0].x).toBeCloseTo(130, 1);
    expect(pos0[0].y).toBeCloseTo(200, 1);

    // After some time, position should change
    platform.update(1000); // 1 sec, progress = 1 rad
    const pos1 = platform.getPlatformPositions();
    expect(pos1[0].x).toBeCloseTo(100 + Math.cos(1) * 30, 1);
    expect(pos1[0].y).toBeCloseTo(200 + Math.sin(1) * 30, 1);
  });
});
