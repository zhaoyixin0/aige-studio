import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEditorStore } from '@/store/editor-store';

// Capture props passed to BoardModePanel
let capturedBoardModeProps: Record<string, unknown> = {};

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
  BoardModePanel: (props: Record<string, unknown>) => {
    capturedBoardModeProps = props;
    return (
      <div data-testid="board-mode-panel">
        <button data-testid="board-mode-close" onClick={props.onClose as () => void}>
          Close
        </button>
      </div>
    );
  },
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
import { useGameStore } from '@/store/game-store';
import type { GameConfig } from '@/engine/core/types';

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

  // --- I5: Board Mode wired to live config ---

  it('passes game type from config (not hardcoded "catch")', () => {
    const shootingConfig: GameConfig = {
      version: '1.0',
      meta: {
        name: 'Shooting',
        description: 'A shooting game',
        thumbnail: null,
        createdAt: '2026-01-01',
      },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    };
    useGameStore.setState({ config: shootingConfig });
    setStoreState({ boardModeOpen: true });
    render(<MainLayout />);

    expect(capturedBoardModeProps.gameType).toBe('shooting');
  });

  it('falls back to "catch" when config is null', () => {
    useGameStore.setState({ config: null });
    setStoreState({ boardModeOpen: true });
    render(<MainLayout />);

    expect(capturedBoardModeProps.gameType).toBe('catch');
  });

  it('passes live values derived from config (not empty Map)', () => {
    const config: GameConfig = {
      version: '1.0',
      meta: {
        name: 'Catch',
        description: 'A catch game',
        thumbnail: null,
        createdAt: '2026-01-01',
        artStyle: 'pixel',
      },
      canvas: { width: 1080, height: 1920 },
      modules: [
        { id: 'spawner_1', type: 'Spawner', enabled: true, params: { speed: 200 } },
      ],
      assets: {},
    };
    useGameStore.setState({ config });
    setStoreState({ boardModeOpen: true });
    render(<MainLayout />);

    const values = capturedBoardModeProps.values as Map<string, unknown>;
    expect(values).toBeInstanceOf(Map);
    // artStyle is mapped via visual_audio_003 → meta.artStyle
    expect(values.get('visual_audio_003')).toBe('pixel');
    // Spawner speed is mapped via game_mechanics_014 → Spawner.speed
    expect(values.get('game_mechanics_014')).toBe(200);
  });

  it('passes a working onParamChange that updates the store', () => {
    const config: GameConfig = {
      version: '1.0',
      meta: {
        name: 'Catch',
        description: 'A catch game',
        thumbnail: null,
        createdAt: '2026-01-01',
        artStyle: 'cartoon',
      },
      canvas: { width: 1080, height: 1920 },
      modules: [
        { id: 'spawner_1', type: 'Spawner', enabled: true, params: { speed: 200 } },
      ],
      assets: {},
    };
    useGameStore.setState({ config });
    setStoreState({ boardModeOpen: true });
    render(<MainLayout />);

    const handleParamChange = capturedBoardModeProps.onParamChange as (
      paramId: string,
      value: unknown,
    ) => void;

    // Change artStyle via meta mapping
    handleParamChange('visual_audio_003', 'pixel');
    expect(useGameStore.getState().config?.meta.artStyle).toBe('pixel');

    // Change Spawner speed via module param mapping
    handleParamChange('game_mechanics_014', 400);
    const spawner = useGameStore.getState().config?.modules.find((m) => m.type === 'Spawner');
    expect(spawner?.params.speed).toBe(400);
  });

  it('routes L2 _enabled toggle to module.enabled, not module.params._enabled', () => {
    const config: GameConfig = {
      version: '1.0',
      meta: {
        name: 'Catch',
        description: 'A catch game',
        thumbnail: null,
        createdAt: '2026-01-01',
      },
      canvas: { width: 1080, height: 1920 },
      modules: [
        { id: 'scorer_1', type: 'Scorer', enabled: true, params: { perHit: 10 } },
      ],
      assets: {},
    };
    useGameStore.setState({ config });
    setStoreState({ boardModeOpen: true });
    render(<MainLayout />);

    const handleParamChange = capturedBoardModeProps.onParamChange as (
      paramId: string,
      value: unknown,
    ) => void;

    // game_mechanics_001 maps to Scorer._enabled (L2 toggle)
    handleParamChange('game_mechanics_001', false);

    const scorer = useGameStore.getState().config?.modules.find((m) => m.type === 'Scorer');
    // enabled should be set on the module itself
    expect(scorer?.enabled).toBe(false);
    // _enabled should NOT leak into params
    expect(scorer?.params).not.toHaveProperty('_enabled');
  });
});
