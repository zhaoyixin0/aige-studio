import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { TouchInput } from '../input/touch-input';

describe('TouchInput', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const touch = new TouchInput('touch-1', params);
    engine.addModule(touch);
    return { engine, touch };
  }

  it('should have correct module type', () => {
    const { touch } = setup();
    expect(touch.type).toBe('TouchInput');
  });

  it('should expose the expected schema fields', () => {
    const { touch } = setup();
    const schema = touch.getSchema();
    expect(schema).toHaveProperty('gesture');
    expect(schema).toHaveProperty('action');
    expect(schema).toHaveProperty('area');
    expect(schema.gesture.type).toBe('select');
    expect(schema.gesture.options).toContain('tap');
    expect(schema.gesture.options).toContain('swipe');
    expect(schema.gesture.options).toContain('longPress');
    expect(schema.gesture.options).toContain('doubleTap');
  });

  it('should use default params from schema', () => {
    const { touch } = setup();
    const params = touch.getParams();
    expect(params.gesture).toBe('tap');
    expect(params.action).toBe('');
  });

  it('should emit tap event on quick pointerdown + pointerup', () => {
    const { engine, touch } = setup();
    const handler = vi.fn();
    engine.eventBus.on('input:touch:tap', handler);

    // Create a mock canvas element
    const canvas = document.createElement('div');
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => '',
    });
    touch.setCanvas(canvas);

    // Simulate quick tap
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 50, clientY: 50 }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 50, clientY: 50 }),
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ x: 50, y: 50 }),
    );
  });

  it('should clean up event listeners on destroy', () => {
    const { touch } = setup();

    const canvas = document.createElement('div');
    const removeSpy = vi.spyOn(canvas, 'removeEventListener');
    touch.setCanvas(canvas);
    touch.destroy();

    // Should have removed all three pointer event listeners
    const removedEvents = removeSpy.mock.calls.map((c) => c[0]);
    expect(removedEvents).toContain('pointerdown');
    expect(removedEvents).toContain('pointermove');
    expect(removedEvents).toContain('pointerup');
  });
});
