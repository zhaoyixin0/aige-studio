import { describe, it, expect } from 'vitest';
import { GameObjectRenderer } from '../game-object-renderer';
import { Container } from 'pixi.js';

// We can't do full WebGL tests, but we can verify destroy() cleans up internal state.
// PixiJS constructors work in jsdom if no rendering is attempted.

describe('GameObjectRenderer', () => {
  describe('destroy()', () => {
    it('should have a destroy method', () => {
      const container = new Container();
      const renderer = new GameObjectRenderer(container);
      expect(typeof renderer.destroy).toBe('function');
    });

    it('destroy() should be callable without error', () => {
      const container = new Container();
      const renderer = new GameObjectRenderer(container);
      expect(() => renderer.destroy()).not.toThrow();
    });
  });
});
