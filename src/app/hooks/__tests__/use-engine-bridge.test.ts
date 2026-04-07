import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGameStore } from '@/store/game-store';
import type { GameConfig } from '@/engine/core';

// Mock the EngineContext
const mockGetModule = vi.fn();
const mockEngine = {
  getModule: mockGetModule,
};

vi.mock('@/app/hooks/use-engine', () => ({
  useEngineContext: () => ({
    engineRef: { current: mockEngine },
    rendererRef: { current: null },
    setMountEl: vi.fn(),
    loadConfig: vi.fn(),
    getModuleSchema: vi.fn(),
    ready: true,
  }),
}));

vi.mock('@/engine/core/config-loader', () => ({
  ConfigLoader: vi.fn(),
}));

import {
  createEngineBridge,
  buildConfigChanges,
} from '../use-engine-bridge';

const makeConfig = (): GameConfig => ({
  version: '1.0',
  modules: [
    { id: 'spawner', type: 'Spawner', enabled: true, params: { frequency: 1, speed: 200 } },
    { id: 'scorer', type: 'Scorer', enabled: true, params: { perHit: 10 } },
  ],
  assets: {},
  canvas: { width: 1080, height: 1920 },
  meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
});

describe('use-engine-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.setState({ config: makeConfig(), configVersion: 0 });
  });

  describe('buildConfigChanges', () => {
    it('generates update_param changes by diffing old and new configs', () => {
      const oldConfig = makeConfig();
      const newConfig: GameConfig = {
        ...oldConfig,
        modules: oldConfig.modules.map((m) =>
          m.id === 'spawner'
            ? { ...m, params: { ...m.params, frequency: 5, speed: 400 } }
            : m,
        ),
      };

      const changes = buildConfigChanges(oldConfig, newConfig);

      expect(changes.length).toBe(1);
      expect(changes[0].op).toBe('update_param');
      expect(changes[0].moduleId).toBe('spawner');
      expect(changes[0].params).toEqual({ frequency: 5, speed: 400 });
    });

    it('returns empty array when configs are identical', () => {
      const config = makeConfig();
      const changes = buildConfigChanges(config, config);
      expect(changes).toEqual([]);
    });

    it('detects changes across multiple modules', () => {
      const oldConfig = makeConfig();
      const newConfig: GameConfig = {
        ...oldConfig,
        modules: oldConfig.modules.map((m) => {
          if (m.id === 'spawner') return { ...m, params: { ...m.params, frequency: 2 } };
          if (m.id === 'scorer') return { ...m, params: { ...m.params, perHit: 20 } };
          return m;
        }),
      };

      const changes = buildConfigChanges(oldConfig, newConfig);
      expect(changes.length).toBe(2);
    });

    it('only includes changed params, not unchanged ones', () => {
      const oldConfig = makeConfig();
      const newConfig: GameConfig = {
        ...oldConfig,
        modules: oldConfig.modules.map((m) =>
          m.id === 'spawner'
            ? { ...m, params: { ...m.params, frequency: 5 } } // speed unchanged
            : m,
        ),
      };

      const changes = buildConfigChanges(oldConfig, newConfig);
      expect(changes.length).toBe(1);
      expect(changes[0].params).toEqual({ frequency: 5 });
      expect(changes[0].params).not.toHaveProperty('speed');
    });

    it('emits disable_module when enabled changes true→false', () => {
      const oldConfig = makeConfig();
      const newConfig: GameConfig = {
        ...oldConfig,
        modules: oldConfig.modules.map((m) =>
          m.id === 'spawner' ? { ...m, enabled: false } : m,
        ),
      };

      const changes = buildConfigChanges(oldConfig, newConfig);
      expect(changes).toContainEqual(
        expect.objectContaining({
          op: 'disable_module',
          moduleId: 'spawner',
        }),
      );
    });

    it('emits enable_module when enabled changes false→true', () => {
      const oldConfig = makeConfig();
      const disabledConfig: GameConfig = {
        ...oldConfig,
        modules: oldConfig.modules.map((m) =>
          m.id === 'spawner' ? { ...m, enabled: false } : m,
        ),
      };
      const reenabledConfig: GameConfig = {
        ...disabledConfig,
        modules: disabledConfig.modules.map((m) =>
          m.id === 'spawner'
            ? { ...m, enabled: true }
            : m,
        ),
      };

      const changes = buildConfigChanges(disabledConfig, reenabledConfig);
      expect(changes).toContainEqual(
        expect.objectContaining({
          op: 'enable_module',
          moduleId: 'spawner',
          type: 'Spawner',
          params: expect.objectContaining({ frequency: 1, speed: 200 }),
        }),
      );
    });

    it('emits both enable/disable and update_param when both change simultaneously', () => {
      const oldConfig = makeConfig();
      const newConfig: GameConfig = {
        ...oldConfig,
        modules: oldConfig.modules.map((m) =>
          m.id === 'spawner'
            ? { ...m, enabled: false, params: { ...m.params, frequency: 10 } }
            : m,
        ),
      };

      const changes = buildConfigChanges(oldConfig, newConfig);
      const disableChange = changes.find((c) => c.op === 'disable_module');
      const paramChange = changes.find((c) => c.op === 'update_param');

      expect(disableChange).toBeDefined();
      expect(disableChange!.moduleId).toBe('spawner');

      expect(paramChange).toBeDefined();
      expect(paramChange!.moduleId).toBe('spawner');
      expect(paramChange!.params).toEqual({ frequency: 10 });
    });
  });

  describe('createEngineBridge', () => {
    it('is a function', () => {
      expect(typeof createEngineBridge).toBe('function');
    });
  });
});
