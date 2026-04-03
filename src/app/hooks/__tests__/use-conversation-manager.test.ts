import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';

/* ------------------------------------------------------------------ */
/*  Mocks — must be set up before importing the hook                   */
/* ------------------------------------------------------------------ */

const mockProcess = vi.fn();
const mockFulfillAssets = vi.fn();

// Mock the conversation agent singleton
vi.mock('@/agent/singleton', () => ({
  getConversationAgent: () => ({
    process: mockProcess,
  }),
}));

// Mock the asset agent
vi.mock('@/services/asset-agent', () => ({
  AssetAgent: vi.fn().mockImplementation(() => ({
    fulfillAssets: mockFulfillAssets,
  })),
}));

// Mock the engine context
vi.mock('@/app/hooks/use-engine', () => ({
  useEngineContext: () => ({
    engineRef: { current: null },
  }),
}));

// Import hook after mocks
import { useConversationManager } from '../use-conversation-manager';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function resetStores(): void {
  useEditorStore.setState({
    chatMessages: [],
    isChatLoading: false,
    suggestionChips: [],
  });
  useGameStore.setState({
    config: null,
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('useConversationManager', () => {
  beforeEach(() => {
    resetStores();
    mockProcess.mockReset();
    mockFulfillAssets.mockReset();
    mockFulfillAssets.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submitMessage adds user message to store and calls agent', async () => {
    mockProcess.mockResolvedValue({
      reply: 'Hello from assistant',
      config: undefined,
      chips: undefined,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('Hello');
    });

    const messages = useEditorStore.getState().chatMessages;

    // Should have user message + assistant reply
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hello from assistant');

    // Agent should have been called with the text
    expect(mockProcess).toHaveBeenCalledWith('Hello', undefined);
  });

  it('handles agent error gracefully by adding error message', async () => {
    mockProcess.mockRejectedValue(new Error('API failure'));

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('test');
    });

    const messages = useEditorStore.getState().chatMessages;

    // User message + error message
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toContain('出错了');
    expect(messages[1].content).toContain('API failure');
  });

  it('sets isLoading during agent call', async () => {
    // Make the agent hang until we resolve
    let resolveProcess!: (value: unknown) => void;
    mockProcess.mockReturnValue(
      new Promise((resolve) => {
        resolveProcess = resolve;
      }),
    );

    const { result } = renderHook(() => useConversationManager());

    // Start submit but don't await
    let submitPromise: Promise<void>;
    act(() => {
      submitPromise = result.current.submitMessage('test');
    });

    // Loading should be true while agent is processing
    expect(useEditorStore.getState().isChatLoading).toBe(true);

    // Resolve the agent
    await act(async () => {
      resolveProcess({ reply: 'done', config: undefined, chips: undefined });
      await submitPromise!;
    });

    // Loading should be false after completion
    expect(useEditorStore.getState().isChatLoading).toBe(false);
  });

  it('applies config when agent returns one', async () => {
    const mockConfig = {
      version: '1.0.0',
      meta: { name: 'Test Game', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    };

    mockProcess.mockResolvedValue({
      reply: 'Game created!',
      config: mockConfig,
      chips: undefined,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('make a game');
    });

    // Config should be applied to game store
    expect(useGameStore.getState().config).toEqual(mockConfig);
  });

  it('validates and auto-fixes returned config before applying', async () => {
    const badConfig = {
      version: '1.0.0',
      meta: { name: 'Bad', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [
        { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: -5 } },
      ],
      assets: {},
    } as const;

    mockProcess.mockResolvedValue({
      reply: 'Updated',
      config: badConfig as any,
      chips: undefined,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('apply changes');
    });

    const cfg = useGameStore.getState().config!;
    const timer = cfg.modules.find((m) => m.type === 'Timer');
    expect(timer).toBeTruthy();
    expect(timer!.params.duration).toBe(30); // auto-fixed
  });

  it('updates suggestion chips when agent returns them', async () => {
    const mockChips = [
      { id: 'chip1', label: 'Chip 1' },
      { id: 'chip2', label: 'Chip 2', emoji: '🎮' },
    ];

    mockProcess.mockResolvedValue({
      reply: 'Here are suggestions',
      config: undefined,
      chips: mockChips,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('suggest something');
    });

    expect(useEditorStore.getState().suggestionChips).toEqual(mockChips);
  });

  it('sets isLoading to false even on error', async () => {
    mockProcess.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('test');
    });

    expect(useEditorStore.getState().isChatLoading).toBe(false);
  });
});
