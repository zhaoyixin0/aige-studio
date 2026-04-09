/**
 * Tests for the StudioChatPanel asset library drawer integration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';
import { useAssetFulfillmentStore } from '@/store/asset-fulfillment-store';

vi.mock('@/app/hooks/use-conversation-manager', () => ({
  useConversationManager: () => ({ submitMessage: vi.fn() }),
}));

vi.mock('@/ui/assets/asset-browser', () => ({
  AssetBrowser: ({ onSelect }: { onSelect?: (id: string, src: string) => void }) => (
    <div data-testid="asset-browser">
      <button data-testid="asset-browser-pick" onClick={() => onSelect?.('demo', 'demo://x')}>
        Pick
      </button>
    </div>
  ),
}));

vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
Element.prototype.scrollIntoView = vi.fn();

const { StudioChatPanel } = await import('../studio-chat-panel');

describe('StudioChatPanel — asset library drawer', () => {
  beforeEach(() => {
    useEditorStore.setState({
      chatMessages: [],
      isChatLoading: false,
      suggestionChips: [],
    });
    useAssetFulfillmentStore.setState({ isActive: false, controller: null });
  });

  it('renders the asset library button in the input area', () => {
    render(<StudioChatPanel />);
    const btn = screen.getByRole('button', { name: /素材库|asset/i });
    expect(btn).toBeTruthy();
  });

  it('clicking the asset library button opens the drawer', () => {
    render(<StudioChatPanel />);
    expect(screen.queryByTestId('asset-browser')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /素材库|asset/i }));

    expect(screen.getByTestId('asset-browser')).toBeInTheDocument();
  });

  it('clicking the close button closes the drawer', () => {
    render(<StudioChatPanel />);
    fireEvent.click(screen.getByRole('button', { name: /素材库|asset/i }));
    expect(screen.getByTestId('asset-browser')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /关闭素材库|close asset/i }));
    expect(screen.queryByTestId('asset-browser')).toBeNull();
  });

  it('selecting an asset closes the drawer', () => {
    render(<StudioChatPanel />);
    fireEvent.click(screen.getByRole('button', { name: /素材库|asset/i }));
    fireEvent.click(screen.getByTestId('asset-browser-pick'));
    expect(screen.queryByTestId('asset-browser')).toBeNull();
  });
});
