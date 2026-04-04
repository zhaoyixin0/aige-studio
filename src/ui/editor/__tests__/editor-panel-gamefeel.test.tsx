import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameFeelScore } from '../game-feel-score';
import { GameFeelSuggestions } from '../game-feel-suggestions';
import { useEditorStore } from '@/store/editor-store';

describe('EditorPanel Game Feel Dashboard', () => {
  beforeEach(() => {
    useEditorStore.setState({
      gameFeel: {
        score: 72,
        dimensions: { Responsiveness: 80, MotionFidelity: 65 },
        suggestions: [
          { id: 's1', title: 'Add DifficultyRamp', description: 'Improve pacing', delta: 8 },
        ],
        badge: 'gold',
      },
    });
  });

  it('GameFeelScore renders from store state', () => {
    const { gameFeel } = useEditorStore.getState();
    render(
      <GameFeelScore
        score={gameFeel.score}
        dimensions={gameFeel.dimensions}
        badge={gameFeel.badge}
      />,
    );
    expect(screen.getByText('72')).toBeDefined();
    expect(screen.getByText(/Gold/i)).toBeDefined();
  });

  it('GameFeelSuggestions renders from store state', () => {
    const { gameFeel } = useEditorStore.getState();
    render(
      <GameFeelSuggestions suggestions={gameFeel.suggestions} onApply={() => {}} />,
    );
    expect(screen.getByText('Add DifficultyRamp')).toBeDefined();
    expect(screen.getByText('+8')).toBeDefined();
  });

  it('Game Feel tab exists in editor panel markup', async () => {
    // Verify the EditorPanel source includes gamefeel tab
    const editorPanelSource = await import('../editor-panel?raw');
    const src = typeof editorPanelSource === 'string' ? editorPanelSource : (editorPanelSource as { default: string }).default;
    expect(src).toContain('gamefeel');
    expect(src).toContain('Game Feel');
    expect(src).toContain('GameFeelScore');
    expect(src).toContain('GameFeelSuggestions');
  });
});
