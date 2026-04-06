import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepIndicator } from '../step-indicator.tsx';

describe('StepIndicator', () => {
  it('renders all 4 step labels', () => {
    render(<StepIndicator phase="tuning" />);
    expect(screen.getByText('调式状态')).toBeDefined();
    expect(screen.getByText('游戏状态')).toBeDefined();
    expect(screen.getByText('成功')).toBeDefined();
    expect(screen.getByText('失败')).toBeDefined();
  });

  it('highlights tuning step when phase is tuning', () => {
    render(<StepIndicator phase="tuning" />);
    const label = screen.getByText('调式状态');
    expect(label.className).toContain('text-white');
    expect(label.className).not.toContain('text-white/40');
  });

  it('highlights playing step when phase is playing', () => {
    render(<StepIndicator phase="playing" />);
    const label = screen.getByText('游戏状态');
    expect(label.className).toContain('text-white');
    // tuning is past, should be dimmed
    const tuning = screen.getByText('调式状态');
    expect(tuning.className).toContain('text-white/40');
  });

  it('highlights success step', () => {
    render(<StepIndicator phase="success" />);
    const label = screen.getByText('成功');
    expect(label.className).toContain('text-white');
  });

  it('default phase is renderable', () => {
    const { container } = render(<StepIndicator phase="tuning" />);
    expect(container.querySelector('[data-testid="step-indicator"]')).toBeDefined();
  });
});
