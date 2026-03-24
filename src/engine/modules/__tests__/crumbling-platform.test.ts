import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { CrumblingPlatform } from '../mechanic/crumbling-platform';

describe('CrumblingPlatform', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const platform = new CrumblingPlatform('crumble-1', params);
    engine.addModule(platform);
    engine.eventBus.emit('gameflow:resume');
    return { engine, platform };
  }

  it('should have correct default schema values', () => {
    const platform = new CrumblingPlatform('crumble-1');
    const params = platform.getParams();

    // BaseModule spreads object defaults with { ...default }, so [] becomes {}
    expect(params.platforms).toEqual({});
    expect(params.delay).toBe(500);
    expect(params.respawnTime).toBe(3);
    expect(params.layer).toBe('platforms');
    expect(params.asset).toBe('');
    expect(params.crumbleAsset).toBe('');
  });

  it('should crumble after delay', () => {
    const { engine, platform } = setup({
      platforms: [{ x: 0, y: 0, width: 100, height: 20 }],
      delay: 500,
    });

    const crumbleHandler = vi.fn();
    engine.eventBus.on('platform:crumble', crumbleHandler);

    platform.triggerCrumble(0);

    // Not yet crumbled
    platform.update(200);
    expect(crumbleHandler).not.toHaveBeenCalled();
    expect(platform.isPlatformActive(0)).toBe(true);

    // Enough time has passed
    platform.update(300);
    expect(crumbleHandler).toHaveBeenCalledTimes(1);
    expect(crumbleHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crumble-0', index: 0 }),
    );
  });

  it('should report inactive after crumble', () => {
    const { platform } = setup({
      platforms: [{ x: 0, y: 0, width: 100, height: 20 }],
      delay: 300,
    });

    platform.triggerCrumble(0);
    platform.update(300);

    expect(platform.isPlatformActive(0)).toBe(false);
  });

  it('should respawn after respawnTime', () => {
    const { engine, platform } = setup({
      platforms: [{ x: 0, y: 0, width: 100, height: 20 }],
      delay: 200,
      respawnTime: 2,
    });

    const respawnHandler = vi.fn();
    engine.eventBus.on('platform:respawn', respawnHandler);

    // Crumble the platform
    platform.triggerCrumble(0);
    platform.update(200);
    expect(platform.isPlatformActive(0)).toBe(false);

    // Not yet respawned
    platform.update(1000);
    expect(platform.isPlatformActive(0)).toBe(false);
    expect(respawnHandler).not.toHaveBeenCalled();

    // Respawn after 2s total
    platform.update(1000);
    expect(platform.isPlatformActive(0)).toBe(true);
    expect(respawnHandler).toHaveBeenCalledTimes(1);
    expect(respawnHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crumble-0', index: 0 }),
    );
  });

  it('should not respawn when respawnTime is 0', () => {
    const { engine, platform } = setup({
      platforms: [{ x: 0, y: 0, width: 100, height: 20 }],
      delay: 200,
      respawnTime: 0,
    });

    const respawnHandler = vi.fn();
    engine.eventBus.on('platform:respawn', respawnHandler);

    platform.triggerCrumble(0);
    platform.update(200);
    expect(platform.isPlatformActive(0)).toBe(false);

    // Wait a long time
    platform.update(10000);
    expect(platform.isPlatformActive(0)).toBe(false);
    expect(respawnHandler).not.toHaveBeenCalled();
  });

  it('should reset all platforms to active', () => {
    const { platform } = setup({
      platforms: [
        { x: 0, y: 0, width: 100, height: 20 },
        { x: 200, y: 0, width: 100, height: 20 },
      ],
      delay: 100,
    });

    // Crumble both platforms
    platform.triggerCrumble(0);
    platform.triggerCrumble(1);
    platform.update(100);

    expect(platform.isPlatformActive(0)).toBe(false);
    expect(platform.isPlatformActive(1)).toBe(false);

    // Reset
    platform.reset();

    expect(platform.isPlatformActive(0)).toBe(true);
    expect(platform.isPlatformActive(1)).toBe(true);
  });

  it('should return platforms array', () => {
    const platformDefs = [
      { x: 0, y: 0, width: 100, height: 20 },
      { x: 200, y: 0, width: 80, height: 15 },
    ];
    const { platform } = setup({ platforms: platformDefs });

    const result = platform.getPlatforms();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(platformDefs[0]);
    expect(result[1]).toEqual(platformDefs[1]);
  });

  it('should not trigger crumble on already crumbling platform', () => {
    const { engine, platform } = setup({
      platforms: [{ x: 0, y: 0, width: 100, height: 20 }],
      delay: 500,
    });

    const crumbleHandler = vi.fn();
    engine.eventBus.on('platform:crumble', crumbleHandler);

    platform.triggerCrumble(0);
    platform.update(200);

    // Try to trigger again while still crumbling - timer should not reset
    platform.triggerCrumble(0);
    platform.update(300);

    // Should crumble at 500ms total from first trigger
    expect(crumbleHandler).toHaveBeenCalledTimes(1);
  });

  it('should not trigger crumble on inactive platform', () => {
    const { engine, platform } = setup({
      platforms: [{ x: 0, y: 0, width: 100, height: 20 }],
      delay: 200,
      respawnTime: 0,
    });

    const crumbleHandler = vi.fn();
    engine.eventBus.on('platform:crumble', crumbleHandler);

    // Crumble it
    platform.triggerCrumble(0);
    platform.update(200);
    expect(crumbleHandler).toHaveBeenCalledTimes(1);

    // Try to trigger crumble on inactive platform
    platform.triggerCrumble(0);
    platform.update(200);
    expect(crumbleHandler).toHaveBeenCalledTimes(1); // no additional call
  });
});
