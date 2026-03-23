import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { WallDetect } from '../mechanic/wall-detect';

describe('WallDetect', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const wallDetect = new WallDetect('wd-1', params);
    engine.addModule(wallDetect);
    return { engine, wallDetect };
  }

  it('should have correct default values', () => {
    const { wallDetect } = setup();
    const params = wallDetect.getParams();

    expect(params.wallSlide).toBe(true);
    expect(params.slideSpeed).toBe(100);
    expect(params.wallJump).toBe(true);
    expect(params.wallJumpForce).toEqual({ x: 400, y: 600 });
    expect(params.wallJumpEvent).toBe('input:touch:tap');
  });

  it('should detect wall contact', () => {
    const { engine, wallDetect } = setup();
    const handler = vi.fn();
    engine.eventBus.on('wall:contact', handler);

    wallDetect.setWallContact('left');

    expect(wallDetect.isTouchingWall()).toBe(true);
    expect(wallDetect.getWallSide()).toBe('left');
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ side: 'left' });
  });

  it('should emit wall:slide when wallSlide is enabled', () => {
    const { wallDetect, engine } = setup({ wallSlide: true, slideSpeed: 150 });
    const handler = vi.fn();
    engine.eventBus.on('wall:slide', handler);

    wallDetect.setWallContact('right');
    wallDetect.update(16);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ side: 'right', speed: 150 });
  });

  it('should not emit wall:slide when wallSlide is disabled', () => {
    const { wallDetect, engine } = setup({ wallSlide: false });
    const handler = vi.fn();
    engine.eventBus.on('wall:slide', handler);

    wallDetect.setWallContact('left');
    wallDetect.update(16);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should emit wall:jump correctly on wall jump event', () => {
    const { engine, wallDetect } = setup({
      wallJump: true,
      wallJumpEvent: 'input:touch:tap',
      wallJumpForce: { x: 500, y: 700 },
    });
    const handler = vi.fn();
    engine.eventBus.on('wall:jump', handler);

    wallDetect.setWallContact('left');
    engine.eventBus.emit('input:touch:tap');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      forceX: 500,
      forceY: 700,
      awaySide: 'right',
      fromSide: 'left',
    });

    // Contact should be cleared after wall jump
    expect(wallDetect.isTouchingWall()).toBe(false);
    expect(wallDetect.getWallSide()).toBeNull();
  });

  it('should not emit wall:jump when not touching wall', () => {
    const { engine } = setup({
      wallJump: true,
      wallJumpEvent: 'input:touch:tap',
    });
    const handler = vi.fn();
    engine.eventBus.on('wall:jump', handler);

    engine.eventBus.emit('input:touch:tap');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should clear wall contact', () => {
    const { wallDetect } = setup();

    wallDetect.setWallContact('right');
    expect(wallDetect.isTouchingWall()).toBe(true);
    expect(wallDetect.getWallSide()).toBe('right');

    wallDetect.clearWallContact();
    expect(wallDetect.isTouchingWall()).toBe(false);
    expect(wallDetect.getWallSide()).toBeNull();
  });

  it('should return correct slide speed', () => {
    const { wallDetect } = setup({ slideSpeed: 200 });
    expect(wallDetect.getSlideSpeed()).toBe(200);
  });

  it('should reset all state', () => {
    const { wallDetect } = setup();

    wallDetect.setWallContact('left');
    expect(wallDetect.isTouchingWall()).toBe(true);
    expect(wallDetect.getWallSide()).toBe('left');

    wallDetect.reset();

    expect(wallDetect.isTouchingWall()).toBe(false);
    expect(wallDetect.getWallSide()).toBeNull();
  });
});
