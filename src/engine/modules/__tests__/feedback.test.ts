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
});
