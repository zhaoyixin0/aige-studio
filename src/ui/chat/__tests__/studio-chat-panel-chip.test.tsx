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

  it('clicking a game_type chip adds an assistant message with the FULL game type catalog', () => {
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

    // Should add an assistant message with FULL catalog (not just chip subset)
    const messages = useEditorStore.getState().chatMessages;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
    expect(messages[0].content).toBe('请选择游戏类型：');

    type FullOpt = {
      id: string;
      name: string;
      emoji?: string;
      category?: string;
      supportedToday?: boolean;
    };
    const options = (messages[0].gameTypeOptions ?? []) as FullOpt[];
    // Catalog has 38 game types — far more than the 3 chips
    expect(options.length).toBeGreaterThanOrEqual(15);
    // Each option carries id/name/category from the catalog
    for (const opt of options) {
      expect(typeof opt.id).toBe('string');
      expect(typeof opt.name).toBe('string');
      expect(opt.category).toBeTruthy();
    }
    // Known supported types are present and marked supportedToday
    const catchOpt = options.find((o) => o.id === 'catch');
    expect(catchOpt?.supportedToday).toBe(true);
    const shootingOpt = options.find((o) => o.id === 'shooting');
    expect(shootingOpt?.supportedToday).toBe(true);
    const platformerOpt = options.find((o) => o.id === 'platformer');
    expect(platformerOpt?.supportedToday).toBe(true);
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

  it('uses the full catalog regardless of which non-game_type chips are present', () => {
    setChips([
      { id: 'catch', label: '接住游戏', emoji: '🎯', type: 'game_type' },
      { id: 'speed', label: '速度调节', emoji: '⚙️', type: 'param', paramId: 'speed' },
      { id: 'shooting', label: '射击游戏', emoji: '🔫', type: 'game_type' },
    ]);

    render(<StudioChatPanel />);

    fireEvent.click(screen.getByText('接住游戏'));

    const messages = useEditorStore.getState().chatMessages;
    const options = messages[0].gameTypeOptions ?? [];
    // Catalog far exceeds the 2 game_type chips above
    expect(options.length).toBeGreaterThanOrEqual(15);
    // The catalog includes ids that were NOT in the chip subset
    expect(options.some((o) => o.id === 'rhythm')).toBe(true);
    expect(options.some((o) => o.id === 'puzzle')).toBe(true);
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
