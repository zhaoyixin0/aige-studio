import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { ParallaxRenderer } from '../parallax-renderer';
import type { LayerState } from '@/engine/systems/scrolling-layers/types';

describe('ParallaxRenderer', () => {
  let parent: Container;
  let renderer: ParallaxRenderer;

  beforeEach(() => {
    parent = new Container();
    renderer = new ParallaxRenderer(parent, 1080, 1920);
  });

  it('adds container to parent on construction', () => {
    expect(parent.children.length).toBe(1);
  });

  describe('updateFromStates', () => {
    it('creates sprites for each layer state', () => {
      const states: LayerState[] = [
        { textureId: 'bg_far', ratio: 0.2, offsetX: 0, offsetY: 0 },
        { textureId: 'bg_mid', ratio: 0.5, offsetX: 10, offsetY: 0 },
      ];
      renderer.updateFromStates(states, {});

      expect((renderer as any).layerSprites.size).toBe(2);
    });

    it('reuses existing sprites on subsequent calls', () => {
      const states: LayerState[] = [
        { textureId: 'bg_far', ratio: 0.2, offsetX: 0, offsetY: 0 },
      ];
      renderer.updateFromStates(states, {});
      const sprite1 = (renderer as any).layerSprites.get('bg_far');

      renderer.updateFromStates(states, {});
      const sprite2 = (renderer as any).layerSprites.get('bg_far');

      expect(sprite1).toBe(sprite2);
    });

    it('hides sprites no longer in states', () => {
      renderer.updateFromStates(
        [{ textureId: 'bg_far', ratio: 0.2, offsetX: 0, offsetY: 0 }],
        {},
      );
      renderer.updateFromStates([], {});

      const sprite = (renderer as any).layerSprites.get('bg_far');
      expect(sprite.visible).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all sprites', () => {
      renderer.updateFromStates(
        [{ textureId: 'bg_far', ratio: 0.2, offsetX: 0, offsetY: 0 }],
        {},
      );
      renderer.reset();

      expect((renderer as any).layerSprites.size).toBe(0);
    });
  });

  describe('destroy', () => {
    it('is callable without error', () => {
      renderer.updateFromStates(
        [{ textureId: 'bg_far', ratio: 0.2, offsetX: 0, offsetY: 0 }],
        {},
      );
      expect(() => renderer.destroy()).not.toThrow();
    });
  });

  describe('resize', () => {
    it('updates view dimensions', () => {
      renderer.resize(720, 1280);
      expect((renderer as any).viewW).toBe(720);
      expect((renderer as any).viewH).toBe(1280);
    });
  });
});
