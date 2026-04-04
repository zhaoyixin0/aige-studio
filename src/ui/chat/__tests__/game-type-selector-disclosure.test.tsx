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

describe('GameTypeSelector Progressive Disclosure', () => {
  it('shows max 6 cards by default when no category selected', () => {
    render(<GameTypeSelector options={allOptions} onSelect={() => {}} />);
    const cards = screen.getAllByTestId('game-type-card');
    expect(cards.length).toBeLessThanOrEqual(6);
  });

  it('renders a "Show More" button when more than 6 options', () => {
    render(<GameTypeSelector options={allOptions} onSelect={() => {}} />);
    const showMore = screen.getByText(/更多/);
    expect(showMore).toBeDefined();
  });

  it('expands to show all when "Show More" clicked', () => {
    render(<GameTypeSelector options={allOptions} onSelect={() => {}} />);
    const showMore = screen.getByText(/更多/);
    fireEvent.click(showMore);
    const cards = screen.getAllByTestId('game-type-card');
    expect(cards.length).toBeGreaterThan(6);
  });

  it('coming-soon badge shown for unsupported types', () => {
    render(<GameTypeSelector options={allOptions} onSelect={() => {}} />);
    // Expand first
    const showMore = screen.getByText(/更多/);
    fireEvent.click(showMore);
    const badges = screen.getAllByText('Coming Soon');
    expect(badges.length).toBeGreaterThan(0);
  });
});
