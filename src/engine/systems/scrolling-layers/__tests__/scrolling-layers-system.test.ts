import { describe, it, expect, beforeEach } from 'vitest';
import { ScrollingLayersSystem } from '../scrolling-layers-system';
import type { ScrollingLayersConfig } from '../types';

describe('ScrollingLayersSystem', () => {
  let system: ScrollingLayersSystem;

  const config: ScrollingLayersConfig = {
    axis: 'horizontal',
    baseSpeed: 200,
    direction: -1,
    loop: true,
    viewWidth: 1080,
    viewHeight: 1920,
    layers: [
      { textureId: 'bg_far', ratio: 0.3 },
      { textureId: 'bg_mid', ratio: 0.6 },
      { textureId: 'bg_near', ratio: 1.0 },
    ],
  };

  beforeEach(() => {
    system = new ScrollingLayersSystem(config);
  });

  it('initializes with correct number of layers', () => {
    expect(system.getLayerStates()).toHaveLength(3);
  });

  it('each layer starts at position 0', () => {
    for (const layer of system.getLayerStates()) {
      expect(layer.offsetX).toBe(0);
      expect(layer.offsetY).toBe(0);
    }
  });

  it('horizontal scroll moves layers at different speeds', () => {
    system.update(1); // 1 second
    const states = system.getLayerStates();

    // direction=-1, baseSpeed=200, horizontal
    // bg_far: -200 * 0.3 = -60
    expect(states[0].offsetX).toBeCloseTo(-60, 0);
    // bg_mid: -200 * 0.6 = -120
    expect(states[1].offsetX).toBeCloseTo(-120, 0);
    // bg_near: -200 * 1.0 = -200
    expect(states[2].offsetX).toBeCloseTo(-200, 0);

    // Y unchanged for horizontal
    for (const s of states) {
      expect(s.offsetY).toBe(0);
    }
  });

  it('vertical scroll moves Y axis', () => {
    const vertSystem = new ScrollingLayersSystem({
      ...config,
      axis: 'vertical',
      direction: 1,
    });
    vertSystem.update(0.5);
    const states = vertSystem.getLayerStates();

    // direction=1, baseSpeed=200, vertical, 0.5s
    // bg_far: 200 * 0.3 * 0.5 = 30
    expect(states[0].offsetY).toBeCloseTo(30, 0);
    expect(states[0].offsetX).toBe(0);
  });

  it('both axis scrolls X and Y', () => {
    const bothSystem = new ScrollingLayersSystem({
      ...config,
      axis: 'both',
      direction: -1,
    });
    bothSystem.update(1);
    const states = bothSystem.getLayerStates();
    expect(states[2].offsetX).toBeCloseTo(-200, 0);
    expect(states[2].offsetY).toBeCloseTo(-200, 0);
  });

  it('loops back when offset exceeds view width', () => {
    // bg_near at ratio 1.0, speed 200, direction -1
    // After 6s: offset = -1200, viewWidth=1080 → should wrap
    system.update(6);
    const states = system.getLayerStates();
    const near = states[2];
    // After wrapping, offset should be within [-viewWidth, 0]
    expect(near.offsetX).toBeGreaterThanOrEqual(-1080);
    expect(near.offsetX).toBeLessThan(0);
  });

  it('does not loop when loop=false', () => {
    const noLoopSystem = new ScrollingLayersSystem({
      ...config,
      loop: false,
    });
    noLoopSystem.update(6);
    const states = noLoopSystem.getLayerStates();
    // Should just keep going, not wrap
    expect(states[2].offsetX).toBeCloseTo(-1200, 0);
  });

  it('setSpeed changes base speed at runtime', () => {
    system.setSpeed(400);
    system.update(1);
    const states = system.getLayerStates();
    // bg_near: -400 * 1.0 = -400
    expect(states[2].offsetX).toBeCloseTo(-400, 0);
  });

  it('setDirection reverses scroll direction', () => {
    system.setDirection(1);
    system.update(1);
    const states = system.getLayerStates();
    // direction=1, so positive offset
    expect(states[2].offsetX).toBeCloseTo(200, 0);
  });

  it('pause and resume', () => {
    system.setPaused(true);
    system.update(1);
    const states = system.getLayerStates();
    expect(states[2].offsetX).toBe(0);

    system.setPaused(false);
    system.update(0.5);
    expect(system.getLayerStates()[2].offsetX).toBeCloseTo(-100, 0);
  });

  it('getLayerStates returns readonly snapshots', () => {
    const states = system.getLayerStates();
    expect(states[0].textureId).toBe('bg_far');
    expect(states[0].ratio).toBe(0.3);
  });

  it('handles empty layers array', () => {
    const empty = new ScrollingLayersSystem({ ...config, layers: [] });
    empty.update(1);
    expect(empty.getLayerStates()).toHaveLength(0);
  });

  it('handles single layer', () => {
    const single = new ScrollingLayersSystem({
      ...config,
      layers: [{ textureId: 'solo', ratio: 1 }],
    });
    single.update(1);
    expect(single.getLayerStates()).toHaveLength(1);
    expect(single.getLayerStates()[0].offsetX).toBeCloseTo(-200, 0);
  });
});
