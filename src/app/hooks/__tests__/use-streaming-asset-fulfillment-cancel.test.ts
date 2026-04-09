/**
 * Tests for useStreamingAssetFulfillment cancel() + isActive surface.
 *
 * Strategy: mock AssetAgent so we can drive its onProgress/onAsset callbacks
 * deterministically and observe the hook's interaction with the editor store +
 * the asset-fulfillment singleton store.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorStore, type ChatMessage } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';
import { useAssetFulfillmentStore } from '@/store/asset-fulfillment-store';
import type { GameConfig, AssetEntry } from '@/engine/core';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mocks ────────────────────────────────────────────────────────────

let mockAgentInstance: MockAgent | null = null;

class MockAgent {
  abortController: AbortController = new AbortController();
  cancelCalled = false;
  resolveFulfill: ((v: Record<string, AssetEntry>) => void) | null = null;
  capturedOpts: any = null;

  cancel(): void {
    this.cancelCalled = true;
    this.abortController.abort();
  }

  fulfillAssets(_config: GameConfig, opts: any): Promise<Record<string, AssetEntry>> {
    this.capturedOpts = opts;
    return new Promise((resolve) => {
      this.resolveFulfill = resolve;
    });
  }

  // Helper for tests
  async deliverAsset(key: string, index: number, total: number): Promise<void> {
    const entry: AssetEntry = { type: 'sprite', src: `data:image/png;base64,${key}` };
    await this.capturedOpts.onAsset(key, entry, { index, total });
  }
}

vi.mock('@/services/asset-agent', async () => {
  const actual = await vi.importActual<typeof import('@/services/asset-agent')>(
    '@/services/asset-agent',
  );
  return {
    ...actual,
    AssetAgent: class {
      constructor() {
        mockAgentInstance = new MockAgent();
        return mockAgentInstance as unknown as InstanceType<typeof actual.AssetAgent>;
      }
    },
  };
});

// Mock engine context
vi.mock('@/app/hooks/use-engine', () => ({
  useEngineContext: () => ({
    engineRef: { current: { eventBus: { emit: vi.fn() } } },
  }),
}));

// Stub crypto.randomUUID for stable ids
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

// ── Helpers ──────────────────────────────────────────────────────────

function makeConfig(): GameConfig {
  return {
    modules: [],
    assets: {
      background: { type: 'background', src: '' },
      good_1: { type: 'sprite', src: '' },
      good_2: { type: 'sprite', src: '' },
    },
    meta: { name: 'test', theme: 'fruit' },
    version: 1,
    canvas: { width: 540, height: 960 },
  } as unknown as GameConfig;
}

function getProgressMessage(): ChatMessage | undefined {
  return useEditorStore.getState().chatMessages.find((m) => m.id.startsWith('test-uuid-'));
}

// ── Tests ────────────────────────────────────────────────────────────

import { useStreamingAssetFulfillment } from '../use-streaming-asset-fulfillment';

beforeEach(() => {
  uuidCounter = 0;
  mockAgentInstance = null;
  useEditorStore.setState({ chatMessages: [] });
  useGameStore.setState({
    config: makeConfig(),
    configVersion: 1,
  } as any);
  useAssetFulfillmentStore.setState({ isActive: false, controller: null });
});

describe('useStreamingAssetFulfillment — cancel + isActive', () => {
  it('isActive becomes true after triggerStreamingFulfillment starts', () => {
    const { result } = renderHook(() => useStreamingAssetFulfillment());

    expect(result.current.isActive).toBe(false);

    act(() => {
      result.current.triggerStreamingFulfillment(makeConfig());
    });

    expect(result.current.isActive).toBe(true);
    expect(useAssetFulfillmentStore.getState().isActive).toBe(true);
  });

  it('isActive becomes false after fulfillment resolves normally', async () => {
    const { result } = renderHook(() => useStreamingAssetFulfillment());

    act(() => {
      result.current.triggerStreamingFulfillment(makeConfig());
    });
    expect(result.current.isActive).toBe(true);

    // Resolve the agent's fulfill
    await act(async () => {
      mockAgentInstance!.resolveFulfill!({});
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isActive).toBe(false);
    expect(useAssetFulfillmentStore.getState().isActive).toBe(false);
  });

  it('cancel() aborts the current AssetAgent and sets isActive to false', async () => {
    const { result } = renderHook(() => useStreamingAssetFulfillment());

    act(() => {
      result.current.triggerStreamingFulfillment(makeConfig());
    });

    expect(result.current.isActive).toBe(true);
    expect(mockAgentInstance!.cancelCalled).toBe(false);

    await act(async () => {
      result.current.cancel();
      await Promise.resolve();
    });

    expect(mockAgentInstance!.cancelCalled).toBe(true);
    expect(result.current.isActive).toBe(false);
    expect(useAssetFulfillmentStore.getState().isActive).toBe(false);
  });

  it('cancel() is a no-op when nothing is in flight', () => {
    const { result } = renderHook(() => useStreamingAssetFulfillment());

    expect(result.current.isActive).toBe(false);
    expect(() => {
      act(() => {
        result.current.cancel();
      });
    }).not.toThrow();
    expect(result.current.isActive).toBe(false);
  });

  it('after cancel, progress message content is updated to "已取消，保留 N/M 张素材"', async () => {
    const { result } = renderHook(() => useStreamingAssetFulfillment());

    act(() => {
      result.current.triggerStreamingFulfillment(makeConfig());
    });

    // Deliver one asset, then cancel
    await act(async () => {
      await mockAgentInstance!.deliverAsset('background', 0, 3);
    });

    await act(async () => {
      result.current.cancel();
      await Promise.resolve();
    });

    const msg = getProgressMessage();
    expect(msg).toBeDefined();
    expect(msg!.content).toContain('已取消');
    expect(msg!.content).toContain('1/3');
  });

  it('after cancel, progress-log block is removed but asset-preview block is preserved', async () => {
    const { result } = renderHook(() => useStreamingAssetFulfillment());

    act(() => {
      result.current.triggerStreamingFulfillment(makeConfig());
    });

    // Pre-condition: both blocks exist
    let msg = getProgressMessage();
    expect(msg!.blocks?.some((b) => b.kind === 'progress-log')).toBe(true);
    expect(msg!.blocks?.some((b) => b.kind === 'asset-preview')).toBe(true);

    await act(async () => {
      result.current.cancel();
      await Promise.resolve();
    });

    msg = getProgressMessage();
    expect(msg!.blocks?.some((b) => b.kind === 'progress-log')).toBe(false);
    expect(msg!.blocks?.some((b) => b.kind === 'asset-preview')).toBe(true);
  });

  it('cancel uses applied count for the "保留 N/M" summary', async () => {
    const { result } = renderHook(() => useStreamingAssetFulfillment());

    act(() => {
      result.current.triggerStreamingFulfillment(makeConfig());
    });

    // Deliver two assets
    await act(async () => {
      await mockAgentInstance!.deliverAsset('background', 0, 3);
      await mockAgentInstance!.deliverAsset('good_1', 1, 3);
    });

    await act(async () => {
      result.current.cancel();
      await Promise.resolve();
    });

    const msg = getProgressMessage();
    expect(msg!.content).toContain('2/3');
  });
});
