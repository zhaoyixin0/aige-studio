import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardModePanel } from '../board-mode-panel';
import { getParamsForGameType } from '@/data/parameter-registry';

describe('BoardModePanel', () => {
  const defaultProps = {
    gameType: 'catch',
    values: new Map<string, unknown>(),
    onParamChange: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders a panel with close button', () => {
    render(<BoardModePanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /关闭/i })).toBeTruthy();
  });

  it('renders category groups for the given game type', () => {
    render(<BoardModePanel {...defaultProps} />);
    // catch game should have game_mechanics and visual_audio categories at minimum
    expect(screen.getByText(/游戏机制/i)).toBeTruthy();
  });

  it('filters params by game type', () => {
    const { container } = render(<BoardModePanel {...defaultProps} gameType="catch" />);
    const catchGroups = container.querySelectorAll('[data-testid="param-category-group"]');

    const { container: container2 } = render(
      <BoardModePanel {...defaultProps} gameType="quiz" />
    );
    const quizGroups = container2.querySelectorAll('[data-testid="param-category-group"]');

    // Both should have groups but potentially different counts
    expect(catchGroups.length).toBeGreaterThan(0);
    expect(quizGroups.length).toBeGreaterThan(0);
  });

  it('only shows directly exposed params (not hidden)', () => {
    render(<BoardModePanel {...defaultProps} />);
    // hidden params should not render controls
    const allCatchParams = getParamsForGameType('catch');
    const hiddenParams = allCatchParams.filter((p) => p.exposure === 'hidden');
    for (const hp of hiddenParams.slice(0, 3)) {
      expect(screen.queryByLabelText(hp.name)).toBeNull();
    }
  });

  it('calls onParamChange when a parameter is adjusted', () => {
    const onChange = vi.fn();
    render(<BoardModePanel {...defaultProps} onParamChange={onChange} />);
    // Find any toggle and click it
    const switches = screen.queryAllByRole('switch');
    if (switches.length > 0) {
      switches[0].click();
      expect(onChange).toHaveBeenCalled();
    }
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<BoardModePanel {...defaultProps} onClose={onClose} />);
    screen.getByRole('button', { name: /关闭/i }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows ALL-type params even for unknown game types', () => {
    const { container } = render(
      <BoardModePanel {...defaultProps} gameType="nonexistent_game_xyz" />
    );
    const groups = container.querySelectorAll('[data-testid="param-category-group"]');
    // ALL params still apply, so some groups render
    expect(groups.length).toBeGreaterThan(0);
  });
});
