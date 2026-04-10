/**
 * Tests for config-path.ts — immutable path writer for GameConfig.
 *
 * H3: writeMeta must reject unknown/sentinel meta keys to prevent
 * LLM or buggy callers from overwriting protected fields like
 * heroPresetId, presetEnriched, or __proto__.
 */
import { describe, it, expect } from 'vitest';
import type { GameConfig } from '@/engine/core/index.ts';
import { applyConfigPath } from '../config-path.ts';

function makeConfig(): GameConfig {
  return {
    version: '1.0.0',
    meta: {
      name: 'Test',
      description: '',
      thumbnail: null,
      createdAt: '2026-01-01',
      theme: 'fruit',
      artStyle: 'cartoon',
    },
    canvas: { width: 1080, height: 1920 },
    modules: [],
    assets: {},
  };
}

describe('writeMeta — H3 allowlist enforcement', () => {
  it('rejects unknown meta key', () => {
    const config = makeConfig();
    const result = applyConfigPath(config, 'meta.unknownField', 'evil');
    // Should return config unchanged — unknown key not written
    expect((result.meta as Record<string, unknown>)['unknownField']).toBeUndefined();
  });

  it('rejects __proto__ key (prototype pollution)', () => {
    const config = makeConfig();
    const result = applyConfigPath(config, 'meta.__proto__', { polluted: true });
    // __proto__ should not be written as an own property
    expect(Object.hasOwn(result.meta, '__proto__')).toBe(false);
  });

  it('rejects presetEnriched key (sentinel field)', () => {
    const config = makeConfig();
    const result = applyConfigPath(config, 'meta.presetEnriched', true);
    expect((result.meta as Record<string, unknown>)['presetEnriched']).toBeUndefined();
  });

  it('rejects heroPresetId key (sentinel field)', () => {
    const config = makeConfig();
    const result = applyConfigPath(config, 'meta.heroPresetId', 'injected');
    expect((result.meta as Record<string, unknown>)['heroPresetId']).toBeUndefined();
  });

  it('allows known writable key: name', () => {
    const config = makeConfig();
    const result = applyConfigPath(config, 'meta.name', 'New Name');
    expect(result.meta.name).toBe('New Name');
  });

  it('allows known writable key: theme', () => {
    const config = makeConfig();
    const result = applyConfigPath(config, 'meta.theme', 'ocean');
    expect(result.meta.theme).toBe('ocean');
  });

  it('allows known writable key: artStyle', () => {
    const config = makeConfig();
    const result = applyConfigPath(config, 'meta.artStyle', 'pixel');
    expect(result.meta.artStyle).toBe('pixel');
  });

  it('allows known writable key: description', () => {
    const config = makeConfig();
    const result = applyConfigPath(config, 'meta.description', 'A fun game');
    expect(result.meta.description).toBe('A fun game');
  });

  it('allows known writable key: playerEmoji', () => {
    const config = makeConfig();
    const result = applyConfigPath(config, 'meta.playerEmoji', '🐱');
    expect(result.meta.playerEmoji).toBe('🐱');
  });

  it('allows known writable key: spriteSize', () => {
    const config = makeConfig();
    const result = applyConfigPath(config, 'meta.spriteSize', 128);
    expect(result.meta.spriteSize).toBe(128);
  });

  it('allows known writable key: background', () => {
    const config = makeConfig();
    const result = applyConfigPath(config, 'meta.background', 'forest.png');
    expect((result.meta as Record<string, unknown>)['background']).toBe('forest.png');
  });

  it('does not mutate the original config', () => {
    const config = makeConfig();
    const originalName = config.meta.name;
    applyConfigPath(config, 'meta.name', 'Changed');
    expect(config.meta.name).toBe(originalName);
  });
});
