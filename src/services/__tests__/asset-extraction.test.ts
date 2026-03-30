import { describe, it, expect } from 'vitest';
import { extractAssetKeys } from '../asset-agent';
import type { GameConfig } from '@/engine/core';

/** Helper to build a minimal GameConfig for testing extraction. */
function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    modules: [],
    assets: {},
    meta: { name: 'test-game', theme: 'fruit' },
    ...overrides,
  } as GameConfig;
}

describe('extractAssetKeys', () => {
  // ── Existing behavior ────────────────────────────────────────

  it('should extract keys from config.assets', () => {
    const config = makeConfig({ assets: { player: { type: 'sprite', src: '' }, bg: { type: 'background', src: '' } } });
    const keys = extractAssetKeys(config);
    expect(keys).toContain('player');
    expect(keys).toContain('bg');
  });

  it('should extract player key when Spawner module exists', () => {
    const config = makeConfig({ modules: [{ type: 'Spawner', params: { items: [{ asset: 'good_1' }] } }] });
    const keys = extractAssetKeys(config);
    expect(keys).toContain('player');
    expect(keys).toContain('good_1');
  });

  // ── P0: EnemyAI asset extraction ─────────────────────────────

  it('should extract enemy asset key from EnemyAI module', () => {
    const config = makeConfig({
      modules: [{ type: 'EnemyAI', params: { asset: 'enemy_1' } }],
    });
    const keys = extractAssetKeys(config);
    expect(keys).toContain('enemy_1');
  });

  it('should add default enemy_1 key when EnemyAI has no asset param', () => {
    const config = makeConfig({
      modules: [{ type: 'EnemyAI', params: {} }],
    });
    const keys = extractAssetKeys(config);
    expect(keys).toContain('enemy_1');
  });

  // ── P0: Projectile asset extraction ──────────────────────────

  it('should extract bullet asset key from Projectile module', () => {
    const config = makeConfig({
      modules: [{ type: 'Projectile', params: { asset: 'plasma_bolt' } }],
    });
    const keys = extractAssetKeys(config);
    expect(keys).toContain('plasma_bolt');
  });

  it('should add default bullet key when Projectile has no asset param', () => {
    const config = makeConfig({
      modules: [{ type: 'Projectile', params: {} }],
    });
    const keys = extractAssetKeys(config);
    expect(keys).toContain('bullet');
  });

  // ── P1: EnemyDrop asset extraction ───────────────────────────

  it('should extract asset keys from EnemyDrop lootTable entries', () => {
    const config = makeConfig({
      modules: [{
        type: 'EnemyDrop',
        params: {
          lootTable: [
            { item: 'health_potion', asset: 'drop_health', weight: 1, minCount: 1, maxCount: 1, type: 'health' },
            { item: 'gold', asset: 'drop_gold', weight: 2, minCount: 1, maxCount: 3, type: 'collectible' },
          ],
        },
      }],
    });
    const keys = extractAssetKeys(config);
    expect(keys).toContain('drop_health');
    expect(keys).toContain('drop_gold');
  });

  it('should use item name as asset key when lootTable entry has no asset field', () => {
    const config = makeConfig({
      modules: [{
        type: 'EnemyDrop',
        params: {
          lootTable: [
            { item: 'gem', weight: 1, minCount: 1, maxCount: 1, type: 'collectible' },
          ],
        },
      }],
    });
    const keys = extractAssetKeys(config);
    expect(keys).toContain('gem');
  });

  // ── P2: DialogueSystem portrait extraction ───────────────────

  it('should extract portrait asset keys from DialogueSystem dialogues', () => {
    const config = makeConfig({
      modules: [{
        type: 'DialogueSystem',
        params: {
          dialogues: {
            intro: {
              id: 'intro',
              startNode: 'n1',
              nodes: {
                n1: { id: 'n1', speaker: 'Elder', text: 'Hello', portrait: 'npc_elder' },
                n2: { id: 'n2', speaker: 'Merchant', text: 'Buy?', portrait: 'npc_merchant' },
              },
            },
          },
        },
      }],
    });
    const keys = extractAssetKeys(config);
    expect(keys).toContain('npc_elder');
    expect(keys).toContain('npc_merchant');
  });

  it('should not crash when DialogueSystem has no dialogues', () => {
    const config = makeConfig({
      modules: [{ type: 'DialogueSystem', params: {} }],
    });
    const keys = extractAssetKeys(config);
    expect(keys).not.toContain('undefined');
  });

  it('should not crash when DialogueSystem has malformed dialogue trees', () => {
    const config = makeConfig({
      modules: [{
        type: 'DialogueSystem',
        params: {
          dialogues: {
            broken1: null,
            broken2: 'not-an-object',
            broken3: { nodes: null },
            broken4: { nodes: 'not-an-object' },
            broken5: { nodes: { n1: null } },
            broken6: { nodes: { n1: { portrait: 42 } } },
          },
        },
      }],
    });
    // Should not throw, just skip malformed entries
    const keys = extractAssetKeys(config);
    expect(keys).toBeDefined();
  });

  // ── Combined scenario ────────────────────────────────────────

  it('should extract all asset types from a full shooting + RPG config', () => {
    const config = makeConfig({
      assets: { player: { type: 'sprite', src: '' }, background: { type: 'background', src: '' } },
      modules: [
        { type: 'PlayerMovement', params: {} },
        { type: 'Projectile', params: { asset: 'laser' } },
        { type: 'EnemyAI', params: { asset: 'zombie' } },
        { type: 'EnemyDrop', params: { lootTable: [{ item: 'coin', asset: 'drop_coin', weight: 1, minCount: 1, maxCount: 1, type: 'collectible' }] } },
        { type: 'DialogueSystem', params: { dialogues: { d1: { id: 'd1', startNode: 'n1', nodes: { n1: { id: 'n1', speaker: 'NPC', text: 'Hi', portrait: 'npc_guide' } } } } } },
      ],
    });
    const keys = extractAssetKeys(config);
    expect(keys).toContain('player');
    expect(keys).toContain('background');
    expect(keys).toContain('laser');
    expect(keys).toContain('zombie');
    expect(keys).toContain('drop_coin');
    expect(keys).toContain('npc_guide');
  });
});
