import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { BranchStateMachine } from '../mechanic/branch-state-machine';

describe('BranchStateMachine', () => {
  const sampleStates = {
    start: {
      text: 'Welcome! Choose a path.',
      choices: [
        { label: 'Go left', target: 'left' },
        { label: 'Go right', target: 'right' },
      ],
    },
    left: {
      text: 'You went left. Dead end.',
      choices: [],
    },
    right: {
      text: 'You went right. Continue?',
      choices: [{ label: 'Yes', target: 'finish' }],
    },
    finish: {
      text: 'The end!',
      choices: [],
    },
  };

  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const bsm = new BranchStateMachine('bsm-1', {
      states: sampleStates,
      startState: 'start',
      ...params,
    });
    engine.addModule(bsm);
    return { engine, bsm };
  }

  it('should start at the configured start state', () => {
    const { engine, bsm } = setup();
    const stateHandler = vi.fn();
    engine.eventBus.on('branch:stateChange', stateHandler);

    bsm.start();

    expect(bsm.getCurrentState()).toBe('start');
    expect(stateHandler).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'start', text: 'Welcome! Choose a path.' }),
    );
  });

  it('should transition on choose()', () => {
    const { engine, bsm } = setup();
    const choiceHandler = vi.fn();
    engine.eventBus.on('branch:choice', choiceHandler);

    bsm.start();
    bsm.choose(1); // Go right

    expect(bsm.getCurrentState()).toBe('right');
    expect(choiceHandler).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Go right', target: 'right' }),
    );
  });

  it('should emit branch:end when reaching a terminal state', () => {
    const { engine, bsm } = setup();
    const endHandler = vi.fn();
    engine.eventBus.on('branch:end', endHandler);

    bsm.start();
    bsm.choose(0); // Go left — dead end

    expect(endHandler).toHaveBeenCalledWith(
      expect.objectContaining({ stateId: 'left' }),
    );
    expect(bsm.isStarted()).toBe(false);
  });

  it('should emit branch:end for unknown state', () => {
    const { engine, bsm } = setup({ states: {}, startState: 'missing' });
    const endHandler = vi.fn();
    engine.eventBus.on('branch:end', endHandler);

    bsm.start();

    expect(endHandler).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'state_not_found' }),
    );
  });
});
