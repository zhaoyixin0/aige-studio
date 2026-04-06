import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeaturedExpertChip } from '../featured-expert-chip.tsx';
import { EXPERT_PRESETS } from '@/engine/systems/recipe-runner/index.ts';

describe('FeaturedExpertChip', () => {
  it('renders when expert presets available', () => {
    if (EXPERT_PRESETS.length === 0) return;
    render(<FeaturedExpertChip onUse={() => {}} />);
    const chip = screen.getByTestId('featured-expert-chip');
    expect(chip).toBeDefined();
    expect(chip.textContent).toContain('专家精选:');
  });

  it('click triggers onUse with preset id', () => {
    if (EXPERT_PRESETS.length === 0) return;
    const onUse = vi.fn();
    render(<FeaturedExpertChip onUse={onUse} />);
    const chip = screen.getByTestId('featured-expert-chip');
    fireEvent.click(chip);
    expect(onUse).toHaveBeenCalledTimes(1);
    const calledId = onUse.mock.calls[0][0] as string;
    expect(calledId).toMatch(/^expert-/);
  });

  it('renders a preset from top confidence pool', () => {
    if (EXPERT_PRESETS.length === 0) return;
    render(<FeaturedExpertChip onUse={() => {}} />);
    const chip = screen.getByTestId('featured-expert-chip');
    // Should contain some text from an actual preset title
    expect(chip.textContent!.length).toBeGreaterThan('专家精选: '.length);
  });
});
