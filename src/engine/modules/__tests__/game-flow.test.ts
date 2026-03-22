import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { GameFlow } from '../feedback/game-flow';

describe('GameFlow', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const gameFlow = new GameFlow('gameflow-1', params);
    engine.addModule(gameFlow);
    return { engine, gameFlow };
  }

  it('should start in ready state', () => {
    const { gameFlow } = setup();
    expect(gameFlow.getState()).toBe('ready');
  });

  it('should transition through states and emit gameflow:state', () => {
    const { engine, gameFlow } = setup({ countdown: 0 });
    const stateHandler = vi.fn();
    engine.eventBus.on('gameflow:state', stateHandler);

    // ready -> countdown (but countdown=0, so should skip to playing)
    gameFlow.transition('countdown');
    expect(gameFlow.getState()).toBe('playing');

    // Verify we got state events
    expect(stateHandler).toHaveBeenCalled();
    // Should have emitted for countdown transition, then auto-skip to playing
    const calls = stateHandler.mock.calls;
    // The last call should be the transition to 'playing'
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall).toEqual(
      expect.objectContaining({ state: 'playing', previous: 'countdown' }),
    );
  });

  it('should transition to finished on timer:end', () => {
    const { engine, gameFlow } = setup({ countdown: 0 });
    const stateHandler = vi.fn();
    engine.eventBus.on('gameflow:state', stateHandler);

    // Move to playing first
    gameFlow.transition('countdown'); // skips to playing since countdown=0

    // Now emit timer:end
    engine.eventBus.emit('timer:end');

    expect(gameFlow.getState()).toBe('finished');
  });

  it('should transition to finished on lives:zero', () => {
    const { engine, gameFlow } = setup({ countdown: 0 });

    // Move to playing first
    gameFlow.transition('countdown'); // skips to playing since countdown=0

    // Now emit lives:zero
    engine.eventBus.emit('lives:zero');

    expect(gameFlow.getState()).toBe('finished');
  });
});
