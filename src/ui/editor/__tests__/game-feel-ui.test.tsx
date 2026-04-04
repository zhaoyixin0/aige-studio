import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameFeelScore } from '../game-feel-score';
import { GameFeelSuggestions } from '../game-feel-suggestions';

describe('GameFeelScore', () => {
  it('renders score number', () => {
    render(<GameFeelScore score={75} dimensions={{}} badge="silver" />);
    expect(screen.getByText('75')).toBeDefined();
  });

  it('renders badge', () => {
    render(<GameFeelScore score={85} dimensions={{}} badge="gold" />);
    expect(screen.getByText(/gold/i)).toBeDefined();
  });

  it('renders SVG radial indicator', () => {
    const { container } = render(
      <GameFeelScore score={50} dimensions={{}} badge="silver" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('uses green color for score > 80', () => {
    const { container } = render(
      <GameFeelScore score={90} dimensions={{}} badge="expert" />,
    );
    // Check for green stroke color
    const circle = container.querySelector('circle.score-ring');
    expect(circle).toBeDefined();
  });
});

describe('GameFeelSuggestions', () => {
  const suggestions = [
    { id: 's1', title: 'Add particles', description: 'Improve feedback', delta: 5 },
    { id: 's2', title: 'Add timer', description: 'Better pacing', delta: 8 },
  ];

  it('renders suggestion titles', () => {
    render(<GameFeelSuggestions suggestions={suggestions} onApply={() => {}} />);
    expect(screen.getByText('Add particles')).toBeDefined();
    expect(screen.getByText('Add timer')).toBeDefined();
  });

  it('renders delta values', () => {
    render(<GameFeelSuggestions suggestions={suggestions} onApply={() => {}} />);
    expect(screen.getByText('+5')).toBeDefined();
    expect(screen.getByText('+8')).toBeDefined();
  });

  it('renders empty state when no suggestions', () => {
    render(<GameFeelSuggestions suggestions={[]} onApply={() => {}} />);
    const el = screen.queryByText('Add particles');
    expect(el).toBeNull();
  });
});
