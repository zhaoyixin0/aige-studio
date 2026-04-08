import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore, type ChatMessage } from '@/store/editor-store';

beforeEach(() => {
  useEditorStore.setState({ chatMessages: [] });
});

function seed(messages: ChatMessage[]) {
  useEditorStore.setState({ chatMessages: messages });
}

describe('editor-store updateChatMessage action', () => {
  it('replaces matching message immutably', () => {
    const original: ChatMessage = {
      id: 'm1',
      role: 'assistant',
      content: 'hello',
      timestamp: 1,
    };
    seed([original]);

    useEditorStore
      .getState()
      .updateChatMessage('m1', (msg) => ({ ...msg, content: 'updated' }));

    const messages = useEditorStore.getState().chatMessages;
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('updated');
    // Immutability: the original reference must not be mutated
    expect(original.content).toBe('hello');
    // And the replaced entry is a different reference
    expect(messages[0]).not.toBe(original);
  });

  it('preserves other messages unchanged', () => {
    const m1: ChatMessage = { id: 'm1', role: 'user', content: 'a', timestamp: 1 };
    const m2: ChatMessage = { id: 'm2', role: 'assistant', content: 'b', timestamp: 2 };
    const m3: ChatMessage = { id: 'm3', role: 'assistant', content: 'c', timestamp: 3 };
    seed([m1, m2, m3]);

    useEditorStore
      .getState()
      .updateChatMessage('m2', (msg) => ({ ...msg, content: 'B!' }));

    const messages = useEditorStore.getState().chatMessages;
    expect(messages).toHaveLength(3);
    expect(messages[0]).toBe(m1); // unchanged reference
    expect(messages[1].content).toBe('B!');
    expect(messages[2]).toBe(m3); // unchanged reference
  });

  it('updateChatMessage on non-existent id is a no-op (does not throw)', () => {
    const m1: ChatMessage = { id: 'm1', role: 'user', content: 'a', timestamp: 1 };
    seed([m1]);

    expect(() =>
      useEditorStore
        .getState()
        .updateChatMessage('nope', (msg) => ({ ...msg, content: 'x' })),
    ).not.toThrow();

    const messages = useEditorStore.getState().chatMessages;
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('a');
  });

  it('updater receives the current message and its return value replaces it', () => {
    const m1: ChatMessage = {
      id: 'm1',
      role: 'assistant',
      content: 'start',
      timestamp: 42,
      blocks: [
        { kind: 'progress-log', entries: [{ key: 'k1', status: 'pending', message: '...' }] },
      ],
    };
    seed([m1]);

    let received: ChatMessage | null = null;
    useEditorStore.getState().updateChatMessage('m1', (msg) => {
      received = msg;
      return {
        ...msg,
        content: 'new',
        blocks: [
          { kind: 'progress-log', entries: [{ key: 'k1', status: 'done', message: 'ok' }] },
        ],
      };
    });

    expect(received).toBeTruthy();
    expect(received!.content).toBe('start');
    expect(received!.timestamp).toBe(42);

    const updated = useEditorStore.getState().chatMessages[0];
    expect(updated.content).toBe('new');
    expect(updated.blocks?.[0]).toEqual({
      kind: 'progress-log',
      entries: [{ key: 'k1', status: 'done', message: 'ok' }],
    });
  });
});
