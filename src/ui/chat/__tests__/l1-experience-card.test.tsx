import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { L1ExperienceCard } from '../l1-experience-card';

describe('L1ExperienceCard', () => {
  const defaultProps = {
    difficulty: 'normal',
    pacing: '中',
    emotion: 'cartoon',
    onDifficultyChange: vi.fn(),
    onPacingChange: vi.fn(),
    onEmotionChange: vi.fn(),
  };

  it('renders three control sections', () => {
    render(<L1ExperienceCard {...defaultProps} />);
    expect(screen.getByText('Gameplay Difficulty')).toBeTruthy();
    expect(screen.getByText('Gameplay Pacing')).toBeTruthy();
    expect(screen.getByText('Game Styles')).toBeTruthy();
  });

  it('renders difficulty as 4 emoji icon buttons', () => {
    render(<L1ExperienceCard {...defaultProps} />);
    const diffGroup = screen.getByRole('radiogroup', { name: '游戏难度' });
    expect(diffGroup).toBeTruthy();
    const radios = diffGroup.querySelectorAll('[role="radio"]');
    expect(radios).toHaveLength(4);
  });

  it('renders pacing as gradient slider', () => {
    render(<L1ExperienceCard {...defaultProps} />);
    expect(screen.getByRole('slider')).toBeTruthy();
  });

  it('renders styles as carousel cards', () => {
    render(<L1ExperienceCard {...defaultProps} />);
    const styleGroup = screen.getByRole('radiogroup', { name: '画风选择' });
    expect(styleGroup).toBeTruthy();
    const cards = styleGroup.querySelectorAll('[role="radio"]');
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it('highlights current difficulty selection', () => {
    render(<L1ExperienceCard {...defaultProps} />);
    const diffGroup = screen.getByRole('radiogroup', { name: '游戏难度' });
    const selected = diffGroup.querySelector('[aria-checked="true"]');
    expect(selected).toBeTruthy();
    expect(selected!.getAttribute('aria-label')).toBe('normal');
  });

  it('calls onDifficultyChange when emoji button clicked', () => {
    const onChange = vi.fn();
    render(<L1ExperienceCard {...defaultProps} onDifficultyChange={onChange} />);
    const diffGroup = screen.getByRole('radiogroup', { name: '游戏难度' });
    const hardBtn = diffGroup.querySelector('[aria-label="hard"]');
    expect(hardBtn).toBeTruthy();
    fireEvent.click(hardBtn!);
    expect(onChange).toHaveBeenCalledWith('hard');
  });

  it('calls onEmotionChange when style card clicked', () => {
    const onChange = vi.fn();
    render(<L1ExperienceCard {...defaultProps} onEmotionChange={onChange} />);
    const styleGroup = screen.getByRole('radiogroup', { name: '画风选择' });
    const pixelCard = styleGroup.querySelector('[aria-label="像素"]');
    expect(pixelCard).toBeTruthy();
    fireEvent.click(pixelCard!);
    expect(onChange).toHaveBeenCalledWith('pixel');
  });

  it('renders with card wrapper styling', () => {
    const { container } = render(<L1ExperienceCard {...defaultProps} />);
    const card = container.firstElementChild;
    expect(card).toBeTruthy();
    expect(card?.className).toContain('rounded');
  });

  it('renders Game Experience header', () => {
    render(<L1ExperienceCard {...defaultProps} />);
    expect(screen.getByText('Game Experience')).toBeTruthy();
  });
});
