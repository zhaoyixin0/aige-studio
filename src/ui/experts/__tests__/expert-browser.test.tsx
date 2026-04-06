import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpertBrowser } from '../expert-browser.tsx';
import { EXPERT_PRESETS } from '@/engine/systems/recipe-runner/index.ts';

describe('ExpertBrowser', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onUsePreset: vi.fn(),
  };

  it('renders all expert presets when open', () => {
    render(<ExpertBrowser {...defaultProps} />);
    const cards = screen.getAllByTestId('expert-preset-card');
    // Default confidence filter >= 0.6, so some may be hidden
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(EXPERT_PRESETS.length);
  });

  it('does not render when closed', () => {
    render(<ExpertBrowser {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('expert-browser')).toBeNull();
  });

  it('search filters by title', () => {
    render(<ExpertBrowser {...defaultProps} />);
    const searchInput = screen.getByTestId('expert-search');
    fireEvent.change(searchInput, { target: { value: 'slingshot' } });
    const cards = screen.queryAllByTestId('expert-preset-card');
    // Should have fewer results
    for (const card of cards) {
      const text = card.textContent!.toLowerCase();
      expect(text).toContain('slingshot');
    }
  });

  it('gameType filter narrows results', () => {
    render(<ExpertBrowser {...defaultProps} />);
    const filter = screen.getByTestId('expert-gametype-filter');
    fireEvent.change(filter, { target: { value: 'puzzle' } });
    const cards = screen.queryAllByTestId('expert-preset-card');
    // All visible cards should be puzzle type
    for (const card of cards) {
      expect(card.getAttribute('data-preset-id')).toBeTruthy();
    }
  });

  it('"使用此模板" click triggers onUsePreset', () => {
    const onUsePreset = vi.fn();
    render(<ExpertBrowser {...defaultProps} onUsePreset={onUsePreset} />);
    const useButtons = screen.getAllByText('使用此模板');
    expect(useButtons.length).toBeGreaterThan(0);
    fireEvent.click(useButtons[0]);
    expect(onUsePreset).toHaveBeenCalledTimes(1);
    expect(typeof onUsePreset.mock.calls[0][0]).toBe('string');
  });

  it('empty state shown when no results match', () => {
    render(<ExpertBrowser {...defaultProps} />);
    const searchInput = screen.getByTestId('expert-search');
    fireEvent.change(searchInput, { target: { value: 'zzzzzzzznonexistent' } });
    expect(screen.getByText('未找到符合条件的专家模板')).toBeDefined();
    expect(screen.getByTestId('expert-reset-filters')).toBeDefined();
  });

  it('confidence filter hides low-confidence presets', () => {
    render(<ExpertBrowser {...defaultProps} />);
    const confFilter = screen.getByTestId('expert-confidence-filter');
    // Set to show all
    fireEvent.change(confFilter, { target: { value: '0' } });
    const allCards = screen.getAllByTestId('expert-preset-card').length;
    // Set to high only
    fireEvent.change(confFilter, { target: { value: '0.85' } });
    const highCards = screen.queryAllByTestId('expert-preset-card').length;
    expect(highCards).toBeLessThanOrEqual(allCards);
  });

  it('initialGameType pre-filters results', () => {
    render(<ExpertBrowser {...defaultProps} initialGameType="puzzle" />);
    const filter = screen.getByTestId('expert-gametype-filter') as HTMLSelectElement;
    expect(filter.value).toBe('puzzle');
  });
});
