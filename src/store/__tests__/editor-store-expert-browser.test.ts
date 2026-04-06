import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../editor-store';

describe('EditorStore expertBrowser', () => {
  beforeEach(() => {
    useEditorStore.setState({
      expertBrowserOpen: false,
      expertBrowserGameType: null,
    });
  });

  it('defaults to closed with no gameType', () => {
    const state = useEditorStore.getState();
    expect(state.expertBrowserOpen).toBe(false);
    expect(state.expertBrowserGameType).toBeNull();
  });

  it('setExpertBrowserOpen(true, "catch") opens with gameType', () => {
    useEditorStore.getState().setExpertBrowserOpen(true, 'catch');
    const state = useEditorStore.getState();
    expect(state.expertBrowserOpen).toBe(true);
    expect(state.expertBrowserGameType).toBe('catch');
  });

  it('setExpertBrowserOpen(true) opens with null gameType', () => {
    useEditorStore.getState().setExpertBrowserOpen(true);
    const state = useEditorStore.getState();
    expect(state.expertBrowserOpen).toBe(true);
    expect(state.expertBrowserGameType).toBeNull();
  });

  it('setExpertBrowserOpen(false) closes and resets gameType', () => {
    useEditorStore.getState().setExpertBrowserOpen(true, 'dodge');
    useEditorStore.getState().setExpertBrowserOpen(false);
    const state = useEditorStore.getState();
    expect(state.expertBrowserOpen).toBe(false);
    expect(state.expertBrowserGameType).toBeNull();
  });
});
