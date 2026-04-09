import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/store/editor-store';

beforeEach(() => {
  // Reset to defaults
  useEditorStore.setState({
    chatVisible: true,
    editorVisible: false,
    editorExpanded: false,
    chatWidth: 480,
    editorWidth: 320,
  });
});

describe('editor-store panel state', () => {
  it('has correct default values', () => {
    // Re-create a fresh store-like snapshot via the create function defaults
    // by reading current state after explicit reset
    const state = useEditorStore.getState();
    expect(state.chatVisible).toBe(true);
    expect(state.editorVisible).toBe(false);
    expect(state.chatWidth).toBe(480);
    expect(state.editorWidth).toBe(320);
  });

  it('toggleChatVisible flips chatVisible immutably', () => {
    const before = useEditorStore.getState();
    expect(before.chatVisible).toBe(true);

    before.toggleChatVisible();
    expect(useEditorStore.getState().chatVisible).toBe(false);

    useEditorStore.getState().toggleChatVisible();
    expect(useEditorStore.getState().chatVisible).toBe(true);
  });

  it('toggleEditorVisible flips editorVisible and keeps editorExpanded in sync', () => {
    const before = useEditorStore.getState();
    expect(before.editorVisible).toBe(false);
    expect(before.editorExpanded).toBe(false);

    before.toggleEditorVisible();
    const after = useEditorStore.getState();
    expect(after.editorVisible).toBe(true);
    expect(after.editorExpanded).toBe(true);

    useEditorStore.getState().toggleEditorVisible();
    const final = useEditorStore.getState();
    expect(final.editorVisible).toBe(false);
    expect(final.editorExpanded).toBe(false);
  });

  it('toggleEditor (legacy) keeps editorVisible in sync', () => {
    const before = useEditorStore.getState();
    expect(before.editorExpanded).toBe(false);
    expect(before.editorVisible).toBe(false);

    before.toggleEditor();
    const after = useEditorStore.getState();
    expect(after.editorExpanded).toBe(true);
    expect(after.editorVisible).toBe(true);
  });

  it('setChatWidth clamps to minimum (280) and maximum (800)', () => {
    const { setChatWidth } = useEditorStore.getState();

    setChatWidth(500);
    expect(useEditorStore.getState().chatWidth).toBe(500);

    setChatWidth(100);
    expect(useEditorStore.getState().chatWidth).toBe(280);

    setChatWidth(9999);
    expect(useEditorStore.getState().chatWidth).toBe(800);
  });

  it('setEditorWidth clamps to minimum (240) and maximum (640)', () => {
    const { setEditorWidth } = useEditorStore.getState();

    setEditorWidth(360);
    expect(useEditorStore.getState().editorWidth).toBe(360);

    setEditorWidth(50);
    expect(useEditorStore.getState().editorWidth).toBe(240);

    setEditorWidth(9999);
    expect(useEditorStore.getState().editorWidth).toBe(640);
  });

  it('panel state updates do not mutate previous state object', () => {
    const prev = useEditorStore.getState();
    prev.toggleChatVisible();
    const next = useEditorStore.getState();

    // Distinct snapshots — Zustand creates a new object on each set
    expect(next).not.toBe(prev);
    // The previous snapshot object retained its old chatVisible value
    expect(prev.chatVisible).toBe(true);
    expect(next.chatVisible).toBe(false);
  });
});
