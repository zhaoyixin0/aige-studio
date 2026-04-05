import { describe, it, expect } from 'vitest';
import type {
  TweenTrack,
  TweenClip,
  TweenSnapshot,
  TweenState,
} from '../types';

describe('Tween Types', () => {
  it('TweenTrack can describe a property animation', () => {
    const track: TweenTrack = {
      property: 'y',
      from: 0,
      to: 100,
      easing: 'SineInOut',
    };
    expect(track.property).toBe('y');
    expect(track.from).toBe(0);
    expect(track.to).toBe(100);
    expect(track.easing).toBe('SineInOut');
  });

  it('TweenClip groups tracks with timing', () => {
    const clip: TweenClip = {
      id: 'bounce',
      duration: 0.5,
      loop: 3,
      pingPong: true,
      delay: 0.2,
      timeScale: 1.5,
      tracks: [
        { property: 'scaleX', from: 1, to: 1.5, easing: 'BounceOut' },
        { property: 'scaleY', from: 1, to: 0.8, easing: 'BounceOut' },
      ],
    };
    expect(clip.id).toBe('bounce');
    expect(clip.duration).toBe(0.5);
    expect(clip.loop).toBe(3);
    expect(clip.pingPong).toBe(true);
    expect(clip.delay).toBe(0.2);
    expect(clip.timeScale).toBe(1.5);
    expect(clip.tracks).toHaveLength(2);
  });

  it('TweenClip supports infinite loop', () => {
    const clip: TweenClip = {
      id: 'pulse',
      duration: 1,
      loop: 'infinite',
      tracks: [{ property: 'alpha', from: 0.5, to: 1, easing: 'SineInOut' }],
    };
    expect(clip.loop).toBe('infinite');
  });

  it('TweenClip supports onComplete event and startOnCollision', () => {
    const clip: TweenClip = {
      id: 'hit-flash',
      duration: 0.2,
      tracks: [{ property: 'alpha', from: 1, to: 0, easing: 'Linear' }],
      onComplete: { eventName: 'spawner:destroyed' },
      startOnCollision: { withTag: 'projectile' },
    };
    expect(clip.onComplete?.eventName).toBe('spawner:destroyed');
    expect(clip.startOnCollision?.withTag).toBe('projectile');
  });

  it('TweenSnapshot provides readonly runtime state', () => {
    const snapshot: TweenSnapshot = {
      clipId: 'bounce',
      entityId: 'enemy_1',
      elapsed: 0.3,
      state: 'playing',
    };
    expect(snapshot.state).toBe('playing');
    expect(snapshot.clipId).toBe('bounce');
  });

  it('TweenState type covers all states', () => {
    const states: TweenState[] = ['delayed', 'playing', 'completed'];
    expect(states).toHaveLength(3);
  });

  it('TweenTrack supports bezierPath', () => {
    const track: TweenTrack = {
      property: 'x',
      from: 0,
      to: 100,
      easing: 'Linear',
      bezierPath: {
        points: [[0, 0], [50, -100], [100, 0]],
      },
    };
    expect(track.bezierPath?.points).toHaveLength(3);
  });
});
