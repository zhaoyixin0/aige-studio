import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TweenSystem } from '../tween-system';
import type { TweenClip } from '../types';

describe('TweenSystem', () => {
  let system: TweenSystem;
  let onEvent: (event: string, data: Record<string, unknown>) => void;
  let onEventSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onEventSpy = vi.fn();
    onEvent = onEventSpy as (event: string, data: Record<string, unknown>) => void;
    system = new TweenSystem(onEvent);
  });

  const simpleClip: TweenClip = {
    id: 'test',
    duration: 1,
    tracks: [{ property: 'x', from: 0, to: 100, easing: 'Linear' }],
  };

  it('creates and plays a tween', () => {
    system.start(simpleClip, 'entity_1');
    const values = system.update(0.5);
    expect(values).toHaveLength(1);
    expect(values[0].entityId).toBe('entity_1');
    expect(values[0].properties.x).toBeCloseTo(50, 1);
  });

  it('completes a tween and emits tween:complete', () => {
    system.start(simpleClip, 'entity_1');
    system.update(1.0);
    expect(onEventSpy).toHaveBeenCalledWith('tween:complete', {
      entityId: 'entity_1',
      clipId: 'test',
    });
  });

  it('removes completed tweens from active list', () => {
    system.start(simpleClip, 'entity_1');
    system.update(1.0);
    const values = system.update(0.1);
    expect(values).toHaveLength(0);
  });

  it('handles delay before playing', () => {
    const delayedClip: TweenClip = { ...simpleClip, delay: 0.5 };
    system.start(delayedClip, 'entity_1');

    // During delay, no property changes
    const v1 = system.update(0.3);
    expect(v1).toHaveLength(0);

    // After delay, starts playing
    const v2 = system.update(0.3); // 0.1s into play (0.3 - 0.2 remaining delay)
    expect(v2).toHaveLength(1);
    expect(v2[0].properties.x).toBeGreaterThan(0);
  });

  it('respects timeScale', () => {
    const fastClip: TweenClip = { ...simpleClip, timeScale: 2 };
    system.start(fastClip, 'entity_1');
    const values = system.update(0.25); // 0.25 * 2 = 0.5 effective
    expect(values[0].properties.x).toBeCloseTo(50, 1);
  });

  it('loops a finite number of times', () => {
    const loopClip: TweenClip = { ...simpleClip, loop: 2, duration: 0.5 };
    system.start(loopClip, 'entity_1');

    // First loop
    system.update(0.5);
    expect(onEventSpy).not.toHaveBeenCalledWith('tween:complete', expect.anything());

    // Second loop
    system.update(0.5);
    expect(onEventSpy).toHaveBeenCalledWith('tween:complete', {
      entityId: 'entity_1',
      clipId: 'test',
    });
  });

  it('loops infinitely', () => {
    const infiniteClip: TweenClip = { ...simpleClip, loop: 'infinite', duration: 0.5 };
    system.start(infiniteClip, 'entity_1');

    // Run 10 full cycles — should still be active
    for (let i = 0; i < 10; i++) {
      system.update(0.5);
    }
    expect(onEventSpy).not.toHaveBeenCalledWith('tween:complete', expect.anything());
    expect(system.getActiveCount()).toBe(1);
  });

  it('pingPong reverses direction', () => {
    const ppClip: TweenClip = {
      ...simpleClip,
      duration: 1,
      pingPong: true,
      loop: 2,
    };
    system.start(ppClip, 'entity_1');

    // Forward to end
    const v1 = system.update(1.0);
    expect(v1[0].properties.x).toBeCloseTo(100, 1);

    // Reverse back
    const v2 = system.update(1.0);
    expect(v2[0].properties.x).toBeCloseTo(0, 1);
  });

  it('handles multiple concurrent tweens', () => {
    system.start(simpleClip, 'entity_1');
    system.start(
      { ...simpleClip, id: 'other', tracks: [{ property: 'y', from: 0, to: 200, easing: 'Linear' }] },
      'entity_2',
    );
    const values = system.update(0.5);
    expect(values).toHaveLength(2);
  });

  it('handles multiple tracks in one clip', () => {
    const multiTrack: TweenClip = {
      id: 'multi',
      duration: 1,
      tracks: [
        { property: 'x', from: 0, to: 100, easing: 'Linear' },
        { property: 'alpha', from: 1, to: 0, easing: 'Linear' },
      ],
    };
    system.start(multiTrack, 'entity_1');
    const values = system.update(0.5);
    expect(values[0].properties.x).toBeCloseTo(50, 1);
    expect(values[0].properties.alpha).toBeCloseTo(0.5, 1);
  });

  it('stop() removes a specific tween', () => {
    system.start(simpleClip, 'entity_1');
    system.stop('entity_1', 'test');
    const values = system.update(0.5);
    expect(values).toHaveLength(0);
  });

  it('stopAll() clears all tweens for an entity', () => {
    system.start(simpleClip, 'entity_1');
    system.start({ ...simpleClip, id: 'other' }, 'entity_1');
    system.stopAll('entity_1');
    expect(system.getActiveCount()).toBe(0);
  });

  it('clear() removes all tweens', () => {
    system.start(simpleClip, 'entity_1');
    system.start(simpleClip, 'entity_2');
    system.clear();
    expect(system.getActiveCount()).toBe(0);
  });

  it('emits tween:start when tween begins playing', () => {
    system.start(simpleClip, 'entity_1');
    expect(onEventSpy).toHaveBeenCalledWith('tween:start', {
      entityId: 'entity_1',
      clipId: 'test',
    });
  });

  it('emits onComplete.eventName when clip specifies it', () => {
    const clip: TweenClip = {
      ...simpleClip,
      onComplete: { eventName: 'spawner:destroyed' },
    };
    system.start(clip, 'entity_1');
    system.update(1.0);
    expect(onEventSpy).toHaveBeenCalledWith('spawner:destroyed', {
      entityId: 'entity_1',
    });
  });

  it('does nothing when update is called with no active tweens', () => {
    const values = system.update(0.1);
    expect(values).toHaveLength(0);
  });

  it('getActiveCount returns current active tween count', () => {
    expect(system.getActiveCount()).toBe(0);
    system.start(simpleClip, 'e1');
    expect(system.getActiveCount()).toBe(1);
    system.start({ ...simpleClip, id: 'b' }, 'e2');
    expect(system.getActiveCount()).toBe(2);
  });

  it('samples bezierPath when track has one', () => {
    const bezierClip: TweenClip = {
      id: 'path',
      duration: 1,
      tracks: [{
        property: 'x',
        from: 0,
        to: 100,
        easing: 'Linear',
        bezierPath: { points: [[0, 0], [50, -100], [100, 0]] },
      }],
    };
    system.start(bezierClip, 'entity_1');
    const values = system.update(0.5);
    expect(values).toHaveLength(1);
    // Bezier path sets x and y directly
    expect(values[0].properties.x).toBeDefined();
    expect(values[0].properties.y).toBeDefined();
    // At t=0.5 on quadratic bezier [[0,0],[50,-100],[100,0]], y < 0
    expect(values[0].properties.y!).toBeLessThan(0);
  });
});
