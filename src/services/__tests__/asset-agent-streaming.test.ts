// Streaming / onAsset callback tests for AssetAgent.fulfillAssets
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AssetEntry, GameConfig } from '@/engine/core';

// ── Module mocks ─────────────────────────────────────────────────────

const geminiSvc = {
  generateImageRaw: vi.fn(async () => 'data:image/png;base64,RAW'),
};

vi.mock('../gemini-image', () => ({
  GeminiImageService: class {
    generateImageRaw = geminiSvc.generateImageRaw;
  },
  getGeminiImageService: () => geminiSvc,
}));

const bgRemoverState = {
  chromaKey: vi.fn(async (x: string) => x),
  aiRemove: vi.fn(async (x: string) => x),
};

vi.mock('../bg-remover', () => ({
  BgRemover: class {
    chromaKeyRemove(x: string) { return bgRemoverState.chromaKey(x); }
    remove(x: string) { return bgRemoverState.aiRemove(x); }
  },
}));

interface LibraryStub {
  ready: () => Promise<void>;
  findByKeyAndTheme: (key: string, theme?: string) => unknown;
  save: (asset: unknown) => Promise<unknown>;
  generateName: (key: string, theme?: string) => string;
}

const libraryState: LibraryStub = {
  ready: vi.fn(async () => {}),
  findByKeyAndTheme: vi.fn(() => undefined),
  save: vi.fn(async (a: unknown) => a),
  generateName: vi.fn((k: string) => k),
};

vi.mock('../asset-library', () => ({
  AssetLibrary: class {
    ready() { return libraryState.ready(); }
    findByKeyAndTheme(key: string, theme?: string) { return libraryState.findByKeyAndTheme(key, theme); }
    save(a: unknown) { return libraryState.save(a); }
    generateName(k: string, t?: string) { return libraryState.generateName(k, t); }
  },
}));

// Stub window.Image so resizeImage() in asset-agent resolves instantly.
class FakeImage {
  width = 1024;
  height = 1024;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  get src(): string { return this._src; }
  set src(v: string) {
    this._src = v;
    queueMicrotask(() => this.onload?.());
  }
}
// @ts-expect-error test stub
globalThis.Image = FakeImage;
// @ts-expect-error test stub
globalThis.window.Image = FakeImage;

// Stub canvas
const origCreate = document.createElement.bind(document);
document.createElement = ((tag: string) => {
  const el = origCreate(tag);
  if (tag === 'canvas') {
    // @ts-expect-error stub
    el.getContext = () => ({ drawImage: () => {} });
    // @ts-expect-error stub
    el.toDataURL = () => 'data:image/png;base64,RESIZED';
  }
  return el;
}) as typeof document.createElement;

import { AssetAgent } from '../asset-agent';

// ── Helpers ──────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    modules: [
      { id: 'spawner', type: 'Spawner', enabled: true, params: { items: [{ asset: 'good_1' }, { asset: 'good_2' }] } },
    ],
    assets: {
      background: { type: 'background', src: '' },
      good_1: { type: 'sprite', src: '' },
      good_2: { type: 'sprite', src: '' },
    },
    meta: { name: 'catch', theme: 'fruit', artStyle: 'cartoon' },
    ...overrides,
  } as GameConfig;
}

