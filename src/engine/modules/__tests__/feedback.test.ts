import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core';
import { ParticleVFX } from '../feedback/particle-vfx';
import { SoundFX } from '../feedback/sound-fx';
import { UIOverlay } from '../feedback/ui-overlay';
import { ResultScreen } from '../feedback/result-screen';

describe('ParticleVFX', () => {
  it('should create a particle when configured event fires', () => {
    const engine = new Engine();
    const vfx = new ParticleVFX('vfx-1', {
      events: {
        'collision:hit': {
          effect: 'sparkle',
          at: 'target',
          duration: 500,
          color: '#ff0',
        },
      },
    });
    engine.addModule(vfx);

    engine.eventBus.emit('collision:hit');

    const particles = vfx.getActiveParticles();
    expect(particles.length).toBeGreaterThanOrEqual(1);
    expect(particles[0]).toMatchObject({
      effect: 'sparkle',
      at: 'target',
      color: '#ff0',
    });
  });
});

describe('SoundFX', () => {
  it('should queue configured sound when event fires', () => {
    const engine = new Engine();
    const sfx = new SoundFX('sfx-1', {
      events: {
        'collision:hit': 'hit_sound_01',
      },
    });
    engine.addModule(sfx);

    engine.eventBus.emit('collision:hit');

    const queue = sfx.getSoundQueue();
    expect(queue).toContain('hit_sound_01');
  });
});

describe('UIOverlay', () => {
  it('should update HUD score when scorer:update is emitted', () => {
    const engine = new Engine();
    const overlay = new UIOverlay('overlay-1');
    engine.addModule(overlay);

    engine.eventBus.emit('scorer:update', { score: 42, delta: 10, combo: 1 });

    const hud = overlay.getHudState();
    expect(hud.score).toBe(42);
  });

  it('update() does not advance combo fade timer when gameflowPaused', () => {
    const engine = new Engine();
    const overlay = new UIOverlay('overlay-1');
    engine.addModule(overlay);

    // Resume so the combo event listener fires, then pause again
    engine.eventBus.emit('gameflow:resume');
    engine.eventBus.emit('scorer:combo:3', { combo: 3 });

    const beforeUpdate = overlay.getHudState().combo.fadeTimer;
    expect(beforeUpdate).toBeGreaterThan(0);

    // Pause the game flow
    engine.eventBus.emit('gameflow:pause');

    // Call update — timer must not advance while paused
    overlay.update(500);

    const afterUpdate = overlay.getHudState().combo.fadeTimer;
    expect(afterUpdate).toBe(beforeUpdate);
  });
});

describe('ResultScreen', () => {
  it('should become visible when game finishes', () => {
    const engine = new Engine();
    const result = new ResultScreen('result-1', {
      show: ['score'],
      rating: { '3star': 500, '2star': 300, '1star': 100 },
      actions: ['retry', 'share'],
    });
    engine.addModule(result);

    engine.eventBus.emit('gameflow:state', { state: 'finished' });

    expect(result.isVisible()).toBe(true);
  });

  it('getSchema() should include showAnimation with default true', () => {
    const result = new ResultScreen('result-schema-1', {});
    const schema = result.getSchema();

    expect(schema.showAnimation).toBeDefined();
    expect(schema.showAnimation.type).toBe('toggle');
    expect(schema.showAnimation.default).toBe(true);
  });

  it('getSchema() should include showText with default true', () => {
    const result = new ResultScreen('result-schema-2', {});
    const schema = result.getSchema();

    expect(schema.showText).toBeDefined();
    expect(schema.showText.type).toBe('toggle');
    expect(schema.showText.default).toBe(true);
  });
});
