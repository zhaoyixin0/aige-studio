import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../editor-store';
import type { ChatMessage } from '../editor-store';

describe('EditorStore L1State', () => {
  beforeEach(() => {
    useEditorStore.setState({
      l1State: { difficulty: 'normal', pacing: 50, emotion: 'cartoon' },
      boardModeOpen: false,
    });
  });

  it('l1State has correct initial values', () => {
    const { l1State } = useEditorStore.getState();
    expect(l1State).toEqual({
      difficulty: 'normal',
      pacing: 50,
      emotion: 'cartoon',
    });
  });

  it('setL1State updates only specified fields immutably', () => {
    const before = useEditorStore.getState().l1State;

    useEditorStore.getState().setL1State({ difficulty: 'hard' });

    const after = useEditorStore.getState().l1State;
    expect(after.difficulty).toBe('hard');
    expect(after.pacing).toBe(50);
    expect(after.emotion).toBe('cartoon');
    // Immutability: must be a new object reference
    expect(after).not.toBe(before);
  });

  it('setL1State can update multiple fields at once', () => {
    useEditorStore.getState().setL1State({ pacing: 80, emotion: 'pixel' });

    const { l1State } = useEditorStore.getState();
    expect(l1State.difficulty).toBe('normal');
    expect(l1State.pacing).toBe(80);
    expect(l1State.emotion).toBe('pixel');
  });

  it('setL1State with empty partial does not mutate', () => {
    const before = useEditorStore.getState().l1State;

    useEditorStore.getState().setL1State({});

    const after = useEditorStore.getState().l1State;
    expect(after).toEqual(before);
    // Even with empty partial, spread creates new ref — that's fine
    expect(after).not.toBe(before);
  });
});

describe('EditorStore boardModeOpen', () => {
  beforeEach(() => {
    useEditorStore.setState({ boardModeOpen: false });
  });

  it('boardModeOpen defaults to false', () => {
    expect(useEditorStore.getState().boardModeOpen).toBe(false);
  });

  it('setBoardModeOpen(true) sets it to true', () => {
    useEditorStore.getState().setBoardModeOpen(true);
    expect(useEditorStore.getState().boardModeOpen).toBe(true);
  });

  it('setBoardModeOpen(false) sets it back to false', () => {
    useEditorStore.getState().setBoardModeOpen(true);
    useEditorStore.getState().setBoardModeOpen(false);
    expect(useEditorStore.getState().boardModeOpen).toBe(false);
  });
});

describe('ChatMessage type extensions', () => {
  it('accepts parameterCard optional field', () => {
    const msg: ChatMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Here are the parameters',
      timestamp: Date.now(),
      parameterCard: {
        category: 'physics',
        paramIds: ['gravity', 'friction'],
        title: 'Physics Settings',
      },
    };
    expect(msg.parameterCard?.category).toBe('physics');
    expect(msg.parameterCard?.paramIds).toEqual(['gravity', 'friction']);
    expect(msg.parameterCard?.title).toBe('Physics Settings');
  });

  it('accepts parameterCard without optional title', () => {
    const msg: ChatMessage = {
      id: 'msg-2',
      role: 'assistant',
      content: 'Params',
      timestamp: Date.now(),
      parameterCard: {
        category: 'audio',
        paramIds: ['volume'],
      },
    };
    expect(msg.parameterCard?.title).toBeUndefined();
  });

  it('accepts l1Controls optional field', () => {
    const msg: ChatMessage = {
      id: 'msg-3',
      role: 'assistant',
      content: 'Adjust difficulty',
      timestamp: Date.now(),
      l1Controls: true,
    };
    expect(msg.l1Controls).toBe(true);
  });

  it('works without new optional fields (backward compatible)', () => {
    const msg: ChatMessage = {
      id: 'msg-4',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    };
    expect(msg.parameterCard).toBeUndefined();
    expect(msg.l1Controls).toBeUndefined();
  });
});
