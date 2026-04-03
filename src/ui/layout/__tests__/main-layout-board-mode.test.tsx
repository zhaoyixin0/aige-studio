import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEditorStore } from '@/store/editor-store';

// Mock all heavy child components to isolate MainLayout behavior
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
  BoardModePanel: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="board-mode-panel">
      <button data-testid="board-mode-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
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
  useResizeDivider: () => ({ width: 480, onMouseDown: vi.fn() }),
}));

// Import MainLayout after mocks are set up
import { MainLayout } from '../main-layout';

function setStoreState(partial: Record<string, unknown>) {
  useEditorStore.setState(partial);
}

describe('MainLayout — Board Mode integration', () => {
  beforeEach(() => {
    // Reset store to studio mode defaults
    useEditorStore.setState({
      layoutPhase: 'studio',
      previewMode: 'edit',
      editorExpanded: false,
      boardModeOpen: false,
    });
  });

  it('does NOT render BoardModePanel by default', () => {
    render(<MainLayout />);
    expect(screen.queryByTestId('board-mode-panel')).not.toBeInTheDocument();
  });

  it('renders BoardModePanel when boardModeOpen is true', () => {
    setStoreState({ boardModeOpen: true });
    render(<MainLayout />);
    expect(screen.getByTestId('board-mode-panel')).toBeInTheDocument();
  });

  it('closes BoardModePanel when onClose is called', () => {
    setStoreState({ boardModeOpen: true });
    render(<MainLayout />);

    // Panel is visible
    expect(screen.getByTestId('board-mode-panel')).toBeInTheDocument();

    // Click the close button
    fireEvent.click(screen.getByTestId('board-mode-close'));

    // Store should have boardModeOpen = false
    expect(useEditorStore.getState().boardModeOpen).toBe(false);
  });

  it('hides EditorPanel by default in studio mode', () => {
    render(<MainLayout />);
    expect(screen.queryByTestId('editor-panel')).not.toBeInTheDocument();
  });

  it('renders BoardModePanel overlaying the left panel area', () => {
    setStoreState({ boardModeOpen: true });
    render(<MainLayout />);

    const boardPanel = screen.getByTestId('board-mode-panel');
    // The board mode container should exist within the layout
    const container = boardPanel.closest('[data-testid="board-mode-container"]');
    expect(container).toBeInTheDocument();
  });

  // Regression: landing phase should still work
  it('renders LandingPage when layoutPhase is landing', () => {
    setStoreState({ layoutPhase: 'landing' });
    render(<MainLayout />);
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.queryByTestId('board-mode-panel')).not.toBeInTheDocument();
  });

  // Regression: chat panel is still visible when board mode is closed
  it('renders StudioChatPanel when boardModeOpen is false', () => {
    render(<MainLayout />);
    expect(screen.getByTestId('studio-chat-panel')).toBeInTheDocument();
  });
});
