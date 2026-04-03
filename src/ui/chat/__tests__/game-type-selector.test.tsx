import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameTypeSelector } from '../game-type-selector';
import type { GameTypeOption } from '../game-type-selector';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const ALL_OPTIONS: readonly GameTypeOption[] = [
  { id: 'catch', name: '接住游戏', emoji: '🎯' },
  { id: 'dodge', name: '躲避游戏', emoji: '💨' },
  { id: 'tap', name: '点击游戏', emoji: '👆' },
  { id: 'shooting', name: '射击游戏', emoji: '🔫' },
  { id: 'quiz', name: '答题游戏', emoji: '❓' },
  { id: 'random-wheel', name: '幸运转盘', emoji: '🎰' },
  { id: 'expression', name: '表情挑战', emoji: '😊' },
  { id: 'runner', name: '跑酷游戏', emoji: '🏃' },
  { id: 'gesture', name: '手势游戏', emoji: '🤚' },
  { id: 'rhythm', name: '节奏游戏', emoji: '🎵' },
  { id: 'puzzle', name: '拼图游戏', emoji: '🧩' },
  { id: 'dress-up', name: '换装游戏', emoji: '👗' },
  { id: 'world-ar', name: 'AR世界', emoji: '🌍' },
  { id: 'narrative', name: '叙事游戏', emoji: '📖' },
  { id: 'platformer', name: '平台跳跃', emoji: '🎮' },
] as const;

const SMALL_OPTIONS: readonly GameTypeOption[] = [
  { id: 'catch', name: '接住游戏', emoji: '🎯' },
  { id: 'dodge', name: '躲避游戏', emoji: '💨' },
  { id: 'tap', name: '点击游戏', emoji: '👆' },
] as const;

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('GameTypeSelector', () => {
  it('renders a grid of game type cards', () => {
    const { container } = render(
      <GameTypeSelector options={SMALL_OPTIONS} onSelect={vi.fn()} />,
    );

    // Should render a 3-column grid container
    const grid = container.querySelector('[class*="grid"]');
    expect(grid).toBeInTheDocument();

    // Should have one card per option
    const cards = container.querySelectorAll('[data-testid="game-type-card"]');
    expect(cards).toHaveLength(3);
  });

  it('each card shows game type name (Chinese label)', () => {
    render(
      <GameTypeSelector options={SMALL_OPTIONS} onSelect={vi.fn()} />,
    );

    expect(screen.getByText('接住游戏')).toBeInTheDocument();
    expect(screen.getByText('躲避游戏')).toBeInTheDocument();
    expect(screen.getByText('点击游戏')).toBeInTheDocument();
  });

  it('each card has a confirm button', () => {
    render(
      <GameTypeSelector options={SMALL_OPTIONS} onSelect={vi.fn()} />,
    );

    const buttons = screen.getAllByRole('button', { name: /确定/ });
    expect(buttons).toHaveLength(3);
  });

  it('clicking confirm calls onSelect with the game type ID', () => {
    const onSelect = vi.fn();
    render(
      <GameTypeSelector options={SMALL_OPTIONS} onSelect={onSelect} />,
    );

    const confirmButtons = screen.getAllByRole('button', { name: /确定/ });
    fireEvent.click(confirmButtons[1]); // click dodge's button

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('dodge');
  });

  it('highlights the hovered card', () => {
    const { container } = render(
      <GameTypeSelector options={SMALL_OPTIONS} onSelect={vi.fn()} />,
    );

    const cards = container.querySelectorAll('[data-testid="game-type-card"]');
    const secondCard = cards[1];

    // Hover the second card
    fireEvent.mouseEnter(secondCard);
    expect(secondCard.className).toContain('border-blue-400');

    // Leave the card
    fireEvent.mouseLeave(secondCard);
    expect(secondCard.className).not.toContain('border-blue-400');
  });

  it('renders at least the 15 known game types', () => {
    const { container } = render(
      <GameTypeSelector options={ALL_OPTIONS} onSelect={vi.fn()} />,
    );

    const cards = container.querySelectorAll('[data-testid="game-type-card"]');
    expect(cards.length).toBeGreaterThanOrEqual(15);

    // Verify all 15 names are rendered
    for (const option of ALL_OPTIONS) {
      expect(screen.getByText(option.name)).toBeInTheDocument();
    }
  });

  it('renders nothing when gameTypes array is empty', () => {
    const { container } = render(
      <GameTypeSelector options={[]} onSelect={vi.fn()} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders emoji for each card', () => {
    render(
      <GameTypeSelector options={SMALL_OPTIONS} onSelect={vi.fn()} />,
    );

    expect(screen.getByText('🎯')).toBeInTheDocument();
    expect(screen.getByText('💨')).toBeInTheDocument();
    expect(screen.getByText('👆')).toBeInTheDocument();
  });

  it('has aria-label on confirm buttons for accessibility', () => {
    render(
      <GameTypeSelector options={SMALL_OPTIONS} onSelect={vi.fn()} />,
    );

    const buttons = screen.getAllByRole('button');
    for (const button of buttons) {
      expect(button).toHaveAttribute('aria-label');
    }
  });
});
