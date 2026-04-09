import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEditorStore } from '@/store/editor-store';

vi.mock('@/ui/landing/landing-page', () => ({
  LandingPage: () => <div data-testid="landing-page">Landing</div>,
}));
vi.mock('@/ui/chat/studio-chat-panel', () => ({
  StudioChatPanel: () => <div data-testid="studio-chat-panel">Chat</div>,
}));
vi.mock('@/ui/preview/preview-canvas', () => ({
  PreviewCanvas: () => <div data-testid="preview-canvas">Preview</div>,
}));
vi.mock('@/ui/editor/editor-panel', () => ({
  EditorPanel: () => <div data-testid="editor-panel">Editor</div>,
}));
vi.mock('@/ui/preview/fullscreen-mode', () => ({
  FullscreenMode: () => <div data-testid="fullscreen-mode">Fullscreen</div>,
}));
vi.mock('@/ui/parameters/board-mode-panel', () => ({
  BoardModePanel: () => <div data-testid="board-mode-panel">Board</div>,
}));
vi.mock('@/app/hooks/use-engine', () => ({
  useEngine: () => ({
    engineRef: { current: null },
    rendererRef: { current: null },
    setMountEl: vi.fn(),
    loadConfig: vi.fn(),
    getModuleSchema: vi.fn(),
    ready: false,
  }),
  EngineContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
}));
vi.mock('@/app/hooks/use-resize-divider', () => ({
  useResizeDivider: () => ({ width: 480, onMouseDown: vi.fn(), onTouchStart: vi.fn() }),
}));

import { MainLayout } from '../main-layout';

function setStudio(partial: Record<string, unknown> = {}) {
  useEditorStore.setState({
    layoutPhase: 'studio',
    previewMode: 'edit',
    chatVisible: true,
    editorVisible: false,
    editorExpanded: false,
    boardModeOpen: false,
    ...partial,
  });
}

describe('MainLayout — three-view layout', () => {
  beforeEach(() => {
    setStudio();
  });

  it('renders chat + preview when chatVisible=true and editorVisible=false', () => {
    render(<MainLayout />);
    expect(screen.getByTestId('studio-chat-panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview-canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('editor-panel')).not.toBeInTheDocument();
  });

  it('renders all three panels when chatVisible=true and editorVisible=true', () => {
    setStudio({ editorVisible: true, editorExpanded: true });
    render(<MainLayout />);
    expect(screen.getByTestId('studio-chat-panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('editor-panel')).toBeInTheDocument();
  });

  it('renders preview + editor (no chat) when chatVisible=false and editorVisible=true', () => {
    setStudio({ chatVisible: false, editorVisible: true, editorExpanded: true });
    render(<MainLayout />);
    expect(screen.queryByTestId('studio-chat-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('preview-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('editor-panel')).toBeInTheDocument();
  });

  it('renders only preview when previewMode=fullscreen regardless of flags', () => {
    setStudio({ previewMode: 'fullscreen', editorVisible: true, editorExpanded: true });
    render(<MainLayout />);
    expect(screen.queryByTestId('studio-chat-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('editor-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('fullscreen-mode')).toBeInTheDocument();
  });

  it('does not render board mode overlay when chatVisible=false', () => {
    setStudio({ chatVisible: false, boardModeOpen: true });
    render(<MainLayout />);
    expect(screen.queryByTestId('board-mode-panel')).not.toBeInTheDocument();
  });

  it('exposes a chat-toggle button that flips chatVisible', () => {
    render(<MainLayout />);
    const btn = screen.getByRole('button', { name: /对话|chat/i });
    expect(btn).toBeTruthy();
    btn.click();
    expect(useEditorStore.getState().chatVisible).toBe(false);
  });
});
