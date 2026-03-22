import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { PlaneDetection } from '../mechanic/plane-detection';

describe('PlaneDetection', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const pd = new PlaneDetection('pd-1', params);
    engine.addModule(pd);
    return { engine, pd };
  }

  it('should detect plane from camera:frame with sufficient brightness', () => {
    const { engine, pd } = setup({ enabled: true, sensitivity: 0.5 });
    const handler = vi.fn();
    engine.eventBus.on('plane:detected', handler);

    engine.eventBus.emit('camera:frame', {
      brightness: 0.8,
      x: 0.1,
      y: 0.2,
      width: 0.5,
      height: 0.3,
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0.1, y: 0.2, width: 0.5, height: 0.3 }),
    );
    expect(pd.getPlanes()).toHaveLength(1);
  });

  it('should not detect when disabled', () => {
    const { engine, pd } = setup({ enabled: false });
    const handler = vi.fn();
    engine.eventBus.on('plane:detected', handler);

    engine.eventBus.emit('camera:frame', { brightness: 1.0 });

    expect(handler).not.toHaveBeenCalled();
    expect(pd.getPlanes()).toHaveLength(0);
  });

  it('should clear planes on clearPlanes()', () => {
    const { engine, pd } = setup({ enabled: true, sensitivity: 0.8 });

    engine.eventBus.emit('camera:frame', { brightness: 0.5, x: 0, y: 0, width: 1, height: 1 });
    expect(pd.getPlanes().length).toBeGreaterThan(0);

    pd.clearPlanes();
    expect(pd.getPlanes()).toHaveLength(0);
  });
});