describe('AssetAgent.fulfillAssets streaming (onAsset)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock states to defaults
    geminiSvc.generateImageRaw.mockImplementation(async () => 'data:image/png;base64,RAW');
    bgRemoverState.chromaKey.mockImplementation(async (x: string) => x);
    bgRemoverState.aiRemove.mockImplementation(async (x: string) => x);
    libraryState.ready = vi.fn(async () => {});
    libraryState.findByKeyAndTheme = vi.fn(() => undefined);
    libraryState.save = vi.fn(async (a: unknown) => a);
    libraryState.generateName = vi.fn((k: string) => k);
  });

  it('streams first asset via onAsset before second iteration begins', async () => {
    const callOrder: string[] = [];
    let gen = 0;
    geminiSvc.generateImageRaw.mockImplementation(async () => {
      gen += 1;
      callOrder.push(`generate:${gen}`);
      return 'data:image/png;base64,RAW';
    });

    const receivedAssetKeys: string[] = [];
    const agent = new AssetAgent();
    await agent.fulfillAssets(makeConfig(), {
      onAsset: (key) => {
        receivedAssetKeys.push(key);
        callOrder.push(`onAsset:${key}`);
      },
    });

    // The first onAsset must fire before the second generate runs.
    const firstOnAssetIdx = callOrder.findIndex((c) => c.startsWith('onAsset:'));
    const secondGenerateIdx = callOrder.findIndex((c, i) => c === 'generate:2' && i > firstOnAssetIdx);
    expect(firstOnAssetIdx).toBeGreaterThan(-1);
    expect(secondGenerateIdx).toBeGreaterThan(firstOnAssetIdx);
    // Spawner adds 'player' key too — total 4 keys.
    expect(receivedAssetKeys.length).toBe(4);
  });

  it('invokes onAsset after library.save and before onProgress done', async () => {
    const order: string[] = [];
    libraryState.save = vi.fn(async (a: unknown) => {
      const name = (a as { name: string }).name;
      order.push(`save:${name}`);
      return a;
    });

    const agent = new AssetAgent();
    await agent.fulfillAssets(makeConfig(), {
      onProgress: (p) => {
        if (p.status === 'done') order.push(`done:${p.key}`);
      },
      onAsset: (key) => {
        order.push(`onAsset:${key}`);
      },
    });

    for (const key of ['background', 'good_1', 'good_2']) {
      const saveIdx = order.findIndex((o) => o.startsWith(`save:${key}`));
      const a = order.indexOf(`onAsset:${key}`);
      const d = order.indexOf(`done:${key}`);
      expect(saveIdx).toBeGreaterThan(-1);
      expect(a).toBeGreaterThan(saveIdx);
      expect(d).toBeGreaterThan(a);
    }
  });

  it('stops streaming when signal.aborted set mid-loop (returns partial result)', async () => {
    const agent = new AssetAgent();
    let count = 0;
    const result = await agent.fulfillAssets(makeConfig(), {
      onAsset: () => {
        count += 1;
        if (count === 1) agent.cancel();
      },
    });
    expect(count).toBe(1);
    expect(Object.keys(result).length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(result).length).toBeLessThan(4);
  });

  it('onAsset throwing does not stop the loop', async () => {
    const deliveredKeys: string[] = [];
    const agent = new AssetAgent();
    // Silence console.warn for the expected throws
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await agent.fulfillAssets(makeConfig(), {
      onAsset: (key) => {
        deliveredKeys.push(key);
        throw new Error('boom');
      },
    });
    expect(deliveredKeys.length).toBe(4);
    expect(Object.keys(result).sort()).toEqual(['background', 'good_1', 'good_2', 'player'].sort());
    warnSpy.mockRestore();
  });

  it('backward compat: legacy function onProgress still works as before', async () => {
    const progressEvents: string[] = [];
    const agent = new AssetAgent();
    const result = await agent.fulfillAssets(makeConfig(), (p) => {
      progressEvents.push(`${p.key}:${p.status}`);
    });
    expect(Object.keys(result).length).toBe(4);
    expect(progressEvents.some((e) => e.endsWith(':generating'))).toBe(true);
    expect(progressEvents.some((e) => e.endsWith(':done'))).toBe(true);
  });

  it('onAsset fires for cache-hit path too', async () => {
    libraryState.findByKeyAndTheme = vi.fn((key: string) => ({
      id: `cached-${key}`,
      name: key,
      tags: [],
      type: 'sprite' as const,
      src: 'data:image/png;base64,CACHED',
      createdAt: Date.now(),
    }));

    const delivered: Array<{ key: string; entry: AssetEntry }> = [];
    const agent = new AssetAgent();
    await agent.fulfillAssets(makeConfig(), {
      onAsset: (key, entry) => {
        delivered.push({ key, entry });
      },
    });
    expect(delivered.length).toBe(4);
    expect(delivered[0].entry.src.startsWith('data:')).toBe(true);
    // Ensure no new generation happened (cache hit path)
    expect(geminiSvc.generateImageRaw).not.toHaveBeenCalled();
  });

  it('onAsset is NOT called when signal was aborted between generate and save', async () => {
    // Use a sprite-only config so chromaKey is called; abort from inside it.
    const config = makeConfig({
      assets: { good_1: { type: 'sprite', src: '' } },
      modules: [
        { id: 'spawner', type: 'Spawner', enabled: true, params: { items: [{ asset: 'good_1' }] } },
      ],
    });

    const agent = new AssetAgent();
    bgRemoverState.chromaKey.mockImplementationOnce(async (x: string) => {
      agent.cancel();
      return x;
    });

    const onAsset = vi.fn();
    await agent.fulfillAssets(config, { onAsset });

    expect(onAsset).not.toHaveBeenCalled();
  });
});
