/**
 * Tests for makeStreamingApplier factory — shared stream applier for
 * streaming asset fulfillment. Phase A, Step A3.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore, type ChatMessage } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';
import type { AssetEntry, GameConfig } from '@/engine/core';
import type { AssetPreviewItem, ProgressEntry } from '@/agent/conversation-defs';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeStreamingApplier } from '../use-asset-stream-applier';

// Minimal fake engine with eventBus.emit spy
function makeEngine() {
  const emit = vi.fn();
  return { engine: { eventBus: { emit } }, emit };
}

const PROGRESS_MSG_ID = 'progress-msg-1';

function seedStores(initialAssets?: Record<string, AssetEntry>): void {
  const assets: Record<string, AssetEntry> = initialAssets ?? {
    background: { type: 'background', src: '' },
    good_1: { type: 'sprite', src: '' },
    good_2: { type: 'sprite', src: '' },
  };
  const config = {
    modules: [],
    assets,
    meta: { name: 'test' },
    version: 1,
    canvas: { width: 540, height: 960 },
  } as unknown as GameConfig;
  useGameStore.setState({ config, configVersion: 1 });

  const expectedKeys = ['background', 'good_1', 'good_2'];
  const entries: ProgressEntry[] = expectedKeys.map((k) => ({
    key: k,
    status: 'pending',
    message: `等待中: ${k}`,
  }));
  const items: AssetPreviewItem[] = expectedKeys.map((k) => ({
    key: k,
    label: k,
    src: '',
    source: 'ai',
  }));

  const msg: ChatMessage = {
    id: PROGRESS_MSG_ID,
    role: 'assistant',
    content: 'generating...',
    timestamp: Date.now(),
    blocks: [
      { kind: 'progress-log', entries },
      { kind: 'asset-preview', items, allowApplyAll: false },
    ],
  };

  useEditorStore.setState({ chatMessages: [msg] });
}

function getMessage(): ChatMessage {
  const msg = useEditorStore.getState().chatMessages.find((m) => m.id === PROGRESS_MSG_ID);
  if (!msg) throw new Error('progress message missing');
  return msg;
}

function spriteEntry(src = 'data:image/png;base64,AAA'): AssetEntry {
  return { type: 'sprite', src };
}

beforeEach(() => {
  useGameStore.setState({ config: null, configVersion: 0 });
  useEditorStore.setState({ chatMessages: [] });
});

describe('makeStreamingApplier', () => {
  it('writes each asset incrementally via batchUpdateAssets', async () => {
    seedStores();
    const { engine } = makeEngine();
    const applier = makeStreamingApplier({
      engineRef: { current: engine as never },
      progressMsgId: PROGRESS_MSG_ID,
    });

    await applier.onAsset('background', spriteEntry('data:image/png;base64,BG'), { index: 0, total: 3 });
    expect(useGameStore.getState().config?.assets.background?.src).toBe('data:image/png;base64,BG');

    await applier.onAsset('good_1', spriteEntry('data:image/png;base64,G1'), { index: 1, total: 3 });
    expect(useGameStore.getState().config?.assets.good_1?.src).toBe('data:image/png;base64,G1');

    await applier.onAsset('good_2', spriteEntry('data:image/png;base64,G2'), { index: 2, total: 3 });
    expect(useGameStore.getState().config?.assets.good_2?.src).toBe('data:image/png;base64,G2');
  });

  it('allows own sequential writes via monotonic v0+applied guard', async () => {
    seedStores();
    const v0 = useGameStore.getState().configVersion;
    const { engine } = makeEngine();
    const applier = makeStreamingApplier({
      engineRef: { current: engine as never },
      progressMsgId: PROGRESS_MSG_ID,
    });

    await applier.onAsset('background', spriteEntry(), { index: 0, total: 3 });
    await applier.onAsset('good_1', spriteEntry(), { index: 1, total: 3 });
    await applier.onAsset('good_2', spriteEntry(), { index: 2, total: 3 });

    expect(applier.isStopped).toBe(false);
    expect(applier.appliedCount).toBe(3);
    expect(useGameStore.getState().configVersion).toBe(v0 + 3);
  });

  it('stops when foreign configVersion bump detected mid-stream', async () => {
    seedStores();
    const { engine } = makeEngine();
    const applier = makeStreamingApplier({
      engineRef: { current: engine as never },
      progressMsgId: PROGRESS_MSG_ID,
    });

    await applier.onAsset('background', spriteEntry(), { index: 0, total: 3 });
    expect(applier.appliedCount).toBe(1);

    // Simulate foreign configVersion bump (e.g., user switched game)
    useGameStore.setState((s) => ({ configVersion: s.configVersion + 5 }));

    await applier.onAsset('good_1', spriteEntry('data:image/png;base64,G1'), { index: 1, total: 3 });
    expect(applier.isStopped).toBe(true);
    expect(applier.appliedCount).toBe(1);
    // good_1 must NOT be written to store
    expect(useGameStore.getState().config?.assets.good_1?.src).toBe('');
  });

  it('emits assets:updated on engine event bus with correct payload shape', async () => {
    seedStores();
    const { engine, emit } = makeEngine();
    const applier = makeStreamingApplier({
      engineRef: { current: engine as never },
      progressMsgId: PROGRESS_MSG_ID,
    });

    await applier.onAsset('background', { type: 'background', src: 'data:image/png;base64,BG' }, { index: 0, total: 3 });

    expect(emit).toHaveBeenCalledWith('assets:updated', {
      updates: [{ key: 'background', src: 'data:image/png;base64,BG', type: 'background' }],
    });
  });

  it('updates asset-preview block item src in the progress message', async () => {
    seedStores();
    const { engine } = makeEngine();
    const applier = makeStreamingApplier({
      engineRef: { current: engine as never },
      progressMsgId: PROGRESS_MSG_ID,
    });

    await applier.onAsset('good_1', spriteEntry('data:image/png;base64,G1'), { index: 1, total: 3 });

    const msg = getMessage();
    const previewBlock = msg.blocks?.find((b) => b.kind === 'asset-preview');
    if (!previewBlock || previewBlock.kind !== 'asset-preview') throw new Error('expected asset-preview block');
    const item = previewBlock.items.find((i) => i.key === 'good_1');
    expect(item?.src).toBe('data:image/png;base64,G1');
    // Other items unchanged
    const bg = previewBlock.items.find((i) => i.key === 'background');
    expect(bg?.src).toBe('');
  });

  it('updates progress-log block entry status via onProgress', () => {
    seedStores();
    const { engine } = makeEngine();
    const applier = makeStreamingApplier({
      engineRef: { current: engine as never },
      progressMsgId: PROGRESS_MSG_ID,
    });

    applier.onProgress({ current: 1, total: 3, key: 'background', status: 'generating' });

    const msg = getMessage();
    const progressBlock = msg.blocks?.find((b) => b.kind === 'progress-log');
    if (!progressBlock || progressBlock.kind !== 'progress-log') throw new Error('expected progress-log block');
    const entry = progressBlock.entries.find((e) => e.key === 'background');
    expect(entry?.status).toBe('generating');
    expect(entry?.message).toContain('background');
  });

  it('appliedCount reflects number of successful applies', async () => {
    seedStores();
    const { engine } = makeEngine();
    const applier = makeStreamingApplier({
      engineRef: { current: engine as never },
      progressMsgId: PROGRESS_MSG_ID,
    });

    expect(applier.appliedCount).toBe(0);
    await applier.onAsset('background', spriteEntry(), { index: 0, total: 3 });
    expect(applier.appliedCount).toBe(1);
    await applier.onAsset('good_1', spriteEntry(), { index: 1, total: 3 });
    expect(applier.appliedCount).toBe(2);
  });

  it('isStopped reflects foreign change detection', async () => {
    seedStores();
    const { engine } = makeEngine();
    const applier = makeStreamingApplier({
      engineRef: { current: engine as never },
      progressMsgId: PROGRESS_MSG_ID,
    });

    expect(applier.isStopped).toBe(false);
    // Foreign bump BEFORE any onAsset
    useGameStore.setState((s) => ({ configVersion: s.configVersion + 10 }));
    await applier.onAsset('background', spriteEntry(), { index: 0, total: 3 });
    expect(applier.isStopped).toBe(true);
    expect(applier.appliedCount).toBe(0);
  });

  it('onAsset is a no-op once stopped', async () => {
    seedStores();
    const { engine, emit } = makeEngine();
    const applier = makeStreamingApplier({
      engineRef: { current: engine as never },
      progressMsgId: PROGRESS_MSG_ID,
    });

    useGameStore.setState((s) => ({ configVersion: s.configVersion + 10 }));
    await applier.onAsset('background', spriteEntry(), { index: 0, total: 3 });
    emit.mockClear();
    await applier.onAsset('good_1', spriteEntry(), { index: 1, total: 3 });

    expect(emit).not.toHaveBeenCalled();
    expect(applier.appliedCount).toBe(0);
  });

  it('onProgress is a no-op once stopped', async () => {
    seedStores();
    const { engine } = makeEngine();
    const applier = makeStreamingApplier({
      engineRef: { current: engine as never },
      progressMsgId: PROGRESS_MSG_ID,
    });

    useGameStore.setState((s) => ({ configVersion: s.configVersion + 10 }));
    await applier.onAsset('background', spriteEntry(), { index: 0, total: 3 });

    // Snapshot current progress-log entry for background
    const beforeMsg = getMessage();
    const beforeBlock = beforeMsg.blocks?.find((b) => b.kind === 'progress-log');
    const beforeEntry =
      beforeBlock && beforeBlock.kind === 'progress-log'
        ? beforeBlock.entries.find((e) => e.key === 'background')
        : undefined;

    applier.onProgress({ current: 2, total: 3, key: 'background', status: 'done' });

    const afterMsg = getMessage();
    const afterBlock = afterMsg.blocks?.find((b) => b.kind === 'progress-log');
    const afterEntry =
      afterBlock && afterBlock.kind === 'progress-log'
        ? afterBlock.entries.find((e) => e.key === 'background')
        : undefined;
    // Should be unchanged
    expect(afterEntry?.status).toBe(beforeEntry?.status);
  });
});
