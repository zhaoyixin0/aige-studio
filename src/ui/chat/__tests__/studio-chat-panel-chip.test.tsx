import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';
import type { Chip } from '@/store/editor-store';

/* ------------------------------------------------------------------ */
/*  Mock useConversationManager so we don't need the full agent stack  */
/* ------------------------------------------------------------------ */

const mockSubmitMessage = vi.fn();

vi.mock('@/app/hooks/use-conversation-manager', () => ({
  useConversationManager: () => ({ submitMessage: mockSubmitMessage }),
}));

// Mock crypto.randomUUID for deterministic test output
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

/* ------------------------------------------------------------------ */
/*  Import AFTER mocking                                               */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StudioChatPanel } = await import('../studio-chat-panel');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function setChips(chips: Chip[]): void {
  useEditorStore.setState({ suggestionChips: chips });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('StudioChatPanel — game_type chip generates GameTypeSelector message', () => {
  beforeEach(() => {
    useEditorStore.setState({
      chatMessages: [],
      isChatLoading: false,
      suggestionChips: [],
    });
    mockSubmitMessage.mockReset();
  });

  it('clicking a game_type chip adds an assistant message with gameTypeOptions', () => {
    const chips: Chip[] = [
      { id: 'catch', label: '接住游戏', emoji: '🎯', type: 'game_type' },
      { id: 'shooting', label: '射击游戏', emoji: '🔫', type: 'game_type' },
      { id: 'dodge', label: '躲避游戏', emoji: '💨', type: 'game_type' },
    ];
    setChips(chips);

    render(<StudioChatPanel />);

    fireEvent.click(screen.getByText('接住游戏'));

    // Should NOT call submitMessage for game_type chips
    expect(mockSubmitMessage).not.toHaveBeenCalled();

    // Should add an assistant message with gameTypeOptions
    const messages = useEditorStore.getState().chatMessages;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
    expect(messages[0].content).toBe('请选择游戏类型：');
    expect(messages[0].gameTypeOptions).toEqual([
      { id: 'catch', name: '接住游戏', emoji: '🎯' },
      { id: 'shooting', name: '射击游戏', emoji: '🔫' },
      { id: 'dodge', name: '躲避游戏', emoji: '💨' },
    ]);
  });

  it('does not interfere with param chip handling', () => {
    setChips([
      { id: 'catch', label: '接住游戏', emoji: '🎯', type: 'game_type' },
      { id: 'speed', label: '速度调节', emoji: '⚙️', type: 'param', paramId: 'player_speed' },
    ]);

    render(<StudioChatPanel />);

    fireEvent.click(screen.getByText('速度调节'));

    // param chips should still call submitMessage
    expect(mockSubmitMessage).toHaveBeenCalledWith('调整参数: 速度调节 [player_speed]');

    // No assistant message added directly for param chips
    expect(useEditorStore.getState().chatMessages).toHaveLength(0);
  });

  it('does not interfere with action chip handling', () => {
    setChips([
      { id: 'add-enemy', label: '添加敌人', emoji: '👾', type: 'action', action: 'add_enemy_wave' },
    ]);

    render(<StudioChatPanel />);

    fireEvent.click(screen.getByText('添加敌人'));

    expect(mockSubmitMessage).toHaveBeenCalledWith('执行操作: 添加敌人 [add_enemy_wave]');
    expect(useEditorStore.getState().chatMessages).toHaveLength(0);
  });

  it('game_type options include only game_type chips, not other types', () => {
    setChips([
      { id: 'catch', label: '接住游戏', emoji: '🎯', type: 'game_type' },
      { id: 'speed', label: '速度调节', emoji: '⚙️', type: 'param', paramId: 'speed' },
      { id: 'shooting', label: '射击游戏', emoji: '🔫', type: 'game_type' },
    ]);

    render(<StudioChatPanel />);

    fireEvent.click(screen.getByText('接住游戏'));

    const messages = useEditorStore.getState().chatMessages;
    expect(messages[0].gameTypeOptions).toHaveLength(2);
    expect(messages[0].gameTypeOptions).toEqual([
      { id: 'catch', name: '接住游戏', emoji: '🎯' },
      { id: 'shooting', name: '射击游戏', emoji: '🔫' },
    ]);
  });

  it('does nothing when isChatLoading is true', () => {
    setChips([
      { id: 'catch', label: '接住游戏', emoji: '🎯', type: 'game_type' },
    ]);
    useEditorStore.setState({ isChatLoading: true });

    render(<StudioChatPanel />);

    fireEvent.click(screen.getByText('接住游戏'));

    expect(mockSubmitMessage).not.toHaveBeenCalled();
    expect(useEditorStore.getState().chatMessages).toHaveLength(0);
  });
});
