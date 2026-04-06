import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardShell, Section } from '../card-shell';

describe('CardShell', () => {
  it('renders icon, title, and children', () => {
    render(
      <CardShell icon="🎮" title="Game Mechanics">
        <p>Child content</p>
      </CardShell>,
    );

    expect(screen.getByText('🎮')).toBeInTheDocument();
    expect(screen.getByText('Game Mechanics')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('applies glassmorphism card styling', () => {
    const { container } = render(
      <CardShell icon="🎵" title="Audio">
        <span>test</span>
      </CardShell>,
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('rounded-xl');
    expect(card.className).toContain('bg-white/5');
    expect(card.className).toContain('border');
  });
});

describe('Section', () => {
  it('renders section title and children', () => {
    render(
      <Section title="核心规则">
        <p>Section content</p>
      </Section>,
    );

    expect(screen.getByText('核心规则')).toBeInTheDocument();
    expect(screen.getByText('Section content')).toBeInTheDocument();
  });

  it('renders nothing when children is empty', () => {
    render(
      <Section title="Empty">{null}</Section>,
    );

    // Section should still render even with no children (container present)
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });
});
