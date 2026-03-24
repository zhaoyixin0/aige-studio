import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { ExpressionDetector } from '../mechanic/expression-detector';

describe('ExpressionDetector', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const detector = new ExpressionDetector('expr-1', params);
    engine.addModule(detector);
    engine.eventBus.emit('gameflow:resume');
    return { engine, detector };
  }

  it('should emit expression:detected when confidence exceeds threshold', () => {
    const { engine } = setup({ expressionType: 'smile', threshold: 0.5 });
    const handler = vi.fn();
    engine.eventBus.on('expression:detected', handler);

    engine.eventBus.emit('input:face:smile', { value: 0.8 });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ expression: 'smile', confidence: 0.8 }),
    );
  });

  it('should not emit when confidence is below threshold', () => {
    const { engine } = setup({ expressionType: 'smile', threshold: 0.9 });
    const handler = vi.fn();
    engine.eventBus.on('expression:detected', handler);

    engine.eventBus.emit('input:face:smile', { value: 0.5 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should respect cooldown period', () => {
    const { engine } = setup({
      expressionType: 'smile',
      threshold: 0.5,
      cooldown: 10000,
    });
    const handler = vi.fn();
    engine.eventBus.on('expression:detected', handler);

    engine.eventBus.emit('input:face:smile', { value: 0.8 });
    engine.eventBus.emit('input:face:smile', { value: 0.9 });

    // Second call within cooldown should be ignored
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should detect open-mouth expression', () => {
    const { engine } = setup({ expressionType: 'open-mouth', threshold: 0.6 });
    const handler = vi.fn();
    engine.eventBus.on('expression:detected', handler);

    engine.eventBus.emit('input:face:mouthOpen', { value: 0.9 });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ expression: 'open-mouth', confidence: 0.9 }),
    );
  });
});
