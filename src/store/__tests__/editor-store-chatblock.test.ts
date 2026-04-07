import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/store/editor-store';
import type { ChatBlock, Attachment } from '@/agent/conversation-defs';

// Reset store state before each test to avoid shared state
beforeEach(() => {
  useEditorStore.setState({
    chatMessages: [],
    pendingAttachments: [],
  });
});

describe('ChatMessage blocks and attachments fields', () => {
  it('ChatMessage with blocks field accepted by addChatMessage', () => {
    const blocks: ChatBlock[] = [
      {
        kind: 'progress-log',
        entries: [
          { key: 'item_1', status: 'done', message: '已完成' },
        ],
      },
    ];

    useEditorStore.getState().addChatMessage({
      id: 'msg_1',
      role: 'assistant',
      content: '生成完成',
      blocks,
      timestamp: Date.now(),
    });

    const messages = useEditorStore.getState().chatMessages;
    expect(messages).toHaveLength(1);
    expect(messages[0].blocks).toEqual(blocks);
  });

  it('ChatMessage with attachments field accepted', () => {
    const attachments: Attachment[] = [
      {
        id: 'att_1',
        type: 'image',
        src: 'data:image/png;base64,abc',
        from: 'ai',
        target: 'player',
        name: 'player.png',
      },
    ];

    useEditorStore.getState().addChatMessage({
      id: 'msg_2',
      role: 'assistant',
      content: '图片已生成',
      attachments,
      timestamp: Date.now(),
    });

    const messages = useEditorStore.getState().chatMessages;
    expect(messages).toHaveLength(1);
    expect(messages[0].attachments).toEqual(attachments);
  });

  it('ChatMessage without blocks or attachments stores undefined for both fields', () => {
    useEditorStore.getState().addChatMessage({
      id: 'msg_3',
      role: 'user',
      content: '创建一个接水果游戏',
      timestamp: Date.now(),
    });

    const messages = useEditorStore.getState().chatMessages;
    expect(messages).toHaveLength(1);
    expect(messages[0].blocks).toBeUndefined();
    expect(messages[0].attachments).toBeUndefined();
  });
});

describe('pendingAttachments state', () => {
  it('pendingAttachments initial state is empty array', () => {
    expect(useEditorStore.getState().pendingAttachments).toEqual([]);
  });

  it('addPendingAttachment appends to pendingAttachments', () => {
    const att1: Attachment = {
      id: 'att_1',
      type: 'image',
      src: 'blob:http://localhost/1',
      from: 'user',
    };
    const att2: Attachment = {
      id: 'att_2',
      type: 'audio',
      src: 'blob:http://localhost/2',
      from: 'user',
    };

    useEditorStore.getState().addPendingAttachment(att1);
    useEditorStore.getState().addPendingAttachment(att2);

    const { pendingAttachments } = useEditorStore.getState();
    expect(pendingAttachments).toHaveLength(2);
    expect(pendingAttachments[0]).toEqual(att1);
    expect(pendingAttachments[1]).toEqual(att2);
  });

  it('addPendingAttachment does not mutate existing array', () => {
    const att: Attachment = {
      id: 'att_1',
      type: 'image',
      src: 'blob:http://localhost/1',
      from: 'user',
    };

    const before = useEditorStore.getState().pendingAttachments;
    useEditorStore.getState().addPendingAttachment(att);
    const after = useEditorStore.getState().pendingAttachments;

    // Immutability: must be a different array reference
    expect(after).not.toBe(before);
  });

  it('clearPendingAttachments resets to empty array', () => {
    const att: Attachment = {
      id: 'att_1',
      type: 'image',
      src: 'blob:http://localhost/1',
      from: 'user',
    };

    useEditorStore.getState().addPendingAttachment(att);
    expect(useEditorStore.getState().pendingAttachments).toHaveLength(1);

    useEditorStore.getState().clearPendingAttachments();
    expect(useEditorStore.getState().pendingAttachments).toEqual([]);
  });
});
