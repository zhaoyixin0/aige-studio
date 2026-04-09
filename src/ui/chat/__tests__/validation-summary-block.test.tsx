import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ChatBlock } from '@/agent/conversation-defs';
import type { ChatMessage } from '@/store/editor-store';
import { useEditorStore } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';
import { ValidationSummaryBlock } from '../validation-summary-block';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type ValidationSummaryChatBlock = Extract<ChatBlock, { kind: 'validation-summary' }>;

const baseBlock: ValidationSummaryChatBlock = {
  kind: 'validation-summary',
  summary: '1 错误, 1 警告',
  issues: [
    {
      severity: 'error',
      title: '事件链断裂',
      description: '计分系统监听的事件不会被触发。',
    },
    {
      severity: 'warning',
      title: '参数已自动修正',
      description: 'Timer.duration 从 -5 修正为 30。',
    },
  ],
  fixable: true,
  resolved: false,
};

function addMessageWithBlock(
  messageId: string,
  block: ValidationSummaryChatBlock,
): void {
  const message: ChatMessage = {
    id: messageId,
    role: 'assistant',
    content: '配置验证发现问题',
    timestamp: Date.now(),
    blocks: [block],
  };
  useEditorStore.setState({ chatMessages: [message] });
}

function resetStores(): void {
  useEditorStore.setState({ chatMessages: [] });
  useGameStore.setState({ config: null });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ValidationSummaryBlock', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetStores();
  });

  it('renders summary text', () => {
    addMessageWithBlock('msg-1', baseBlock);
    render(<ValidationSummaryBlock block={baseBlock} messageId="msg-1" />);
    expect(screen.getByText(/1 错误/)).toBeDefined();
    expect(screen.getByText(/1 警告/)).toBeDefined();
  });

  it('renders error and warning issues with titles and descriptions', () => {
    addMessageWithBlock('msg-1', baseBlock);
    render(<ValidationSummaryBlock block={baseBlock} messageId="msg-1" />);
    expect(screen.getByText('事件链断裂')).toBeDefined();
    expect(screen.getByText('计分系统监听的事件不会被触发。')).toBeDefined();
    expect(screen.getByText('参数已自动修正')).toBeDefined();
    expect(screen.getByText('Timer.duration 从 -5 修正为 30。')).toBeDefined();
  });

  it('applies different severity styling to error vs warning items', () => {
    addMessageWithBlock('msg-1', baseBlock);
    render(<ValidationSummaryBlock block={baseBlock} messageId="msg-1" />);
    const errorItem = screen.getByTestId('validation-issue-0');
    const warningItem = screen.getByTestId('validation-issue-1');
    expect(errorItem.getAttribute('data-severity')).toBe('error');
    expect(warningItem.getAttribute('data-severity')).toBe('warning');
  });

  it('shows "修正这个" and "我了解了" buttons when not resolved and fixable', () => {
    addMessageWithBlock('msg-1', baseBlock);
    render(<ValidationSummaryBlock block={baseBlock} messageId="msg-1" />);
    expect(screen.getByRole('button', { name: '修正这个' })).toBeDefined();
    expect(screen.getByRole('button', { name: '我了解了' })).toBeDefined();
  });

  it('hides "修正这个" button when fixable is false', () => {
    const unfixable: ValidationSummaryChatBlock = { ...baseBlock, fixable: false };
    addMessageWithBlock('msg-1', unfixable);
    render(<ValidationSummaryBlock block={unfixable} messageId="msg-1" />);
    expect(screen.queryByRole('button', { name: '修正这个' })).toBeNull();
    expect(screen.getByRole('button', { name: '我了解了' })).toBeDefined();
  });

  it('"我了解了" button marks block as resolved in store', () => {
    addMessageWithBlock('msg-1', baseBlock);
    render(<ValidationSummaryBlock block={baseBlock} messageId="msg-1" />);

    fireEvent.click(screen.getByRole('button', { name: '我了解了' }));

    const updated = useEditorStore.getState().chatMessages[0];
    const updatedBlock = updated.blocks?.[0] as ValidationSummaryChatBlock;
    expect(updatedBlock.resolved).toBe(true);
  });

  it('"修正这个" button runs applyFixes, updates game config, and marks resolved', () => {
    // Seed a broken config with Timer.duration=-5 — validator auto-fixes to 30
    const brokenConfig = {
      version: '1.0.0',
      meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [
        { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: -5 } },
      ],
      assets: {},
    };
    useGameStore.setState({ config: brokenConfig as never });

    addMessageWithBlock('msg-1', baseBlock);
    render(<ValidationSummaryBlock block={baseBlock} messageId="msg-1" />);

    fireEvent.click(screen.getByRole('button', { name: '修正这个' }));

    const cfg = useGameStore.getState().config!;
    const timer = cfg.modules.find((m) => m.type === 'Timer');
    expect(timer?.params.duration).toBe(30);

    const updated = useEditorStore.getState().chatMessages[0];
    const updatedBlock = updated.blocks?.[0] as ValidationSummaryChatBlock;
    expect(updatedBlock.resolved).toBe(true);
  });

  it('renders green "已修正" state when block.resolved is true', () => {
    const resolved: ValidationSummaryChatBlock = { ...baseBlock, resolved: true };
    addMessageWithBlock('msg-1', resolved);
    render(<ValidationSummaryBlock block={resolved} messageId="msg-1" />);

    expect(screen.getByText(/已修正/)).toBeDefined();
    expect(screen.queryByRole('button', { name: '修正这个' })).toBeNull();
    expect(screen.queryByRole('button', { name: '我了解了' })).toBeNull();
  });
});
