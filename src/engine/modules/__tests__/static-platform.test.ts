import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { StaticPlatform } from '../mechanic/static-platform';
import type { PlatformRect } from '../mechanic/static-platform';

describe('StaticPlatform', () => {
  const samplePlatforms: PlatformRect[] = [
    { x: 0, y: 0.9, width: 1, height: 0.1, material: 'normal' },
    { x: 0.2, y: 0.5, width: 0.3, height: 0.05, material: 'ice' },
    { x: 0.7, y: 0.6, width: 0.2, height: 0.05, material: 'sticky' },
  ];

  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const platform = new StaticPlatform('platform-1', params);
    engine.addModule(platform);
    return { engine, platform };
  }

  it('should have correct default schema values', () => {
    const platform = new StaticPlatform('platform-1');
    const params = platform.getParams();

    expect(params.layer).toBe('platforms');
    expect(params.friction).toBe(0.8);
    expect(params.asset).toBe('');
    expect(params.tileMode).toBe('stretch');
  });

  it('should return all platforms via getPlatforms', () => {
    const { platform } = setup({ platforms: samplePlatforms });

    const result = platform.getPlatforms();
    expect(result).toHaveLength(3);
    expect(result[0].material).toBe('normal');
    expect(result[1].material).toBe('ice');
    expect(result[2].material).toBe('sticky');
  });

  it('should return empty array when no platforms are provided', () => {
    const { platform } = setup();

    const result = platform.getPlatforms();
    expect(result).toEqual([]);
  });

  it('should detect collision when point is inside a platform rect', () => {
    const { platform } = setup({ platforms: samplePlatforms });

    // Point inside the first platform (ground)
    const result = platform.checkCollision(0.5, 0.95);
    expect(result).not.toBeNull();
    expect(result!.material).toBe('normal');
    expect(result!.index).toBe(0);
  });

  it('should return null when point misses all platforms', () => {
    const { platform } = setup({ platforms: samplePlatforms });

    // Point in empty space
    const result = platform.checkCollision(0.5, 0.3);
    expect(result).toBeNull();
  });

  it('should emit platform:contact event on collision', () => {
    const { engine, platform } = setup({ platforms: samplePlatforms });
    const contactHandler = vi.fn();
    engine.eventBus.on('platform:contact', contactHandler);

    platform.checkCollision(0.25, 0.52);

    expect(contactHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'platform-1',
        index: 1,
        material: 'ice',
        x: 0.25,
        y: 0.52,
      }),
    );
  });

  it('should not emit platform:contact when no collision occurs', () => {
    const { engine, platform } = setup({ platforms: samplePlatforms });
    const contactHandler = vi.fn();
    engine.eventBus.on('platform:contact', contactHandler);

    platform.checkCollision(0.5, 0.3);

    expect(contactHandler).not.toHaveBeenCalled();
  });

  it('should return correct friction for normal material', () => {
    const { platform } = setup();
    expect(platform.getFriction('normal')).toBe(0.8);
  });

  it('should return correct friction for ice material', () => {
    const { platform } = setup();
    expect(platform.getFriction('ice')).toBe(0.1);
  });

  it('should return correct friction for sticky material', () => {
    const { platform } = setup();
    expect(platform.getFriction('sticky')).toBe(1.0);
  });

  it('should return default friction for unknown material', () => {
    const { platform } = setup({ friction: 0.5 });
    expect(platform.getFriction('rubber')).toBe(0.5);
  });

  it('should return default friction when no material is provided', () => {
    const { platform } = setup();
    expect(platform.getFriction()).toBe(0.8);
  });

  it('update should be a no-op', () => {
    const { platform } = setup({ platforms: samplePlatforms });

    // Should not throw
    platform.update(16);
    platform.update(100);

    // Platforms should remain unchanged
    expect(platform.getPlatforms()).toHaveLength(3);
  });

  it('reset should be a no-op', () => {
    const { platform } = setup({ platforms: samplePlatforms });

    platform.reset();

    // Platforms remain (they are params, not runtime state)
    expect(platform.getPlatforms()).toHaveLength(3);
  });
});
