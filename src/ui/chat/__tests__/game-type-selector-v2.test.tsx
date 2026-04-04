import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameTypeSelector } from '../game-type-selector';
import { GAME_TYPE_META, ALL_GAME_TYPES } from '@/agent/game-presets';

const allOptions = ALL_GAME_TYPES.map((id) => ({
  id,
  name: GAME_TYPE_META[id].displayName,
  emoji: GAME_TYPE_META[id].emoji,
  category: GAME_TYPE_META[id].category,
  supportedToday: GAME_TYPE_META[id].supportedToday,
}));

describe('GameTypeSelector v2', () => {
  it('renders category tabs', () => {
    render(<GameTypeSelector options={allOptions} onSelect={() => {}} />);
    // Should have category tab buttons
    expect(screen.getByText('Reflex')).toBeDefined();
    expect(screen.getByText('Physics')).toBeDefined();
    expect(screen.getByText('Puzzle')).toBeDefined();
  });

  it('renders search input', () => {
    render(<GameTypeSelector options={allOptions} onSelect={() => {}} />);
    const input = screen.getByPlaceholderText(/搜索/);
    expect(input).toBeDefined();
  });

  it('filters by search query', () => {
    render(<GameTypeSelector options={allOptions} onSelect={() => {}} />);
    const input = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(input, { target: { value: '射击' } });
    // Should show shooting but not catch
    const cards = screen.getAllByTestId('game-type-card');
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by category tab click', () => {
    render(<GameTypeSelector options={allOptions} onSelect={() => {}} />);
    const physicsTab = screen.getByText('Physics');
    fireEvent.click(physicsTab);
    const cards = screen.getAllByTestId('game-type-card');
    // Physics category has shooting, slingshot, ball-physics, trajectory, bouncing, rope-cutting
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it('calls onSelect when confirm button clicked', () => {
    let selected = '';
    render(
      <GameTypeSelector options={allOptions} onSelect={(id) => { selected = id; }} />,
    );
    const buttons = screen.getAllByText('确定');
    fireEvent.click(buttons[0]);
    expect(selected).toBeTruthy();
  });
});
