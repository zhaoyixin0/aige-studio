import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { DialogueSystem } from '../mechanic/dialogue-system';

const SIMPLE_TREE = {
  id: 'dlg-1',
  startNode: 'n1',
  nodes: {
    n1: {
      id: 'n1',
      speaker: 'NPC',
      text: 'Hello!',
      next: 'n2',
    },
    n2: {
      id: 'n2',
      speaker: 'NPC',
      text: 'Goodbye!',
    },
  },
};

const CHOICE_TREE = {
  id: 'dlg-choice',
  startNode: 'c1',
  nodes: {
    c1: {
      id: 'c1',
      speaker: 'NPC',
      text: 'Which path?',
      choices: [
        { text: 'Left', next: 'left' },
        { text: 'Right', next: 'right' },
      ],
    },
    left: {
      id: 'left',
      speaker: 'NPC',
      text: 'You went left.',
    },
    right: {
      id: 'right',
      speaker: 'NPC',
      text: 'You went right.',
    },
  },
};

const EFFECT_TREE = {
  id: 'dlg-effect',
  startNode: 'e1',
  nodes: {
    e1: {
      id: 'e1',
      speaker: 'NPC',
      text: 'Rewarded!',
      effects: [{ event: 'reward:gold', data: { amount: 100 } }],
    },
  },
};

function setup(params: Record<string, any> = {}) {
  const engine = new Engine();
  const mod = new DialogueSystem('dlg-sys-1', {
    dialogues: {
      'dlg-1': SIMPLE_TREE,
      'dlg-choice': CHOICE_TREE,
      'dlg-effect': EFFECT_TREE,
    },
    ...params,
  });
  engine.addModule(mod);
  engine.eventBus.emit('gameflow:resume');
  return { engine, mod };
}

