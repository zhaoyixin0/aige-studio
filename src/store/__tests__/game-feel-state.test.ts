import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../editor-store';

describe('Game Feel State', () => {
  beforeEach(() => {
    useEditorStore.setState({
      gameFeel: {
        score: 0,
        dimensions: {},
        suggestions: [],
        badge: null,
      },
    });
  });

  it('initializes gameFeel with default values', () => {
    const state = useEditorStore.getState();
    expect(state.gameFeel).toBeDefined();
    expect(state.gameFeel.score).toBe(0);
    expect(state.gameFeel.dimensions).toEqual({});
    expect(state.gameFeel.suggestions).toEqual([]);
    expect(state.gameFeel.badge).toBeNull();
  });

  it('setGameFeel updates score', () => {
    useEditorStore.getState().setGameFeel({ score: 75 });
    expect(useEditorStore.getState().gameFeel.score).toBe(75);
  });

  it('setGameFeel updates dimensions', () => {
    const dims = { Responsiveness: 80, MotionFidelity: 60 };
    useEditorStore.getState().setGameFeel({ dimensions: dims });
    expect(useEditorStore.getState().gameFeel.dimensions).toEqual(dims);
  });

  it('setGameFeel updates suggestions', () => {
    const suggs = [{ id: 's1', title: 'Add particles', description: 'Improve feedback', delta: 5 }];
    useEditorStore.getState().setGameFeel({ suggestions: suggs });
    expect(useEditorStore.getState().gameFeel.suggestions).toEqual(suggs);
  });

  it('setGameFeel updates badge', () => {
    useEditorStore.getState().setGameFeel({ badge: 'gold' });
    expect(useEditorStore.getState().gameFeel.badge).toBe('gold');
  });

  it('setGameFeel merges partial updates (immutable)', () => {
    useEditorStore.getState().setGameFeel({ score: 50, badge: 'silver' });
    useEditorStore.getState().setGameFeel({ score: 80 });
    const state = useEditorStore.getState().gameFeel;
    expect(state.score).toBe(80);
    expect(state.badge).toBe('silver'); // preserved from previous update
  });
});
