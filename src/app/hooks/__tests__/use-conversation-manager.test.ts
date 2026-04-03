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

  it('propagates parameterCard from agent result to assistant message', async () => {
    const parameterCard = {
      category: 'game_mechanics',
      paramIds: ['spawn_rate', 'gravity'],
      title: 'Adjust mechanics',
    };

    mockProcess.mockResolvedValue({
      reply: 'Here is a parameter card',
      config: undefined,
      chips: undefined,
      parameterCard,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('tune params');
    });

    const messages = useEditorStore.getState().chatMessages;
    const assistantMsg = messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.parameterCard).toEqual(parameterCard);
  });

  it('sets l1Controls on assistant message when agent returns config', async () => {
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
      await result.current.submitMessage('create a game');
    });

    const messages = useEditorStore.getState().chatMessages;
    const assistantMsg = messages.find((m) => m.role === 'assistant' && m.content === 'Game created!');
    expect(assistantMsg?.l1Controls).toBe(true);
  });

  it('does not set l1Controls when agent returns no config', async () => {
    mockProcess.mockResolvedValue({
      reply: 'Just chatting',
      config: undefined,
      chips: undefined,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('hello');
    });

    const messages = useEditorStore.getState().chatMessages;
    const assistantMsg = messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.l1Controls).toBeUndefined();
  });

  it('sets isLoading to false even on error', async () => {
    mockProcess.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('test');
    });

    expect(useEditorStore.getState().isChatLoading).toBe(false);
  });

  /* ---------------------------------------------------------------- */
  /*  A3: Vague intent detection — gameTypeOptions                     */
  /* ---------------------------------------------------------------- */

  it('attaches gameTypeOptions when reply contains vague intent trigger', async () => {
    mockProcess.mockResolvedValue({
      reply: '请选择你想创建的游戏类型：',
      config: undefined,
      chips: undefined,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('做个游戏');
    });

    const messages = useEditorStore.getState().chatMessages;
    const assistantMsg = messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.gameTypeOptions).toBeDefined();
    expect(assistantMsg!.gameTypeOptions!.length).toBe(10);
    expect(assistantMsg!.gameTypeOptions!.map((o) => o.id)).toContain('catch');
    expect(assistantMsg!.gameTypeOptions!.map((o) => o.id)).toContain('dodge');
  });

  it('does not attach gameTypeOptions when reply has no vague intent trigger', async () => {
    mockProcess.mockResolvedValue({
      reply: '好的，我来帮你创建一个接住游戏！',
      config: undefined,
      chips: undefined,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('做个接住游戏');
    });

    const messages = useEditorStore.getState().chatMessages;
    const assistantMsg = messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.gameTypeOptions).toBeUndefined();
  });

  it('does not attach gameTypeOptions when config is present even with trigger phrase', async () => {
    const mockConfig = {
      version: '1.0.0',
      meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    };

    mockProcess.mockResolvedValue({
      reply: '请选择你想创建的游戏类型：',
      config: mockConfig,
      chips: undefined,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('test');
    });

    const messages = useEditorStore.getState().chatMessages;
    const assistantMsg = messages.find((m) => m.role === 'assistant' && m.content.includes('请选择'));
    expect(assistantMsg?.gameTypeOptions).toBeUndefined();
  });

  /* ---------------------------------------------------------------- */
  /*  A9: Fallback V2 chips when config exists but no chips            */
  /* ---------------------------------------------------------------- */

  it('sets fallback V2 chips when config exists but no chips returned', async () => {
    const mockConfig = {
      version: '1.0.0',
      meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
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
      await result.current.submitMessage('create a game');
    });

    const chips = useEditorStore.getState().suggestionChips;
    expect(chips.length).toBe(4);
    expect(chips[0].id).toBe('board_mode');
    expect(chips[0].type).toBe('board_mode');
    expect(chips.find((c) => c.id === 'l1-difficulty')).toBeTruthy();
    expect(chips.find((c) => c.id === 'l1-pacing')).toBeTruthy();
    expect(chips.find((c) => c.id === 'l1-emotion')).toBeTruthy();
  });

  it('sets fallback V2 chips when config exists but chips array is empty', async () => {
    const mockConfig = {
      version: '1.0.0',
      meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    };

    mockProcess.mockResolvedValue({
      reply: 'Game created!',
      config: mockConfig,
      chips: [],
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('create a game');
    });

    const chips = useEditorStore.getState().suggestionChips;
    expect(chips.length).toBe(4);
    expect(chips[0].type).toBe('board_mode');
  });

  it('does not set fallback chips when config and chips both exist', async () => {
    const mockConfig = {
      version: '1.0.0',
      meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    };

    const mockChips = [
      { id: 'custom1', label: 'Custom Chip' },
    ];

    mockProcess.mockResolvedValue({
      reply: 'Game created!',
      config: mockConfig,
      chips: mockChips,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('create a game');
    });

    const chips = useEditorStore.getState().suggestionChips;
    expect(chips).toEqual(mockChips);
  });
});
