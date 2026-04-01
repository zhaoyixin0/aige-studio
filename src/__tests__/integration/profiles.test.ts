import { describe, it, expect } from 'vitest';
import { resolveInputProfile, resolveCollisionRadius } from '@/engine/core/profiles';

// ── InputProfile ───────────────────────────────────────────────

describe('resolveInputProfile', () => {
  // Follow mode games: catch, dodge, tap, shooting, action-rpg
  it('should return follow mode for TouchInput + catch', () => {
    const result = resolveInputProfile('TouchInput', 'catch');
    expect(result.mode).toBe('follow');
    expect(result.continuousEvent).toBe('input:touch:position');
  });

  it('should return follow mode for FaceInput + catch', () => {
    const result = resolveInputProfile('FaceInput', 'catch');
    expect(result.mode).toBe('follow');
    expect(result.continuousEvent).toBe('input:face:move');
  });

  it('should return follow mode for HandInput + dodge', () => {
    const result = resolveInputProfile('HandInput', 'dodge');
    expect(result.mode).toBe('follow');
    expect(result.continuousEvent).toBe('input:hand:move');
  });

  it('should return follow mode for FaceInput + shooting', () => {
    const result = resolveInputProfile('FaceInput', 'shooting');
    expect(result.mode).toBe('follow');
    expect(result.continuousEvent).toBe('input:face:move');
  });

  it('should return follow mode for TouchInput + action-rpg', () => {
    const result = resolveInputProfile('TouchInput', 'action-rpg');
    expect(result.mode).toBe('follow');
    expect(result.continuousEvent).toBe('input:touch:position');
  });

  // Velocity mode games: platformer, runner
  it('should return velocity mode for TouchInput + platformer', () => {
    const result = resolveInputProfile('TouchInput', 'platformer');
    expect(result.mode).toBe('velocity');
    // Platformer uses hold-based left/right, no continuousEvent needed
    expect(result.continuousEvent).toBeUndefined();
  });

  it('should return velocity mode for TouchInput + runner', () => {
    const result = resolveInputProfile('TouchInput', 'runner');
    expect(result.mode).toBe('velocity');
  });

  // Default case: unknown game type
  it('should return follow mode as default for unknown game type', () => {
    const result = resolveInputProfile('TouchInput', 'unknown-type');
    expect(result.mode).toBe('follow');
  });

  // defaultY should be set for catch/dodge/tap/shooting (bottom area)
  it('should set defaultY for catch games', () => {
    const result = resolveInputProfile('TouchInput', 'catch');
    expect(result.defaultY).toBeDefined();
    expect(result.defaultY!).toBeGreaterThanOrEqual(0.7);
  });

  it('should set defaultY for shooting games', () => {
    const result = resolveInputProfile('TouchInput', 'shooting');
    expect(result.defaultY).toBeDefined();
    expect(result.defaultY!).toBeGreaterThanOrEqual(0.7);
  });
});

// ── CollisionProfile ───────────────────────────────────────────

describe('resolveCollisionRadius', () => {
  it('should return generous radius for catch game (0.6-0.75)', () => {
    const radius = resolveCollisionRadius('catch', 'items');
    expect(radius).toBeGreaterThanOrEqual(0.6);
    expect(radius).toBeLessThanOrEqual(0.75);
  });

  it('should return generous radius for catch player layer', () => {
    const radius = resolveCollisionRadius('catch', 'player');
    expect(radius).toBeGreaterThanOrEqual(0.6);
    expect(radius).toBeLessThanOrEqual(0.75);
  });

  it('should return tight radius for dodge game (0.35-0.45)', () => {
    const radius = resolveCollisionRadius('dodge', 'items');
    expect(radius).toBeGreaterThanOrEqual(0.35);
    expect(radius).toBeLessThanOrEqual(0.45);
  });

  it('should return medium radius for shooting (0.45-0.55)', () => {
    const radius = resolveCollisionRadius('shooting', 'enemies');
    expect(radius).toBeGreaterThanOrEqual(0.45);
    expect(radius).toBeLessThanOrEqual(0.55);
  });

  it('should return medium radius for tap game', () => {
    const radius = resolveCollisionRadius('tap', 'items');
    expect(radius).toBeGreaterThanOrEqual(0.45);
    expect(radius).toBeLessThanOrEqual(0.55);
  });

  it('should return standard 0.5 for unknown game types', () => {
    const radius = resolveCollisionRadius('unknown', 'items');
    expect(radius).toBe(0.5);
  });

  it('should return standard 0.5 for platformer collectibles', () => {
    const radius = resolveCollisionRadius('platformer', 'collectibles');
    expect(radius).toBe(0.5);
  });
});
