import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisualStyleSelector } from '../visual-style-selector';
import type { StyleOption } from '../visual-style-selector';

const OPTIONS: readonly StyleOption[] = [
  { id: 'classic', name: '经典', thumbnail: '🎨' },
  { id: 'cyber', name: '赛博', thumbnail: '🌃' },
  { id: 'fresh', name: '清新', thumbnail: '🌿' },
];

describe('VisualStyleSelector', () => {
  const defaultProps = {
    options: OPTIONS,
    value: 'classic',
    onChange: vi.fn(),
  };

  it('renders all style options as thumbnails', () => {
    render(<VisualStyleSelector {...defaultProps} />);
    expect(screen.getByText('经典')).toBeTruthy();
    expect(screen.getByText('赛博')).toBeTruthy();
    expect(screen.getByText('清新')).toBeTruthy();
  });

  it('highlights the currently selected style', () => {
    render(<VisualStyleSelector {...defaultProps} value="cyber" />);
    const radiogroup = screen.getByRole('radiogroup');
    const options = radiogroup.querySelectorAll('[role="radio"]');
    // cyber is index 1
    expect(options[0].getAttribute('aria-checked')).toBe('false');
    expect(options[1].getAttribute('aria-checked')).toBe('true');
    expect(options[2].getAttribute('aria-checked')).toBe('false');
  });

  it('calls onChange with style ID when clicked', () => {
    const onChange = vi.fn();
    render(<VisualStyleSelector {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByText('赛博'));
    expect(onChange).toHaveBeenCalledWith('cyber');
  });

  it('each option shows a label', () => {
    render(<VisualStyleSelector {...defaultProps} />);
    for (const opt of OPTIONS) {
      expect(screen.getByText(opt.name)).toBeTruthy();
    }
  });

  it('has proper ARIA role (radiogroup)', () => {
    render(<VisualStyleSelector {...defaultProps} />);
    const radiogroup = screen.getByRole('radiogroup');
    expect(radiogroup).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('supports keyboard navigation with arrow keys', () => {
    const onChange = vi.fn();
    render(<VisualStyleSelector {...defaultProps} value="classic" onChange={onChange} />);
    const firstRadio = screen.getAllByRole('radio')[0];

    // ArrowRight moves to next option
    fireEvent.keyDown(firstRadio, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('cyber');

    onChange.mockClear();

    // ArrowLeft wraps around to last option
    fireEvent.keyDown(firstRadio, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('fresh');
  });

  it('renders thumbnail content for each option', () => {
    render(<VisualStyleSelector {...defaultProps} />);
    expect(screen.getByText('🎨')).toBeTruthy();
    expect(screen.getByText('🌃')).toBeTruthy();
    expect(screen.getByText('🌿')).toBeTruthy();
  });

  it('does not call onChange when clicking already selected option', () => {
    const onChange = vi.fn();
    render(<VisualStyleSelector {...defaultProps} value="classic" onChange={onChange} />);
    fireEvent.click(screen.getByText('经典'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
