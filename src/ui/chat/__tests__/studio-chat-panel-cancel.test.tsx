/**
 * Tests for the StudioChatPanel send/stop button toggle.
 * When asset fulfillment is active, the send button is replaced by a stop
 * button that calls the cancel function.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';
import { useAssetFulfillmentStore } from '@/store/asset-fulfillment-store';

// Mock conversation manager so studio-chat-panel works in isolation
vi.mock('@/app/hooks/use-conversation-manager', () => ({
  useConversationManager: () => ({ submitMessage: vi.fn() }),
}));

vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
Element.prototype.scrollIntoView = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StudioChatPanel } = await import('../studio-chat-panel');

describe('StudioChatPanel — send / stop button toggle', () => {
  beforeEach(() => {
    useEditorStore.setState({
      chatMessages: [],
      isChatLoading: false,
      suggestionChips: [],
    });
    useAssetFulfillmentStore.setState({ isActive: false, controller: null });
  });

  it('renders the send button when no fulfillment is active', () => {
    render(<StudioChatPanel />);

    const sendBtn = screen.getByRole('button', { name: /发送|send/i });
    expect(sendBtn).toBeTruthy();
    expect(screen.queryByRole('button', { name: /停止|stop/i })).toBeNull();
  });

  it('renders the stop button when isActive is true', () => {
    useAssetFulfillmentStore.setState({
      isActive: true,
      controller: { cancel: vi.fn() },
    });

    render(<StudioChatPanel />);

    const stopBtn = screen.getByRole('button', { name: /停止|stop/i });
    expect(stopBtn).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^发送$|^send$/i })).toBeNull();
  });

  it('clicking the stop button calls the registered cancel handler', () => {
    const cancelSpy = vi.fn();
    useAssetFulfillmentStore.setState({
      isActive: true,
      controller: { cancel: cancelSpy },
    });

    render(<StudioChatPanel />);

    fireEvent.click(screen.getByRole('button', { name: /停止|stop/i }));
    expect(cancelSpy).toHaveBeenCalledOnce();
  });

  it('switches back to the send button after isActive becomes false', () => {
    useAssetFulfillmentStore.setState({
      isActive: true,
      controller: { cancel: vi.fn() },
    });

    const { rerender } = render(<StudioChatPanel />);
    expect(screen.getByRole('button', { name: /停止|stop/i })).toBeTruthy();

    useAssetFulfillmentStore.setState({ isActive: false, controller: null });
    rerender(<StudioChatPanel />);

    expect(screen.queryByRole('button', { name: /停止|stop/i })).toBeNull();
    expect(screen.getByRole('button', { name: /发送|send/i })).toBeTruthy();
  });
});
