import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SuggestionChips } from '../suggestion-chips.tsx';
import { useEditorStore } from '@/store/editor-store';

describe('SuggestionChips thumbnails', () => {
  beforeEach(() => {
    useEditorStore.setState({ setBoardModeOpen: vi.fn() });
  });

  it('renders thumbnail image when chip has thumbnail', () => {
    useEditorStore.setState({
      suggestionChips: [
        { id: 'test', label: 'Test chip', thumbnail: 'https://example.com/thumb.png', type: 'action' },
      ],
    });
    render(<SuggestionChips onChipClick={() => {}} />);
    const img = screen.getByTestId('chip-thumbnail');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('https://example.com/thumb.png');
  });

  it('renders emoji when chip has no thumbnail', () => {
    useEditorStore.setState({
      suggestionChips: [
        { id: 'test', label: 'Test', emoji: '🎮', type: 'game_type' },
      ],
    });
    const { container } = render(<SuggestionChips onChipClick={() => {}} />);
    expect(container.textContent).toContain('🎮');
    expect(screen.queryByTestId('chip-thumbnail')).toBeNull();
  });

  it('thumbnail takes priority over emoji', () => {
    useEditorStore.setState({
      suggestionChips: [
        { id: 'test', label: 'Test', emoji: '🎮', thumbnail: 'https://example.com/img.png', type: 'action' },
      ],
    });
    render(<SuggestionChips onChipClick={() => {}} />);
    expect(screen.getByTestId('chip-thumbnail')).toBeDefined();
    // Emoji should NOT render when thumbnail is present
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].textContent).not.toContain('🎮');
  });

  it('backward compatible: chips without thumbnail render normally', () => {
    useEditorStore.setState({
      suggestionChips: [
        { id: 'a', label: 'No thumb', type: 'game_type' },
        { id: 'b', label: 'With emoji', emoji: '⚡', type: 'preset' },
      ],
    });
    render(<SuggestionChips onChipClick={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(screen.queryAllByTestId('chip-thumbnail')).toHaveLength(0);
  });
});
