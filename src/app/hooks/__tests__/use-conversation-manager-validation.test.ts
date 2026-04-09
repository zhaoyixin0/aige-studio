import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';
import type { ChatBlock } from '@/agent/conversation-defs';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockProcess = vi.fn();
const mockFulfillAssets = vi.fn();

vi.mock('@/agent/singleton', () => ({
  getConversationAgent: () => ({
    process: mockProcess,
  }),
}));

vi.mock('@/services/asset-agent', () => ({
  AssetAgent: vi.fn().mockImplementation(() => ({
    fulfillAssets: mockFulfillAssets,
  })),
}));

vi.mock('@/app/hooks/use-engine', () => ({
  useEngineContext: () => ({
    engineRef: { current: null },
  }),
}));

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
  useGameStore.setState({ config: null });
}

function findValidationSummaryBlock(
  blocks: ChatBlock[] | undefined,
): Extract<ChatBlock, { kind: 'validation-summary' }> | undefined {
  return blocks?.find(
    (b): b is Extract<ChatBlock, { kind: 'validation-summary' }> =>
      b.kind === 'validation-summary',
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('useConversationManager — validation summary injection', () => {
  beforeEach(() => {
    resetStores();
    mockProcess.mockReset();
    mockFulfillAssets.mockReset();
    mockFulfillAssets.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects a validation-summary assistant message when report has warnings', async () => {
    // Config with Timer.duration=-5 → auto-fix warning produced by validator
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
      reply: 'Here is your game',
      config: badConfig as never,
      chips: undefined,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('make a broken game');
    });

    const messages = useEditorStore.getState().chatMessages;

    // Find a message that has a validation-summary block
    const validationMsg = messages.find(
      (m) => m.role === 'assistant' && findValidationSummaryBlock(m.blocks),
    );
    expect(validationMsg).toBeDefined();

    const block = findValidationSummaryBlock(validationMsg!.blocks)!;
    expect(block.kind).toBe('validation-summary');
    expect(block.issues.length).toBeGreaterThan(0);
    expect(block.fixable).toBe(true);
    // Title comes from translateIssue (CATEGORY_TITLES)
    expect(block.issues.some((i) => i.title === '参数已自动修正')).toBe(true);
  });

  it('does not inject a validation-summary message when report is clean', async () => {
    const cleanConfig = {
      version: '1.0.0',
      meta: { name: 'Clean', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    } as const;

    mockProcess.mockResolvedValue({
      reply: 'Clean game',
      config: cleanConfig as never,
      chips: undefined,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('make a clean game');
    });

    const messages = useEditorStore.getState().chatMessages;
    const validationMsg = messages.find(
      (m) => m.role === 'assistant' && findValidationSummaryBlock(m.blocks),
    );
    expect(validationMsg).toBeUndefined();
  });

  it('does not inject a validation-summary message when agent returns no config', async () => {
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
    const validationMsg = messages.find(
      (m) => m.role === 'assistant' && findValidationSummaryBlock(m.blocks),
    );
    expect(validationMsg).toBeUndefined();
  });

  it('uses translateIssue output for issue titles (Chinese)', async () => {
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
      reply: 'Done',
      config: badConfig as never,
      chips: undefined,
    });

    const { result } = renderHook(() => useConversationManager());

    await act(async () => {
      await result.current.submitMessage('broken');
    });

    const messages = useEditorStore.getState().chatMessages;
    const validationMsg = messages.find(
      (m) => m.role === 'assistant' && findValidationSummaryBlock(m.blocks),
    );
    const block = findValidationSummaryBlock(validationMsg!.blocks)!;

    // translateIssue maps 'invalid-param' → '参数已自动修正'
    const paramIssue = block.issues.find((i) => i.title === '参数已自动修正');
    expect(paramIssue).toBeDefined();
    expect(paramIssue!.description.length).toBeGreaterThan(0);
  });
});
