import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { GestureMatch } from '../mechanic/gesture-match';

describe('GestureMatch', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const gm = new GestureMatch('gm-1', params);
    engine.addModule(gm);
    engine.eventBus.emit('gameflow:resume');
    return { engine, gm };
  }

  it('should present a target gesture on start', () => {
    const { engine, gm } = setup({
      targetGestures: ['thumbs_up', 'peace'],
    });
    const showHandler = vi.fn();
    engine.eventBus.on('gesture:show', showHandler);

    gm.start();

    expect(showHandler).toHaveBeenCalledOnce();
    expect(gm.getCurrentTarget()).not.toBeNull();
  });

  it('should emit gesture:match when correct gesture detected', () => {
    const { engine, gm } = setup({
      targetGestures: ['thumbs_up'],
      matchThreshold: 0.5,
    });
    const matchHandler = vi.fn();
    engine.eventBus.on('gesture:match', matchHandler);

    gm.start();

    engine.eventBus.emit('input:hand:gesture', {
      gesture: 'thumbs_up',
      confidence: 0.9,
    });

    expect(matchHandler).toHaveBeenCalledWith(
      expect.objectContaining({ gesture: 'thumbs_up' }),
    );
  });

  it('should emit gesture:fail when wrong gesture detected', () => {
    const { engine, gm } = setup({
      targetGestures: ['peace'],
      matchThreshold: 0.5,
    });
    const failHandler = vi.fn();
    engine.eventBus.on('gesture:fail', failHandler);

    gm.start();

    engine.eventBus.emit('input:hand:gesture', {
      gesture: 'fist',
      confidence: 0.9,
    });

    expect(failHandler).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'peace', gesture: 'fist' }),
    );
  });

  it('should emit gesture:fail on display timeout', () => {
    const { engine, gm } = setup({
      targetGestures: ['peace'],
      displayTime: 2, // 2 seconds
    });
    const failHandler = vi.fn();
    engine.eventBus.on('gesture:fail', failHandler);

    gm.start();

    // Advance past display time
    gm.update(2500);

    expect(failHandler).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'timeout' }),
    );
  });
});
