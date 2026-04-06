import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { GameObjectRenderer } from '../game-object-renderer';

/**
 * Tests for Physics2D position sync in GameObjectRenderer.
 * When Physics2D module is present, sprite positions should be overridden
 * by physics body positions (before tween offsets are applied).
 */

describe('GameObjectRenderer — Physics2D sync', () => {
  let container: Container;
  let renderer: GameObjectRenderer;

  beforeEach(() => {
    container = new Container();
    renderer = new GameObjectRenderer(container);
  });

  it('overrides sprite position from Physics2D body when present', () => {
    // Set up a sprite at base position
    const sprite = new Container();
    sprite.x = 100;
    sprite.y = 200;
    (renderer as any).sprites.set('item_1', sprite);

    // Simulate Physics2D position override
    renderer.applyPhysicsPosition('item_1', 300, 400);

    const pos = (renderer as any).physicsPositions.get('item_1');
    expect(pos).toEqual({ x: 300, y: 400 });
  });

  it('returns false for unknown entityId', () => {
    const result = renderer.applyPhysicsPosition('nonexistent', 10, 20);
    expect(result).toBe(false);
  });

  it('returns true when sprite exists', () => {
    const sprite = new Container();
    (renderer as any).sprites.set('item_1', sprite);
    const result = renderer.applyPhysicsPosition('item_1', 10, 20);
    expect(result).toBe(true);
  });

  it('clearPhysicsPosition removes stored position', () => {
    const sprite = new Container();
    (renderer as any).sprites.set('item_1', sprite);
    renderer.applyPhysicsPosition('item_1', 10, 20);
    renderer.clearPhysicsPosition('item_1');
    expect((renderer as any).physicsPositions.has('item_1')).toBe(false);
  });

  it('physics positions cleared on reset', () => {
    const sprite = new Container();
    (renderer as any).sprites.set('item_1', sprite);
    renderer.applyPhysicsPosition('item_1', 10, 20);
    renderer.reset();
    expect((renderer as any).physicsPositions.size).toBe(0);
  });
});
