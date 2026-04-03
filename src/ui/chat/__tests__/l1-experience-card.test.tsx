import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { L1ExperienceCard } from '../l1-experience-card';

describe('L1ExperienceCard', () => {
  const defaultProps = {
    difficulty: '普通' as const,
    pacing: '中' as const,
    emotion: '欢乐' as const,
    onDifficultyChange: vi.fn(),
    onPacingChange: vi.fn(),
    onEmotionChange: vi.fn(),
  };

  it('renders three control sections', () => {
    render(<L1ExperienceCard {...defaultProps} />);
    expect(screen.getByText('游戏难度')).toBeTruthy();
    expect(screen.getByText('游戏节奏')).toBeTruthy();
    expect(screen.getByText('游戏情绪')).toBeTruthy();
  });

  it('renders difficulty as segmented control with 3 options', () => {
    render(<L1ExperienceCard {...defaultProps} />);
    expect(screen.getByRole('radio', { name: '简单' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '普通' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '困难' })).toBeTruthy();
  });

  it('renders pacing as segmented control with 3 options', () => {
    render(<L1ExperienceCard {...defaultProps} />);
    expect(screen.getByRole('radio', { name: '慢' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '中' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '快' })).toBeTruthy();
  });

  it('renders emotion as segmented control with 3 options', () => {
    render(<L1ExperienceCard {...defaultProps} />);
    expect(screen.getByRole('radio', { name: '沉静' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '热血' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '欢乐' })).toBeTruthy();
  });

  it('highlights current difficulty selection', () => {
    render(<L1ExperienceCard {...defaultProps} />);
    const normalRadio = screen.getByRole('radio', { name: '普通' });
    expect(normalRadio.getAttribute('aria-checked')).toBe('true');
  });

  it('calls onDifficultyChange when difficulty option clicked', () => {
    const onChange = vi.fn();
    render(<L1ExperienceCard {...defaultProps} onDifficultyChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: '困难' }));
    expect(onChange).toHaveBeenCalledWith('困难');
  });

  it('calls onPacingChange when pacing option clicked', () => {
    const onChange = vi.fn();
    render(<L1ExperienceCard {...defaultProps} onPacingChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: '快' }));
    expect(onChange).toHaveBeenCalledWith('快');
  });

  it('calls onEmotionChange when emotion option clicked', () => {
    const onChange = vi.fn();
    render(<L1ExperienceCard {...defaultProps} onEmotionChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: '热血' }));
    expect(onChange).toHaveBeenCalledWith('热血');
  });

  it('renders with a card wrapper styling', () => {
    const { container } = render(<L1ExperienceCard {...defaultProps} />);
    const card = container.firstElementChild;
    expect(card).toBeTruthy();
    expect(card?.className).toContain('rounded');
  });
});
