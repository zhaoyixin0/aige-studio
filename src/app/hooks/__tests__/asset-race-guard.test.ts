/**
 * Asset race condition guard — TDD tests (RED phase).
 *
 * Verifies that triggerAssetFulfillment in use-conversation-manager.ts
 * only calls batchUpdateAssets when configVersion matches the value captured
 * before the async fulfillAssets call.
 *
 * Mock strategy:
 *   - AssetAgent: class mock so `new AssetAgent()` works correctly
 *   - fulfillAssets: deferred promise controlled per-test
 *   - Stores: real Zustand stores; batchUpdateAssets replaced via setState
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';

/* ------------------------------------------------------------------ */
/*  Shared mocks                                                       */
/* ------------------------------------------------------------------ */

const mockProcess = vi.fn();
let mockFulfillAssets = vi.fn();

vi.mock('@/agent/singleton', () => ({
  getConversationAgent: () => ({ process: mockProcess }),
}));

// Use class syntax so `new AssetAgent()` works
vi.mock('@/services/asset-agent', () => ({
  AssetAgent: class MockAssetAgent {
    fulfillAssets(...args: unknown[]) {
      return mockFulfillAssets(...args);
    }
  },
}));

vi.mock('@/app/hooks/use-engine', () => ({
  useEngineContext: () => ({ engineRef: { current: null } }),
}));

// Import hook after mocks
import { useConversationManager } from '../use-conversation-manager';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const fakeGameConfig = {
  version: '1.0.0',
  meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
  canvas: { width: 1080, height: 1920 },
  modules: [],
  assets: {},
};

const fakeAssets = {
  good_1: { src: 'http://example.com/img.png', label: 'item', category: 'good' as const },
};

function resetStores(): void {
  useEditorStore.setState({ chatMessages: [], isChatLoading: false, suggestionChips: [] });
  useGameStore.setState({ config: null, configVersion: 0 });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('triggerAssetFulfillment — race condition guard', () => {
  let resolveFulfill!: (v: Record<string, unknown>) => void;
  let mockBatchUpdateAssets: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetStores();
    mockProcess.mockReset();
    mockFulfillAssets = vi.fn();

    // Deferred promise: we control when assets "arrive"
    mockFulfillAssets.mockReturnValue(
      new Promise<Record<string, unknown>>((resolve) => {
        resolveFulfill = resolve;
      }),
    );

    mockProcess.mockResolvedValue({
      reply: 'Game created!',
      config: fakeGameConfig,
      chips: undefined,
    });

    // Replace batchUpdateAssets in the real store so we can track calls
    mockBatchUpdateAssets = vi.fn();
    useGameStore.setState({ batchUpdateAssets: mockBatchUpdateAssets } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does NOT apply assets when configVersion changed before promise resolved', async () => {
    const { result } = renderHook(() => useConversationManager());

    // Submit — triggerAssetFulfillment captures configVersion
    await act(async () => {
      await result.current.submitMessage('create a game');
    });

    const versionAtCapture = useGameStore.getState().configVersion;

    // Simulate game switch: bump version BEFORE assets arrive
    useGameStore.setState((s) => ({ configVersion: s.configVersion + 1 }));
    expect(useGameStore.getState().configVersion).toBeGreaterThan(versionAtCapture);

    // Resolve the deferred assets promise (stale: captured != current)
    await act(async () => {
      resolveFulfill(fakeAssets as Record<string, unknown>);
      await new Promise<void>((r) => setTimeout(r, 50));
    });

    // Guard must block: batchUpdateAssets must NOT be called
    expect(mockBatchUpdateAssets).not.toHaveBeenCalled();
  });

  it('DOES apply assets when configVersion has not changed', async () => {
    const { result } = renderHook(() => useConversationManager());

    // Submit — triggerAssetFulfillment captures configVersion
    await act(async () => {
      await result.current.submitMessage('create a game');
    });

    // No version bump — version stays the same after submit

    // Resolve the deferred assets promise (version unchanged: captured === current)
    await act(async () => {
      resolveFulfill(fakeAssets as Record<string, unknown>);
      await new Promise<void>((r) => setTimeout(r, 50));
    });

    // Guard must pass: batchUpdateAssets MUST be called
    expect(mockBatchUpdateAssets).toHaveBeenCalledWith(fakeAssets);
  });
});
