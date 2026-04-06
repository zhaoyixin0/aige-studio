import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';
import { GameTypeSelector } from '../game-type-selector';

// Mock expert presets to provide counts
vi.mock('@/engine/systems/recipe-runner/index.ts', () => ({
  EXPERT_PRESETS: [
    { id: 'p1', title: 'Preset 1', gameType: 'catch', tags: ['confidence:0.9'], description: '' },
    { id: 'p2', title: 'Preset 2', gameType: 'catch', tags: ['confidence:0.8'], description: '' },
    { id: 'p3', title: 'Preset 3', gameType: 'dodge', tags: ['confidence:0.7'], description: '' },
  ],
}));

const OPTIONS = [
  { id: 'catch', name: 'Catch', emoji: '🧺' },
  { id: 'dodge', name: 'Dodge', emoji: '💨' },
];

beforeEach(() => {
  useEditorStore.setState({
    expertBrowserOpen: false,
    expertBrowserGameType: null,
  });
});

describe('GameTypeSelector expert badge click', () => {
  it('clicking expert badge opens ExpertBrowser with gameType filter', () => {
    render(<GameTypeSelector options={OPTIONS} onSelect={vi.fn()} />);

    // Find the expert badge for "catch" (should show "2 款专家模板")
    const badges = screen.getAllByTestId('expert-badge');
    expect(badges.length).toBeGreaterThan(0);

    fireEvent.click(badges[0]);

    const state = useEditorStore.getState();
    expect(state.expertBrowserOpen).toBe(true);
    expect(state.expertBrowserGameType).toBe('catch');
  });

  it('clicking expert badge does NOT trigger game type selection', () => {
    const onSelect = vi.fn();
    render(<GameTypeSelector options={OPTIONS} onSelect={onSelect} />);

    const badges = screen.getAllByTestId('expert-badge');
    fireEvent.click(badges[0]);

    // onSelect should NOT be called — badge click should not propagate
    expect(onSelect).not.toHaveBeenCalled();
  });
});