describe('DialogueSystem', () => {
  it('should start dialogue and emit dialogue:start', () => {
    const { engine, mod } = setup();
    const handler = vi.fn();
    engine.eventBus.on('dialogue:start', handler);

    const result = mod.startDialogue('dlg-1');

    expect(result).toBe(true);
    expect(mod.isActive()).toBe(true);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ dialogueId: 'dlg-1', speaker: 'NPC' }),
    );
  });

  it('should show first node and emit dialogue:node', () => {
    const { engine, mod } = setup();
    const handler = vi.fn();
    engine.eventBus.on('dialogue:node', handler);

    mod.startDialogue('dlg-1');

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'n1',
        speaker: 'NPC',
        text: 'Hello!',
      }),
    );
    expect(mod.getCurrentNode()).toMatchObject({ id: 'n1', text: 'Hello!' });
  });

  it('should advance to next node', () => {
    const { engine, mod } = setup();
    const handler = vi.fn();
    engine.eventBus.on('dialogue:node', handler);

    mod.startDialogue('dlg-1');
    mod.advanceNode();

    expect(mod.getCurrentNode()).toMatchObject({ id: 'n2', text: 'Goodbye!' });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should handle choices and selectChoice', () => {
    const { engine, mod } = setup();
    const choiceHandler = vi.fn();
    engine.eventBus.on('dialogue:choice', choiceHandler);

    mod.startDialogue('dlg-choice');
    mod.selectChoice(0);

    expect(mod.getCurrentNode()).toMatchObject({ id: 'left' });
    expect(choiceHandler).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'c1', choiceIndex: 0 }),
    );
  });

  it('should emit effects on node with effects', () => {
    const { engine, mod } = setup();
    const effectHandler = vi.fn();
    engine.eventBus.on('reward:gold', effectHandler);

    mod.startDialogue('dlg-effect');

    expect(effectHandler).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100 }),
    );
  });

  it('should end dialogue when no next node', () => {
    const { engine, mod } = setup();
    const pauseHandler = vi.fn();
    const resumeHandler = vi.fn();
    engine.eventBus.on('gameflow:pause', pauseHandler);
    engine.eventBus.on('gameflow:resume', resumeHandler);

    mod.startDialogue('dlg-1');
    expect(pauseHandler).toHaveBeenCalledTimes(1);

    mod.advanceNode();
    mod.advanceNode();

    expect(mod.isActive()).toBe(false);
    expect(resumeHandler).toHaveBeenCalled();
  });

  it('should emit dialogue:end when dialogue finishes', () => {
    const { engine, mod } = setup();
    const endHandler = vi.fn();
    engine.eventBus.on('dialogue:end', endHandler);

    mod.startDialogue('dlg-1');
    mod.advanceNode();
    mod.advanceNode();

    expect(endHandler).toHaveBeenCalledWith(
      expect.objectContaining({ dialogueId: 'dlg-1' }),
    );
  });

  it('should not advance when no dialogue is active', () => {
    const { engine, mod } = setup();
    const handler = vi.fn();
    engine.eventBus.on('dialogue:node', handler);

    mod.advanceNode();

    expect(handler).not.toHaveBeenCalled();
    expect(mod.getCurrentNode()).toBeNull();
  });

  it('should reset active dialogue on reset', () => {
    const { mod } = setup();
    mod.startDialogue('dlg-1');

    mod.reset();

    expect(mod.isActive()).toBe(false);
    expect(mod.getCurrentNode()).toBeNull();
  });

  it('should return false for unknown dialogue id', () => {
    const { mod } = setup();
    const result = mod.startDialogue('nonexistent');
    expect(result).toBe(false);
    expect(mod.isActive()).toBe(false);
  });

  it('should pause gameflow when dialogue starts', () => {
    const { engine, mod } = setup();
    const pauseHandler = vi.fn();
    engine.eventBus.on('gameflow:pause', pauseHandler);

    mod.startDialogue('dlg-1');

    expect(pauseHandler).toHaveBeenCalledTimes(1);
  });

  it('should trigger start via triggerEvent with dialogueId in data', () => {
    const { engine, mod } = setup({ triggerEvent: 'collision:hit' });
    const startHandler = vi.fn();
    engine.eventBus.on('dialogue:start', startHandler);

    engine.eventBus.emit('collision:hit', { dialogueId: 'dlg-1' });

    expect(startHandler).toHaveBeenCalled();
    expect(mod.isActive()).toBe(true);
  });

  it('should advance via advanceEvent when dialogue is active', () => {
    const { engine, mod } = setup({ advanceEvent: 'input:touch:tap' });
    mod.startDialogue('dlg-1');

    const handler = vi.fn();
    engine.eventBus.on('dialogue:node', handler);

    engine.eventBus.emit('input:touch:tap');

    expect(mod.getCurrentNode()).toMatchObject({ id: 'n2' });
  });

  it('should resume gameflow when reset during active dialogue', () => {
    const { engine, mod } = setup();
    const resumeHandler = vi.fn();
    const pauseHandler = vi.fn();

    engine.eventBus.on('gameflow:resume', resumeHandler);
    engine.eventBus.on('gameflow:pause', pauseHandler);

    // Start a dialogue — this pauses gameflow
    mod.startDialogue('dlg-1');
    expect(pauseHandler).toHaveBeenCalledTimes(1);
    expect(mod.isActive()).toBe(true);

    // Reset while dialogue is active — must emit gameflow:resume
    mod.reset();

    expect(resumeHandler).toHaveBeenCalled();
    expect(mod.isActive()).toBe(false);
    expect(mod.getCurrentNode()).toBeNull();
  });

  it('should not emit gameflow:resume when reset without active dialogue', () => {
    const { engine, mod } = setup();
    const resumeHandler = vi.fn();
    engine.eventBus.on('gameflow:resume', resumeHandler);

    // No dialogue started — reset should not emit resume
    mod.reset();

    expect(resumeHandler).not.toHaveBeenCalled();
  });
});
