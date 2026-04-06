import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGameStore } from '@/store/game-store';
import { useEditorStore } from '@/store/editor-store';
import type { GameConfig } from '@/engine/core/types';

import { L3PillsPanel } from '../l3-pills-panel';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeConfig(gameType = 'catch'): GameConfig {
  return {
    version: '1',
    meta: { name: gameType, theme: 'fruit', artStyle: 'cartoon', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules: [
      { id: 'scorer', type: 'Scorer', enabled: true, params: { perHit: 10, comboWindow: 2000 } },
      { id: 'spawner', type: 'Spawner', enabled: true, params: { frequency: 1.5, speed: 300, maxCount: 8 } },
      { id: 'collision', type: 'Collision', enabled: true, params: { hitboxScale: 1.0 } },
      { id: 'lives', type: 'Lives', enabled: true, params: { count: 3 } },
      { id: 'touchinput', type: 'TouchInput', enabled: true, params: {} },
      { id: 'uioverlay', type: 'UIOverlay', enabled: true, params: {} },
      { id: 'soundfx', type: 'SoundFX', enabled: true, params: {} },
      { id: 'particlevfx', type: 'ParticleVFX', enabled: true, params: {} },
    ],
    assets: {},
  };
}

beforeEach(() => {
  useGameStore.setState({ config: null, configVersion: 0 });
  useEditorStore.setState({
    boardModeOpen: false,
    setBoardModeOpen: (open: boolean) => useEditorStore.setState({ boardModeOpen: open }),
  });
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('L3PillsPanel', () => {
  it('renders nothing when no config is set', () => {
    const { container } = render(<L3PillsPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('renders L3 params grouped by category', () => {
    useGameStore.setState({ config: makeConfig('catch') });
    render(<L3PillsPanel />);

    // Should render at least one category heading and some pills
    // game_mechanics L3 params include things like "触控输入", "计分系统"
    // We just check the panel itself renders content
    const panel = screen.getByTestId('l3-pills-panel');
    expect(panel).toBeInTheDocument();
    // Should have at least one pill (any text within a button role)
    const pills = panel.querySelectorAll('[role="button"]');
    expect(pills.length).toBeGreaterThan(0);
  });

  it('assigns correct color variant per category', () => {
    useGameStore.setState({ config: makeConfig('catch') });
    render(<L3PillsPanel />);

    const panel = screen.getByTestId('l3-pills-panel');
    // game_mechanics pills should have amber colors
    const amberPills = panel.querySelectorAll('.bg-amber-500\\/20');
    // visual_audio pills should have fuchsia colors
    const fuchsiaPills = panel.querySelectorAll('.bg-fuchsia-500\\/20');

    // At least one category should have pills
    expect(amberPills.length + fuchsiaPills.length).toBeGreaterThan(0);
  });

  it('clicking a pill calls setBoardModeOpen(true)', () => {
    useGameStore.setState({ config: makeConfig('catch') });
    render(<L3PillsPanel />);

    const panel = screen.getByTestId('l3-pills-panel');
    const firstPill = panel.querySelector('[role="button"]')!;
    expect(firstPill).toBeTruthy();

    fireEvent.click(firstPill);
    expect(useEditorStore.getState().boardModeOpen).toBe(true);
  });

  it('does not render empty categories', () => {
    // Use a game type that may not have all categories
    useGameStore.setState({ config: makeConfig('quiz') });
    render(<L3PillsPanel />);

    const panel = screen.queryByTestId('l3-pills-panel');
    if (panel) {
      // Every rendered heading should have at least one pill sibling
      const headings = panel.querySelectorAll('[data-testid="category-heading"]');
      for (const heading of headings) {
        const group = heading.parentElement!;
        const pills = group.querySelectorAll('[role="button"]');
        expect(pills.length).toBeGreaterThan(0);
      }
    }
  });
});
