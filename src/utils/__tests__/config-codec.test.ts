import { describe, it, expect } from 'vitest';
import { encodeConfig, decodeConfig, loadConfigFromHash } from '../config-codec';
import type { GameConfig } from '@/engine/core';

const makeConfig = (name: string): GameConfig => ({
  version: '1.0',
  meta: { name, description: '', thumbnail: null, createdAt: '' },
  canvas: { width: 1080, height: 1920 },
  modules: [],
  assets: {},
});

describe('config-codec', () => {
  it('round-trips ASCII config', () => {
    const config = makeConfig('Test Game');
    const encoded = encodeConfig(config);
    const decoded = decodeConfig(encoded);
    expect(decoded).toEqual(config);
  });

  it('round-trips Chinese text', () => {
    const config = makeConfig('接住类游戏');
    const encoded = encodeConfig(config);
    const decoded = decodeConfig(encoded);
    expect(decoded.meta.name).toBe('接住类游戏');
  });

  it('round-trips emoji', () => {
    const config = makeConfig('🎮 Game 🚀');
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded.meta.name).toBe('🎮 Game 🚀');
  });

  it('decodeConfig throws on invalid base64', () => {
    expect(() => decodeConfig('not-valid!!!')).toThrow();
  });

  it('loadConfigFromHash returns null for empty hash', () => {
    window.location.hash = '';
    expect(loadConfigFromHash()).toBeNull();
  });

  it('loadConfigFromHash returns null for invalid data', () => {
    window.location.hash = '#config=broken!!!';
    expect(loadConfigFromHash()).toBeNull();
  });

  it('loadConfigFromHash decodes valid config', () => {
    const config = makeConfig('分享测试');
    window.location.hash = `#config=${encodeConfig(config)}`;
    const result = loadConfigFromHash();
    expect(result).toEqual(config);
  });
});
