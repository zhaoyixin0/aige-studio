// src/services/__tests__/asset-library.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssetLibrary } from '../asset-library.ts';

// Mock idb-keyval so tests run in jsdom (no real IndexedDB needed)
const store = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
  del: vi.fn(async (key: string) => { store.delete(key); }),
}));

describe('AssetLibrary', () => {
  let lib: AssetLibrary;

  beforeEach(async () => {
    store.clear();
    lib = new AssetLibrary();
    await lib.ready();
  });

  it('should save and retrieve an asset', async () => {
    await lib.save({ name: '\u91D1\u8272\u661F\u661F', tags: ['star', 'gold', 'catch'], type: 'sprite', src: 'data:image/png;base64,abc' });
    const results = lib.search('\u661F\u661F');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('\u91D1\u8272\u661F\u661F');
  });

  it('should search by tag', async () => {
    await lib.save({ name: '\u7EA2\u8272\u70B8\u5F39', tags: ['bomb', 'danger', 'dodge'], type: 'sprite', src: 'data:...' });
    await lib.save({ name: '\u91D1\u8272\u661F\u661F', tags: ['star', 'gold'], type: 'sprite', src: 'data:...' });
    const results = lib.searchByTag('bomb');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('\u7EA2\u8272\u70B8\u5F39');
  });

  it('should find by asset key', async () => {
    await lib.save({ name: 'star', tags: ['star'], type: 'sprite', src: 'data:...' });
    const found = lib.findByKey('star');
    expect(found).toBeDefined();
  });

  it('should find by key and theme', async () => {
    await lib.save({ name: 'star-space', tags: ['star'], type: 'sprite', src: 'data:space', theme: 'space' });
    await lib.save({ name: 'star-fruit', tags: ['star'], type: 'sprite', src: 'data:fruit', theme: 'fruit' });
    const found = lib.findByKeyAndTheme('star', 'space');
    expect(found).toBeDefined();
    expect(found!.theme).toBe('space');
  });

  it('should NOT fall back to wrong theme — forces regeneration', async () => {
    await lib.save({ name: 'star', tags: ['star'], type: 'sprite', src: 'data:...' });
    const found = lib.findByKeyAndTheme('star', 'ocean');
    expect(found).toBeUndefined();
  });

  it('should fall back to key-only when no theme specified', async () => {
    await lib.save({ name: 'star', tags: ['star'], type: 'sprite', src: 'data:...' });
    const found = lib.findByKeyAndTheme('star');
    expect(found).toBeDefined();
    expect(found!.name).toBe('star');
  });

  it('should auto-generate unique name', () => {
    const name = lib.generateName('star', 'space');
    expect(name).toContain('space');
    expect(name).toContain('\u661F\u661F');
  });

  it('should generate Chinese name for known keys', () => {
    const name = lib.generateName('bomb');
    expect(name).toBe('\u70B8\u5F39');
  });

  it('should persist across instances via IndexedDB mock', async () => {
    await lib.save({ name: 'test', tags: ['test'], type: 'sprite', src: 'data:...' });
    const lib2 = new AssetLibrary();
    await lib2.ready();
    expect(lib2.getAll().length).toBeGreaterThan(0);
  });

  it('should remove an asset', async () => {
    const saved = await lib.save({ name: 'temp', tags: ['temp'], type: 'sprite', src: 'data:...' });
    expect(lib.getAll().length).toBe(1);
    await lib.remove(saved.id);
    expect(lib.getAll().length).toBe(0);
  });

  it('should clear all assets', async () => {
    await lib.save({ name: 'a', tags: ['a'], type: 'sprite', src: 'data:...' });
    await lib.save({ name: 'b', tags: ['b'], type: 'sprite', src: 'data:...' });
    expect(lib.getAll().length).toBe(2);
    await lib.clear();
    expect(lib.getAll().length).toBe(0);
  });
});
