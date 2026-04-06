import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { PhysicsDebugRenderer } from '../physics-debug-renderer';

describe('PhysicsDebugRenderer', () => {
  let parent: Container;
  let renderer: PhysicsDebugRenderer;

  beforeEach(() => {
    parent = new Container();
    renderer = new PhysicsDebugRenderer(parent);
  });

  describe('toggle', () => {
    it('starts hidden', () => {
      expect((renderer as any).enabled).toBe(false);
      expect((renderer as any).g.visible).toBe(false);
    });

    it('toggles on/off', () => {
      renderer.toggle();
      expect((renderer as any).enabled).toBe(true);
      expect((renderer as any).g.visible).toBe(true);

      renderer.toggle();
      expect((renderer as any).enabled).toBe(false);
      expect((renderer as any).g.visible).toBe(false);
    });
  });

  describe('body tracking', () => {
    it('tracks colliders on addBody', () => {
      const colliders = [{ shape: { kind: 'Circle' as const, radius: 20 } }];
      renderer.addBody('ball_1', colliders as any);
      expect((renderer as any).colliderDefs.has('ball_1')).toBe(true);
    });

    it('removes colliders on removeBody', () => {
      renderer.addBody('ball_1', [{ shape: { kind: 'Circle' as const, radius: 20 } }] as any);
      renderer.removeBody('ball_1');
      expect((renderer as any).colliderDefs.has('ball_1')).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all tracked bodies and disables', () => {
      renderer.addBody('ball_1', [{ shape: { kind: 'Circle' as const, radius: 20 } }] as any);
      renderer.toggle(); // enable
      renderer.reset();
      expect((renderer as any).colliderDefs.size).toBe(0);
      expect((renderer as any).enabled).toBe(false);
    });
  });

  describe('destroy', () => {
    it('is callable without error', () => {
      renderer.addBody('ball_1', [{ shape: { kind: 'Circle' as const, radius: 20 } }] as any);
      expect(() => renderer.destroy()).not.toThrow();
    });
  });
});
