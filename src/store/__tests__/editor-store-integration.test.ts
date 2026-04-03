import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../editor-store';
import { DEFAULT_CHIPS } from '../editor-store';
import type { ChatMessage } from '../editor-store';

describe('ChatMessage gameTypeOptions', () => {
  beforeEach(() => {
    useEditorStore.setState({ chatMessages: [] });
  });

  it('ChatMessage accepts gameTypeOptions field', () => {
    const msg: ChatMessage = {
      id: 'msg-gto-1',
      role: 'assistant',
      content: 'Choose a game type',
      timestamp: Date.now(),
      gameTypeOptions: [
        { id: 'catch', name: '接住游戏', emoji: '🎯' },
        { id: 'dodge', name: '躲避游戏' },
      ],
    };
    expect(msg.gameTypeOptions).toHaveLength(2);
    expect(msg.gameTypeOptions![0]).toEqual({ id: 'catch', name: '接住游戏', emoji: '🎯' });
    expect(msg.gameTypeOptions![1].emoji).toBeUndefined();
  });

  it('ChatMessage works without gameTypeOptions (backward compatible)', () => {
    const msg: ChatMessage = {
      id: 'msg-gto-2',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    };
    expect(msg.gameTypeOptions).toBeUndefined();
  });

  it('addChatMessage stores gameTypeOptions correctly', () => {
    const msg: ChatMessage = {
      id: 'msg-gto-3',
      role: 'assistant',
      content: 'Pick a type',
      timestamp: Date.now(),
      gameTypeOptions: [
        { id: 'tap', name: '点击游戏', emoji: '👆' },
      ],
    };

    useEditorStore.getState().addChatMessage(msg);

    const stored = useEditorStore.getState().chatMessages;
    expect(stored).toHaveLength(1);
    expect(stored[0].gameTypeOptions).toEqual([
      { id: 'tap', name: '点击游戏', emoji: '👆' },
    ]);
  });
});

describe('DEFAULT_CHIPS type field', () => {
  it('all DEFAULT_CHIPS have type === "game_type"', () => {
    for (const chip of DEFAULT_CHIPS) {
      expect(chip.type).toBe('game_type');
    }
  });

  it('DEFAULT_CHIPS count matches expected length', () => {
    expect(DEFAULT_CHIPS.length).toBe(10);
  });
});
