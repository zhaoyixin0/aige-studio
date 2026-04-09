import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '../message-list';
import type { ChatMessage } from '@/store/editor-store';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockL1State = { difficulty: 'normal' as const, pacing: 50, emotion: 'cartoon' };
const mockSetL1State = vi.fn();
const mockConfig = {
  meta: { name: 'Catch', artStyle: 'cartoon', theme: 'fruit' },
  modules: [],
  assets: {},
};
const mockSetConfig = vi.fn();
const mockBatchUpdateParams = vi.fn();

vi.mock('@/store/editor-store', async () => {
  const actual = await vi.importActual<typeof import('@/store/editor-store')>(
    '@/store/editor-store',
  );
  return {
    ...actual,
    useEditorStore: vi.fn((selector: (s: any) => any) =>
      selector({
        l1State: mockL1State,
        setL1State: mockSetL1State,
      }),
    ),
  };
});

vi.mock('@/store/game-store', () => ({
  useGameStore: vi.fn((selector: (s: any) => any) =>
    selector({
      config: mockConfig,
      setConfig: mockSetConfig,
      batchUpdateParams: mockBatchUpdateParams,
    }),
  ),
}));

vi.mock('../l1-experience-card', () => ({
  L1ExperienceCard: (props: any) => (
    <div data-testid="l1-experience-card" data-difficulty={props.difficulty} />
  ),
}));

vi.mock('../bespoke-cards', () => ({
  BespokeParamCard: (props: any) => (
    <div
      data-testid="gui-param-card-mock"
      data-category={props.category}
      data-param-ids={props.paramIds.join(',')}
    />
  ),
}));

vi.mock('../game-type-selector', () => ({
  GameTypeSelector: (props: any) => (
    <div
      data-testid="game-type-selector"
      data-options={JSON.stringify(props.options)}
    />
  ),
}));

vi.mock('../chat-block-renderer', () => ({
  ChatBlockRenderer: (props: any) => (
    <div
      data-testid="chat-block-renderer"
      data-message-id={props.messageId ?? ''}
      data-block-count={props.blocks?.length ?? 0}
    />
  ),
}));

vi.mock('@/engine/core/composite-mapper', () => ({
  applyL1Preset: vi.fn(() => []),
}));

vi.mock('@/data/registry-binding', () => ({
  getLiveValuesForParams: vi.fn(() => ({})),
  planUpdatesForParamChange: vi.fn(() => ({ params: [] })),
}));

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
    vi.clearAllMocks();
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

  /* ---------------------------------------------------------------- */
  /*  Card rendering                                                   */
  /* ---------------------------------------------------------------- */

  it('renders L1ExperienceCard when assistant message has l1Controls: true', () => {
    const messages = [makeMessage({ role: 'assistant', l1Controls: true })];
    render(<MessageList messages={messages} isLoading={false} />);
    expect(screen.getByTestId('l1-experience-card')).toBeInTheDocument();
  });

  it('renders GuiParamCard when assistant message has parameterCard', () => {
    const messages = [
      makeMessage({
        role: 'assistant',
        parameterCard: {
          category: 'game_mechanics',
          paramIds: ['game_mechanics_009', 'game_mechanics_010'],
          title: 'Scoring',
        },
      }),
    ];
    render(<MessageList messages={messages} isLoading={false} />);
    const card = screen.getByTestId('gui-param-card-mock');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('data-category', 'game_mechanics');
  });

  it('renders GameTypeSelector when assistant message has gameTypeOptions', () => {
    const options = [
      { id: 'catch', name: 'Catch Game' },
      { id: 'dodge', name: 'Dodge Game' },
    ];
    const messages = [makeMessage({ role: 'assistant', gameTypeOptions: options })];
    render(<MessageList messages={messages} isLoading={false} />);
    expect(screen.getByTestId('game-type-selector')).toBeInTheDocument();
  });

  it('does NOT render cards for user messages', () => {
    const messages = [
      makeMessage({
        role: 'user',
        l1Controls: true,
        parameterCard: { category: 'game_mechanics', paramIds: ['game_mechanics_009'] },
        gameTypeOptions: [{ id: 'catch', name: 'Catch' }],
      }),
    ];
    render(<MessageList messages={messages} isLoading={false} />);
    expect(screen.queryByTestId('l1-experience-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gui-param-card-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('game-type-selector')).not.toBeInTheDocument();
  });

  it('does NOT render cards when fields are undefined', () => {
    const messages = [makeMessage({ role: 'assistant', content: 'Just a plain message' })];
    render(<MessageList messages={messages} isLoading={false} />);
    expect(screen.queryByTestId('l1-experience-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gui-param-card-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('game-type-selector')).not.toBeInTheDocument();
  });

  /* ---------------------------------------------------------------- */
  /*  ChatBlockRenderer messageId threading                            */
  /* ---------------------------------------------------------------- */

  it('passes message.id as messageId prop to ChatBlockRenderer', () => {
    const messageId = 'test-message-id-123';
    const messages: ChatMessage[] = [
      makeMessage({
        id: messageId,
        role: 'assistant',
        content: 'msg with blocks',
        blocks: [
          {
            kind: 'validation-summary',
            summary: '1 错误',
            issues: [{ severity: 'error', title: 'x', description: 'y' }],
            fixable: false,
          },
        ],
      }),
    ];

    render(<MessageList messages={messages} isLoading={false} />);

    const renderer = screen.getByTestId('chat-block-renderer');
    expect(renderer).toHaveAttribute('data-message-id', messageId);
    expect(renderer).toHaveAttribute('data-block-count', '1');
  });
});
