import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { CameraFollow } from '../feedback/camera-follow';

describe('CameraFollow', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const cam = new CameraFollow('cam-1', params);
    engine.addModule(cam);
    engine.eventBus.emit('gameflow:resume');
    return { engine, cam };
  }

  it('should have correct defaults', () => {
    const { cam } = setup();
    const params = cam.getParams();
    expect(params.mode).toBe('center');
    expect(params.smoothing).toBe(0.1);
    expect(params.deadZone).toEqual({ width: 100, height: 50 });
    expect(params.lookAheadDistance).toBe(80);
    expect(params.bounds).toBeUndefined();
    expect(params.shakeEvent).toBe('');
    expect(params.shakeDuration).toBe(200);
    expect(params.shakeIntensity).toBe(5);
    expect(cam.getPosition()).toEqual({ x: 0, y: 0 });
    expect(cam.isShaking()).toBe(false);
  });

  it('should follow player position', () => {
    const { engine, cam } = setup({ smoothing: 0 });

    engine.eventBus.emit('player:move', { x: 200, direction: 1 });
    cam.update(16);

    const pos = cam.getPosition();
    expect(pos.x).toBe(200);
  });

  it('should apply smoothing (lerp does not instantly reach target)', () => {
    const { engine, cam } = setup({ smoothing: 0.5 });

    engine.eventBus.emit('player:move', { x: 400, direction: 1 });
    cam.update(16);

    const pos = cam.getPosition();
    // With smoothing=0.5, t=0.5, so after one frame: x = 0 + (400-0)*0.5 = 200
    expect(pos.x).toBe(200);
    expect(pos.x).toBeLessThan(400);
  });

  it('should emit camera:move on update', () => {
    const { engine, cam } = setup();
    const handler = vi.fn();
    engine.eventBus.on('camera:move', handler);

    engine.eventBus.emit('player:move', { x: 100, direction: 1 });
    cam.update(16);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), shaking: false }),
    );
  });

  it('should not move camera for small movements in dead-zone mode', () => {
    const { engine, cam } = setup({
      mode: 'dead-zone',
      smoothing: 0,
      deadZone: { width: 200, height: 100 },
    });

    // Small movement within dead zone
    engine.eventBus.emit('player:move', { x: 50, direction: 1 });
    cam.update(16);

    // Camera should stay at 0 because 50 < halfW (100)
    expect(cam.getPosition().x).toBe(0);
  });

  it('should move camera when target exceeds dead zone', () => {
    const { engine, cam } = setup({
      mode: 'dead-zone',
      smoothing: 0,
      deadZone: { width: 100, height: 50 },
    });

    // Movement well outside the dead zone
    engine.eventBus.emit('player:move', { x: 200, direction: 1 });
    cam.update(16);

    // Camera should move: goalX = 200 - 50 = 150
    expect(cam.getPosition().x).toBe(150);
  });

  it('should start shake on configured event', () => {
    const { engine, cam } = setup({ shakeEvent: 'explosion' });
    const shakeHandler = vi.fn();
    engine.eventBus.on('camera:shake', shakeHandler);

    engine.eventBus.emit('explosion');

    expect(cam.isShaking()).toBe(true);
    expect(shakeHandler).toHaveBeenCalled();
  });

  it('should stop shake after duration', () => {
    const { engine, cam } = setup({ shakeEvent: 'explosion', shakeDuration: 200 });

    engine.eventBus.emit('explosion');
    expect(cam.isShaking()).toBe(true);

    // Update with time less than duration
    cam.update(100);
    expect(cam.isShaking()).toBe(true);

    // Update past the remaining duration
    cam.update(150);
    expect(cam.isShaking()).toBe(false);
  });

  it('should return non-zero shake offset while shaking', () => {
    const { engine, cam } = setup({ shakeEvent: 'hit', shakeIntensity: 10 });

    // Before shake, offset should be zero
    expect(cam.getShakeOffset()).toEqual({ x: 0, y: 0 });

    // Start shake
    engine.eventBus.emit('hit');

    const offset = cam.getShakeOffset();
    // Offset should be within intensity bounds
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(10);
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(10);
  });

  it('should clamp to bounds', () => {
    const { engine, cam } = setup({
      smoothing: 0,
      bounds: { minX: -100, maxX: 100, minY: -50, maxY: 50 },
    });

    engine.eventBus.emit('player:move', { x: 500, y: 200, direction: 1 });
    cam.update(16);

    const pos = cam.getPosition();
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(50);
  });

  it('should clamp negative bounds', () => {
    const { engine, cam } = setup({
      smoothing: 0,
      bounds: { minX: -100, maxX: 100, minY: -50, maxY: 50 },
    });

    engine.eventBus.emit('player:move', { x: -500, y: -200, direction: -1 });
    cam.update(16);

    const pos = cam.getPosition();
    expect(pos.x).toBe(-100);
    expect(pos.y).toBe(-50);
  });

  it('should apply look-ahead based on player direction', () => {
    const { engine, cam } = setup({
      mode: 'look-ahead',
      smoothing: 0,
      lookAheadDistance: 80,
    });

    engine.eventBus.emit('player:move', { x: 100, direction: 1 });
    cam.update(16);

    // goalX = 100 + 1*80 = 180
    expect(cam.getPosition().x).toBe(180);
  });

  it('should apply look-ahead in negative direction', () => {
    const { engine, cam } = setup({
      mode: 'look-ahead',
      smoothing: 0,
      lookAheadDistance: 80,
    });

    engine.eventBus.emit('player:move', { x: 100, direction: -1 });
    cam.update(16);

    // goalX = 100 + (-1)*80 = 20
    expect(cam.getPosition().x).toBe(20);
  });

  it('should reset all state', () => {
    const { engine, cam } = setup({ shakeEvent: 'hit', smoothing: 0 });

    engine.eventBus.emit('player:move', { x: 500, y: 300, direction: 1 });
    cam.update(16);
    engine.eventBus.emit('hit');

    expect(cam.getPosition().x).toBe(500);
    expect(cam.isShaking()).toBe(true);

    cam.reset();

    expect(cam.getPosition()).toEqual({ x: 0, y: 0 });
    expect(cam.isShaking()).toBe(false);
    expect(cam.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });
});
