import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParameterPill } from '../parameter-pill';

describe('ParameterPill colorVariant', () => {
  it('defaults to blue color classes', () => {
    render(<ParameterPill name="Speed" value={10} />);
    const pill = screen.getByText('Speed').parentElement!;
    expect(pill.className).toContain('bg-blue-500/10');
    expect(pill.className).toContain('text-blue-300');
    expect(pill.className).toContain('border-blue-500/20');
  });

  it('applies amber classes when colorVariant="amber"', () => {
    render(<ParameterPill name="Score" value={100} colorVariant="amber" />);
    const pill = screen.getByText('Score').parentElement!;
    expect(pill.className).toContain('bg-amber-500/20');
    expect(pill.className).toContain('text-amber-300');
    expect(pill.className).toContain('border-amber-500/30');
  });

  it('applies hover classes for the specified variant when interactive', () => {
    const onClick = vi.fn();
    render(<ParameterPill name="Jump" value="on" colorVariant="emerald" onClick={onClick} />);
    const pill = screen.getByText('Jump').parentElement!;
    expect(pill.className).toContain('hover:bg-emerald-500/30');

    fireEvent.click(pill);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
