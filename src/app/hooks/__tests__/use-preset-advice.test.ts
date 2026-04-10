// src/app/hooks/__tests__/use-preset-advice.test.ts
//
// Tests for usePresetAdvice — subscribes to game-store config changes and
// pushes a chat-level advice block when signatureParams drift is detected.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';
import type { GameConfig } from '@/engine/core/types';
import type { PresetAdvice } from '@/agent/preset-advice';

// ── Mocks ────────────────────────────────────────────────────────────

const mockDetect = vi.fn<
  (
    config: GameConfig,
    gameType: string,
  ) => Promise<PresetAdvice[]>
>();

vi.mock('@/agent/preset-advice', async () => {
  const actual = await vi.importActual<typeof import('@/agent/preset-advice')>(
    '@/agent/preset-advice',
  );
  return {
    ...actual,
    detectSignatureDrift: (config: GameConfig, gameType: string) =>
      mockDetect(config, gameType),
  };
});

// The hook is imported after mocks are set up
import { usePresetAdvice } from '../use-preset-advice';

// ── Helpers ──────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<GameConfig['meta']> = {}): GameConfig {
  return {
    version: '1.0.0',
    meta: {
      name: 'T',
      description: '',
      thumbnail: null,
      createdAt: '',
      gameType: 'catch',
      ...overrides,
    },
    canvas: { width: 1080, height: 1920 },
    modules: [],
    assets: {},
  };
}

function resetStores(): void {
  useEditorStore.setState({ chatMessages: [] });
  useGameStore.setState({ config: null });
}

const sampleAdvice: PresetAdvice = {
  level: 'warning',
  moduleType: 'Spawner',
  paramKey: 'frequency',
  actualValue: 2.8,
  suggestedValue: 1.3,
  confidence: 0.8,
  message: '专家建议 frequency ≈ 1.3，当前 2.8 偏高',
};

// ── Tests ────────────────────────────────────────────────────────────

describe('usePresetAdvice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStores();
    mockDetect.mockReset();
    mockDetect.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetStores();
  });

  it('does not trigger detection on mount with null config', () => {
    renderHook(() => usePresetAdvice());
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it('does not trigger detection when config has no gameType', async () => {
    const cfg = makeConfig({ gameType: '' });
    useGameStore.setState({ config: cfg });
    renderHook(() => usePresetAdvice());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it('triggers detection after config change when presetEnriched is true', async () => {
    renderHook(() => usePresetAdvice());

    act(() => {
      useGameStore.setState({
        config: makeConfig({ presetEnriched: true }),
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockDetect).toHaveBeenCalledTimes(1);
    expect(mockDetect).toHaveBeenCalledWith(
      expect.objectContaining({ meta: expect.any(Object) }),
      'catch',
    );
  });

  it('pushes a validation-summary chat message when advice is non-empty', async () => {
    mockDetect.mockResolvedValue([sampleAdvice]);
    renderHook(() => usePresetAdvice());

    act(() => {
      useGameStore.setState({
        config: makeConfig({ presetEnriched: true }),
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    const messages = useEditorStore.getState().chatMessages;
    expect(messages.length).toBe(1);
    const block = messages[0].blocks?.[0];
    expect(block?.kind).toBe('validation-summary');
    if (block?.kind === 'validation-summary') {
      expect(block.issues.length).toBe(1);
      expect(block.issues[0].description).toContain('1.3');
    }
  });

  it('does not push a message when advice is empty', async () => {
    mockDetect.mockResolvedValue([]);
    renderHook(() => usePresetAdvice());

    act(() => {
      useGameStore.setState({
        config: makeConfig({ presetEnriched: true }),
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(useEditorStore.getState().chatMessages).toHaveLength(0);
  });

  it('debounces rapid consecutive config updates to a single detection', async () => {
    renderHook(() => usePresetAdvice());

    act(() => {
      useGameStore.setState({
        config: makeConfig({ presetEnriched: true, name: 'a' }),
      });
    });
    act(() => {
      useGameStore.setState({
        config: makeConfig({ presetEnriched: true, name: 'b' }),
      });
    });
    act(() => {
      useGameStore.setState({
        config: makeConfig({ presetEnriched: true, name: 'c' }),
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockDetect).toHaveBeenCalledTimes(1);
  });

  it('re-runs detection when gameType changes', async () => {
    renderHook(() => usePresetAdvice());

    act(() => {
      useGameStore.setState({
        config: makeConfig({ presetEnriched: true, gameType: 'catch' }),
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    act(() => {
      useGameStore.setState({
        config: makeConfig({ presetEnriched: true, gameType: 'dodge' }),
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockDetect).toHaveBeenCalledTimes(2);
    expect(mockDetect.mock.calls[1][1]).toBe('dodge');
  });

  it('does not trigger when presetEnriched flag is not true', async () => {
    renderHook(() => usePresetAdvice());

    act(() => {
      useGameStore.setState({
        config: makeConfig({ presetEnriched: 'pending' }),
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockDetect).not.toHaveBeenCalled();
  });

  it('clears pending advice when config becomes null', async () => {
    mockDetect.mockResolvedValue([sampleAdvice]);
    renderHook(() => usePresetAdvice());

    act(() => {
      useGameStore.setState({
        config: makeConfig({ presetEnriched: true }),
      });
    });
    act(() => {
      useGameStore.setState({ config: null });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // Detection should not have run because config went null before debounce fired
    expect(mockDetect).not.toHaveBeenCalled();
    expect(useEditorStore.getState().chatMessages).toHaveLength(0);
  });

  it('does not push duplicate advice for the same (gameType, advice set)', async () => {
    mockDetect.mockResolvedValue([sampleAdvice]);
    renderHook(() => usePresetAdvice());

    act(() => {
      useGameStore.setState({
        config: makeConfig({ presetEnriched: true }),
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // Second trigger for the same gameType with unchanged advice
    act(() => {
      useGameStore.setState({
        config: makeConfig({ presetEnriched: true, name: 'b' }),
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    const messages = useEditorStore.getState().chatMessages;
    expect(messages.length).toBe(1);
  });
});
