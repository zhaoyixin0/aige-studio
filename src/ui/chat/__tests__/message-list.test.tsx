import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '../message-list';
import type { ChatMessage } from '@/store/editor-store';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeMessage(
  overrides: Partial<ChatMessage> & { role: ChatMessage['role'] },
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    content: 'test message',
    timestamp: Date.now(),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('MessageList', () => {
  beforeEach(() => {
    // Reset scrollIntoView mock
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders an array of ChatMessages as message bubbles', () => {
    const messages: ChatMessage[] = [
      makeMessage({ role: 'user', content: 'Hello' }),
      makeMessage({ role: 'assistant', content: 'Hi there!' }),
      makeMessage({ role: 'user', content: 'How are you?' }),
    ];

    render(<MessageList messages={messages} isLoading={false} />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
    expect(screen.getByText('How are you?')).toBeInTheDocument();
  });

  it('distinguishes user vs assistant messages by alignment', () => {
    const messages: ChatMessage[] = [
      makeMessage({ role: 'user', content: 'user-msg' }),
      makeMessage({ role: 'assistant', content: 'assistant-msg' }),
    ];

    render(
      <MessageList messages={messages} isLoading={false} />,
    );

    // User messages should be right-aligned (justify-end)
    const userBubbleWrapper = screen.getByText('user-msg').closest('[class*="justify-"]');
    expect(userBubbleWrapper?.className).toContain('justify-end');

    // Assistant messages should be left-aligned (justify-start)
    const assistantBubbleWrapper = screen.getByText('assistant-msg').closest('[class*="justify-"]');
    expect(assistantBubbleWrapper?.className).toContain('justify-start');
  });

  it('distinguishes user vs assistant messages by styling', () => {
    const messages: ChatMessage[] = [
      makeMessage({ role: 'user', content: 'user-styled' }),
      makeMessage({ role: 'assistant', content: 'assistant-styled' }),
    ];

    render(<MessageList messages={messages} isLoading={false} />);

    // User bubble uses bg-blue-600
    const userBubble = screen.getByText('user-styled').closest('[class*="bg-"]');
    expect(userBubble?.className).toContain('bg-blue-600');

    // Assistant bubble uses bg-white/5
    const assistantBubble = screen.getByText('assistant-styled').closest('[class*="bg-"]');
    expect(assistantBubble?.className).toContain('bg-white/5');
  });

  it('auto-scrolls to bottom when messages change', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const messages: ChatMessage[] = [
      makeMessage({ role: 'user', content: 'first' }),
    ];

    const { rerender } = render(
      <MessageList messages={messages} isLoading={false} />,
    );

    // scrollIntoView called on initial render
    expect(scrollIntoView).toHaveBeenCalled();
    scrollIntoView.mockClear();

    // Add a new message and re-render
    const updated = [
      ...messages,
      makeMessage({ role: 'assistant', content: 'second' }),
    ];

    rerender(<MessageList messages={updated} isLoading={false} />);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('renders empty state when no messages', () => {
    const { container } = render(
      <MessageList messages={[]} isLoading={false} />,
    );

    // Should render the container but with no message bubbles
    const messageContainer = container.querySelector('[class*="overflow-y-auto"]');
    expect(messageContainer).toBeInTheDocument();

    // No bubble text should be present
    expect(container.querySelectorAll('.whitespace-pre-wrap')).toHaveLength(0);
  });

  it('shows loading indicator when isLoading is true', () => {
    render(<MessageList messages={[]} isLoading={true} />);

    expect(screen.getByText('思考中...')).toBeInTheDocument();
  });

  it('hides loading indicator when isLoading is false', () => {
    render(<MessageList messages={[]} isLoading={false} />);

    expect(screen.queryByText('思考中...')).not.toBeInTheDocument();
  });
});
