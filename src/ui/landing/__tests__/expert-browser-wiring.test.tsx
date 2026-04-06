import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';

// Mock heavy dependencies to keep tests fast
vi.mock('@/agent/singleton', () => ({
  getConversationAgent: () => ({ process: vi.fn() }),
}));
vi.mock('@/services/asset-agent', () => ({
  AssetAgent: vi.fn().mockImplementation(() => ({ fulfillAssets: vi.fn().mockResolvedValue({}) })),
}));
vi.mock('@/app/hooks/use-engine', () => ({
  useEngineContext: () => ({ loadConfig: vi.fn() }),
}));
vi.mock('@/store/game-store', () => ({
  useGameStore: Object.assign(
    (sel: (s: Record<string, unknown>) => unknown) => sel({ config: null, setConfig: vi.fn(), batchUpdateAssets: vi.fn() }),
    { getState: () => ({ config: null }) },
  ),
}));
vi.mock('@/ui/chat/suggestion-chips', () => ({
  SuggestionChips: () => <div data-testid="suggestion-chips" />,
}));
vi.mock('@/ui/experts/featured-expert-chip', () => ({
  FeaturedExpertChip: ({ onUse }: { onUse: (id: string) => void }) => (
    <button data-testid="featured-chip" onClick={() => onUse('test-preset')}>Featured</button>
  ),
}));
vi.mock('@/ui/experts/expert-browser', () => ({
  ExpertBrowser: ({ isOpen, onClose, onUsePreset }: { isOpen: boolean; onClose: () => void; onUsePreset: (id: string) => void }) =>
    isOpen ? (
      <div data-testid="expert-browser-modal">
        <button data-testid="expert-close" onClick={onClose}>Close</button>
        <button data-testid="expert-use" onClick={() => onUsePreset('preset-123')}>Use</button>
      </div>
    ) : null,
}));

import { LandingPage } from '../landing-page';

beforeEach(() => {
  useEditorStore.setState({
    expertBrowserOpen: false,
    expertBrowserGameType: null,
    chatMessages: [],
    suggestionChips: [],
    isChatLoading: false,
  });
});

describe('LandingPage expert browser wiring', () => {
  it('renders a "浏览全部专家模板" button', () => {
    render(<LandingPage />);
    expect(screen.getByText('浏览全部专家模板')).toBeInTheDocument();
  });

  it('clicking browse button opens ExpertBrowser', () => {
    render(<LandingPage />);
    fireEvent.click(screen.getByText('浏览全部专家模板'));
    expect(screen.getByTestId('expert-browser-modal')).toBeInTheDocument();
  });

  it('closing ExpertBrowser sets state to false', () => {
    useEditorStore.setState({ expertBrowserOpen: true });
    render(<LandingPage />);
    fireEvent.click(screen.getByTestId('expert-close'));
    expect(useEditorStore.getState().expertBrowserOpen).toBe(false);
  });
});
