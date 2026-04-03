import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';
import type { Chip } from '@/store/editor-store';
import { SuggestionChips } from '../suggestion-chips';

function setChips(chips: Chip[]): void {
  useEditorStore.setState({ suggestionChips: chips });
}

describe('SuggestionChips — extended chip types', () => {
  beforeEach(() => {
    useEditorStore.setState({
      suggestionChips: [],
      boardModeOpen: false,
    });
  });

  // ── board_mode ────────────────────────────────────────────

  it('renders board_mode chip with "GUI 面板" label', () => {
    setChips([{ id: 'board', type: 'board_mode', label: 'GUI 面板', emoji: '🎛️' }]);
    render(<SuggestionChips onChipClick={vi.fn()} />);

    expect(screen.getByText('GUI 面板')).toBeInTheDocument();
  });

  it('clicking board_mode chip calls setBoardModeOpen(true)', () => {
    setChips([{ id: 'board', type: 'board_mode', label: 'GUI 面板', emoji: '🎛️' }]);
    const onChipClick = vi.fn();
    render(<SuggestionChips onChipClick={onChipClick} />);

    fireEvent.click(screen.getByText('GUI 面板'));

    expect(useEditorStore.getState().boardModeOpen).toBe(true);
    // board_mode should NOT call onChipClick — it has its own side effect
    expect(onChipClick).not.toHaveBeenCalled();
  });

  it('board_mode chip has distinct styling', () => {
    setChips([
      { id: 'game', type: 'game_type', label: '接住游戏', emoji: '🎯' },
      { id: 'board', type: 'board_mode', label: 'GUI 面板', emoji: '🎛️' },
    ]);
    render(<SuggestionChips onChipClick={vi.fn()} />);

    const boardBtn = screen.getByText('GUI 面板').closest('button')!;
    const gameBtn = screen.getByText('接住游戏').closest('button')!;

    // board_mode chip should have a visually distinct class
    expect(boardBtn.className).toContain('border-blue-400/30');
    expect(gameBtn.className).not.toContain('border-blue-400/30');
  });

  // ── param ─────────────────────────────────────────────────

  it('renders param chip with paramId and shows label', () => {
    setChips([{
      id: 'speed-param',
      type: 'param',
      label: '速度调节',
      emoji: '⚙️',
      paramId: 'player_speed',
      category: 'movement',
    }]);
    render(<SuggestionChips onChipClick={vi.fn()} />);

    expect(screen.getByText('速度调节')).toBeInTheDocument();
  });

  it('clicking param chip calls onChipClick with chip data including paramId', () => {
    const chip: Chip = {
      id: 'speed-param',
      type: 'param',
      label: '速度调节',
      emoji: '⚙️',
      paramId: 'player_speed',
      category: 'movement',
    };
    setChips([chip]);
    const onChipClick = vi.fn();
    render(<SuggestionChips onChipClick={onChipClick} />);

    fireEvent.click(screen.getByText('速度调节'));

    expect(onChipClick).toHaveBeenCalledWith(chip);
  });

  it('param chip has distinct styling', () => {
    setChips([{
      id: 'speed-param',
      type: 'param',
      label: '速度调节',
      emoji: '⚙️',
      paramId: 'player_speed',
    }]);
    render(<SuggestionChips onChipClick={vi.fn()} />);

    const btn = screen.getByText('速度调节').closest('button')!;
    expect(btn.className).toContain('border-amber-400/30');
  });

  // ── action ────────────────────────────────────────────────

  it('renders action chip with action label', () => {
    setChips([{
      id: 'add-enemy',
      type: 'action',
      label: '添加敌人',
      emoji: '👾',
      action: 'add_enemy_wave',
    }]);
    render(<SuggestionChips onChipClick={vi.fn()} />);

    expect(screen.getByText('添加敌人')).toBeInTheDocument();
  });

  it('clicking action chip calls onChipClick with chip data', () => {
    const chip: Chip = {
      id: 'add-enemy',
      type: 'action',
      label: '添加敌人',
      emoji: '👾',
      action: 'add_enemy_wave',
    };
    setChips([chip]);
    const onChipClick = vi.fn();
    render(<SuggestionChips onChipClick={onChipClick} />);

    fireEvent.click(screen.getByText('添加敌人'));

    expect(onChipClick).toHaveBeenCalledWith(chip);
  });

  it('action chip has distinct styling', () => {
    setChips([{
      id: 'add-enemy',
      type: 'action',
      label: '添加敌人',
      emoji: '👾',
      action: 'add_enemy_wave',
    }]);
    render(<SuggestionChips onChipClick={vi.fn()} />);

    const btn = screen.getByText('添加敌人').closest('button')!;
    expect(btn.className).toContain('border-green-400/30');
  });

  // ── mixed types ───────────────────────────────────────────

  it('renders mixed chip types correctly', () => {
    setChips([
      { id: 'catch', type: 'game_type', label: '接住游戏', emoji: '🎯' },
      { id: 'board', type: 'board_mode', label: 'GUI 面板', emoji: '🎛️' },
      { id: 'speed', type: 'param', label: '速度调节', emoji: '⚙️', paramId: 'speed' },
    ]);
    render(<SuggestionChips onChipClick={vi.fn()} />);

    expect(screen.getByText('接住游戏')).toBeInTheDocument();
    expect(screen.getByText('GUI 面板')).toBeInTheDocument();
    expect(screen.getByText('速度调节')).toBeInTheDocument();
  });

  // ── backward compatibility ────────────────────────────────

  it('existing game_type chips still work as before', () => {
    const chip: Chip = { id: 'catch', type: 'game_type', label: '接住游戏', emoji: '🎯' };
    setChips([chip]);
    const onChipClick = vi.fn();
    render(<SuggestionChips onChipClick={onChipClick} />);

    expect(screen.getByText('🎯')).toBeInTheDocument();
    expect(screen.getByText('接住游戏')).toBeInTheDocument();

    fireEvent.click(screen.getByText('接住游戏'));
    expect(onChipClick).toHaveBeenCalledWith(chip);
  });

  it('chips without explicit type default to game_type behavior', () => {
    // Backward compat: old chips without type field should still work
    const chip = { id: 'catch', label: '接住游戏', emoji: '🎯' } as Chip;
    setChips([chip]);
    const onChipClick = vi.fn();
    render(<SuggestionChips onChipClick={onChipClick} />);

    fireEvent.click(screen.getByText('接住游戏'));
    expect(onChipClick).toHaveBeenCalledWith(chip);
  });

  it('returns null when chips array is empty', () => {
    setChips([]);
    const { container } = render(<SuggestionChips onChipClick={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
