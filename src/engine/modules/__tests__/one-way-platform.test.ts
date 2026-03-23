import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { OneWayPlatform } from '../mechanic/one-way-platform';
import type { OneWayPlatformDef } from '../mechanic/one-way-platform';

describe('OneWayPlatform', () => {
  const samplePlatforms: OneWayPlatformDef[] = [
    { x: 100, y: 300, width: 200 },
    { x: 400, y: 500, width: 150 },
  ];

  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const platform = new OneWayPlatform('owp-1', params);
    engine.addModule(platform);
    return { engine, platform };
  }

  it('should have correct default schema values', () => {
    const platform = new OneWayPlatform('owp-1');
    const params = platform.getParams();

    // BaseModule spreads object defaults with { ...default }, so [] becomes {}
    expect(params.platforms).toEqual({});
    expect(params.layer).toBe('platforms');
    expect(params.dropThroughEvent).toBe('');
    expect(params.asset).toBe('');
    expect(params.tileMode).toBe('stretch');
  });

  it('should detect landing from above when falling through platform y', () => {
    const { platform } = setup({ platforms: samplePlatforms });

    // Player at y=290, falling with velocityY=20 => crosses y=300
    const result = platform.checkLanding(150, 290, 20);
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
    expect(result!.y).toBe(300);
  });

  it('should not detect landing when approaching from below (velocityY <= 0)', () => {
    const { platform } = setup({ platforms: samplePlatforms });

    // Moving upward (negative velocity) — should pass through
    const result = platform.checkLanding(150, 310, -20);
    expect(result).toBeNull();
  });

  it('should not detect landing when velocity is zero', () => {
    const { platform } = setup({ platforms: samplePlatforms });

    const result = platform.checkLanding(150, 300, 0);
    expect(result).toBeNull();
  });

  it('should not detect landing when px is outside platform x-range', () => {
    const { platform } = setup({ platforms: samplePlatforms });

    // x=50 is before platform[0].x=100
    const result = platform.checkLanding(50, 290, 20);
    expect(result).toBeNull();
  });

  it('should not detect landing when py is already below platform', () => {
    const { platform } = setup({ platforms: samplePlatforms });

    // py=310 is already below platform y=300
    const result = platform.checkLanding(150, 310, 20);
    expect(result).toBeNull();
  });

  it('should emit platform:land event on landing', () => {
    const { engine, platform } = setup({ platforms: samplePlatforms });
    const landHandler = vi.fn();
    engine.eventBus.on('platform:land', landHandler);

    platform.checkLanding(150, 290, 20);

    expect(landHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'owp-1',
        index: 0,
        x: 150,
        y: 300,
      }),
    );
  });

  it('should not emit platform:land when no landing occurs', () => {
    const { engine, platform } = setup({ platforms: samplePlatforms });
    const landHandler = vi.fn();
    engine.eventBus.on('platform:land', landHandler);

    platform.checkLanding(50, 290, 20);

    expect(landHandler).not.toHaveBeenCalled();
  });

  it('should enable drop-through when dropThroughEvent is fired', () => {
    const { engine, platform } = setup({
      platforms: samplePlatforms,
      dropThroughEvent: 'player:drop',
    });

    expect(platform.isDropping()).toBe(false);

    engine.eventBus.emit('player:drop');

    expect(platform.isDropping()).toBe(true);
  });

  it('should emit platform:drop when drop-through event fires', () => {
    const { engine } = setup({
      platforms: samplePlatforms,
      dropThroughEvent: 'player:drop',
    });

    const dropHandler = vi.fn();
    engine.eventBus.on('platform:drop', dropHandler);

    engine.eventBus.emit('player:drop');

    expect(dropHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'owp-1' }),
    );
  });

  it('should block landing while dropping', () => {
    const { engine, platform } = setup({
      platforms: samplePlatforms,
      dropThroughEvent: 'player:drop',
    });

    engine.eventBus.emit('player:drop');
    expect(platform.isDropping()).toBe(true);

    // Landing check should return null while dropping
    const result = platform.checkLanding(150, 290, 20);
    expect(result).toBeNull();
  });

  it('should re-enable landing after 250ms drop timer', () => {
    const { engine, platform } = setup({
      platforms: samplePlatforms,
      dropThroughEvent: 'player:drop',
    });

    engine.eventBus.emit('player:drop');
    expect(platform.isDropping()).toBe(true);

    // Not enough time elapsed
    platform.update(100);
    expect(platform.isDropping()).toBe(true);

    // Reach 250ms total
    platform.update(150);
    expect(platform.isDropping()).toBe(false);

    // Landing should work again
    const result = platform.checkLanding(150, 290, 20);
    expect(result).not.toBeNull();
  });

  it('should reset dropping state', () => {
    const { engine, platform } = setup({
      platforms: samplePlatforms,
      dropThroughEvent: 'player:drop',
    });

    engine.eventBus.emit('player:drop');
    expect(platform.isDropping()).toBe(true);

    platform.reset();
    expect(platform.isDropping()).toBe(false);

    // Landing should work after reset
    const result = platform.checkLanding(150, 290, 20);
    expect(result).not.toBeNull();
  });

  it('should return platforms array via getPlatforms', () => {
    const { platform } = setup({ platforms: samplePlatforms });

    const result = platform.getPlatforms();
    expect(result).toHaveLength(2);
    expect(result[0].x).toBe(100);
    expect(result[1].x).toBe(400);
  });

  it('should return empty array when no platforms are provided', () => {
    const { platform } = setup();

    const result = platform.getPlatforms();
    expect(result).toEqual([]);
  });

  it('should not subscribe to dropThroughEvent if empty string', () => {
    const { engine, platform } = setup({
      platforms: samplePlatforms,
      dropThroughEvent: '',
    });

    // Emitting random events should not trigger drop
    engine.eventBus.emit('');
    expect(platform.isDropping()).toBe(false);
  });

  it('update should be a no-op when not dropping', () => {
    const { platform } = setup({ platforms: samplePlatforms });

    // Should not throw and dropping should remain false
    platform.update(16);
    platform.update(100);
    expect(platform.isDropping()).toBe(false);
  });
});
