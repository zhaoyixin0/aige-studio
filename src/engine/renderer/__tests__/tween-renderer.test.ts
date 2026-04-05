import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { GameObjectRenderer } from '../game-object-renderer';
import { ShooterRenderer } from '../shooter-renderer';

/**
 * Tests for tween integration in renderers.
 *
 * applyTweenUpdate stores pending offsets (additive x/y, absolute scale/rotation/alpha).
 * clearTweenOffset removes stored offsets.
 * Unknown entityId returns false.
 */

describe('GameObjectRenderer — tween integration', () => {
  let container: Container;
  let renderer: GameObjectRenderer;

  beforeEach(() => {
    container = new Container();
    renderer = new GameObjectRenderer(container);
  });

  describe('applyTweenUpdate', () => {
    it('returns false for unknown entityId (no sprites registered)', () => {
      const result = renderer.applyTweenUpdate('unknown_entity', { x: 10 });
      expect(result).toBe(false);
    });

    it('returns true when sprite exists for entityId', () => {
      // Inject a sprite into the private sprites map
      const sprite = new Container();
      (renderer as any).sprites.set('item_1', sprite);

      const result = renderer.applyTweenUpdate('item_1', { x: 10 });
      expect(result).toBe(true);
    });

    it('returns true for player_1 when playerSprite exists', () => {
      (renderer as any).playerSprite = new Container();

      const result = renderer.applyTweenUpdate('player_1', { alpha: 0.5 });
      expect(result).toBe(true);
    });

    it('stores pending offsets that accumulate across calls', () => {
      const sprite = new Container();
      (renderer as any).sprites.set('item_1', sprite);

      renderer.applyTweenUpdate('item_1', { x: 10 });
      renderer.applyTweenUpdate('item_1', { y: 20 });

      const offsets = (renderer as any).tweenOffsets.get('item_1');
      expect(offsets).toEqual({ x: 10, y: 20 });
    });

    it('overwrites same property on subsequent calls', () => {
      const sprite = new Container();
      (renderer as any).sprites.set('item_1', sprite);

      renderer.applyTweenUpdate('item_1', { x: 10 });
      renderer.applyTweenUpdate('item_1', { x: 30 });

      const offsets = (renderer as any).tweenOffsets.get('item_1');
      expect(offsets.x).toBe(30);
    });
  });

  describe('clearTweenOffset', () => {
    it('removes stored offsets for entityId', () => {
      const sprite = new Container();
      (renderer as any).sprites.set('item_1', sprite);

      renderer.applyTweenUpdate('item_1', { x: 10, y: 20 });
      renderer.clearTweenOffset('item_1');

      expect((renderer as any).tweenOffsets.has('item_1')).toBe(false);
    });

    it('is a no-op for unknown entityId', () => {
      expect(() => renderer.clearTweenOffset('nonexistent')).not.toThrow();
    });
  });
});

describe('ShooterRenderer — tween integration', () => {
  let parent: Container;
  let renderer: ShooterRenderer;

  beforeEach(() => {
    parent = new Container();
    renderer = new ShooterRenderer(parent);
  });

  describe('applyTweenUpdate', () => {
    it('returns false for unknown entityId', () => {
      const result = renderer.applyTweenUpdate('unknown', { x: 5 });
      expect(result).toBe(false);
    });

    it('returns true when enemy sprite exists', () => {
      const sprite = new Container();
      (renderer as any).enemySprites.set('enemy_1', sprite);

      const result = renderer.applyTweenUpdate('enemy_1', { alpha: 0.3 });
      expect(result).toBe(true);
    });

    it('returns true when projectile sprite exists', () => {
      const sprite = new Container();
      (renderer as any).projectileSprites.set('proj_1', sprite);

      const result = renderer.applyTweenUpdate('proj_1', { rotation: 1.5 });
      expect(result).toBe(true);
    });

    it('stores pending offsets', () => {
      const sprite = new Container();
      (renderer as any).enemySprites.set('enemy_1', sprite);

      renderer.applyTweenUpdate('enemy_1', { scaleX: 1.5, scaleY: 1.5 });

      const offsets = (renderer as any).tweenOffsets.get('enemy_1');
      expect(offsets).toEqual({ scaleX: 1.5, scaleY: 1.5 });
    });
  });

  describe('clearTweenOffset', () => {
    it('removes stored offsets', () => {
      const sprite = new Container();
      (renderer as any).enemySprites.set('enemy_1', sprite);

      renderer.applyTweenUpdate('enemy_1', { alpha: 0 });
      renderer.clearTweenOffset('enemy_1');

      expect((renderer as any).tweenOffsets.has('enemy_1')).toBe(false);
    });
  });
});
