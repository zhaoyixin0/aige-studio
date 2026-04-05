import { describe, it, expect, beforeEach } from 'vitest';
import { PresetRegistry } from '../preset-registry';
import type { PresetTemplate } from '../types';

const SHOOTING_TEMPLATE: PresetTemplate = {
  id: 'shooting-basic',
  title: 'Basic Shooting Game',
  gameType: 'shooting',
  tags: ['action', 'aim', 'physics'],
  params: [
    { name: 'spawnRate', type: 'number', default: 2, min: 0.5, max: 10 },
    { name: 'enemySpeed', type: 'number', default: 3 },
  ],
  sequence: {
    id: 'shooting-basic-seq',
    commands: [
      { name: 'addModule', args: { type: 'Spawner', id: 'Spawner_1', params: { frequency: '$spawnRate' } } },
      { name: 'addModule', args: { type: 'Aim', id: 'Aim_1', params: {} } },
      { name: 'addModule', args: { type: 'Collision', id: 'Collision_1', params: {} } },
    ],
  },
  requiredModules: ['Spawner', 'Aim', 'Collision'],
};

const CATCH_TEMPLATE: PresetTemplate = {
  id: 'catch-basic',
  title: 'Basic Catch Game',
  gameType: 'catch',
  tags: ['casual', 'reflex'],
  params: [
    { name: 'speed', type: 'number', default: 4 },
  ],
  sequence: {
    id: 'catch-basic-seq',
    commands: [
      { name: 'addModule', args: { type: 'Spawner', id: 'Spawner_1', params: {} } },
      { name: 'addModule', args: { type: 'Collision', id: 'Collision_1', params: {} } },
    ],
  },
  requiredModules: ['Spawner', 'Collision'],
};

const RUNNER_TEMPLATE: PresetTemplate = {
  id: 'runner-basic',
  title: 'Endless Runner',
  gameType: 'runner',
  tags: ['action', 'endless', 'casual'],
  params: [],
  sequence: {
    id: 'runner-basic-seq',
    commands: [
      { name: 'addModule', args: { type: 'Runner', id: 'Runner_1', params: {} } },
      { name: 'addModule', args: { type: 'ScrollingLayers', id: 'SL_1', params: {} } },
    ],
  },
  requiredModules: ['Runner', 'ScrollingLayers'],
};

describe('PresetRegistry', () => {
  let registry: PresetRegistry;

  beforeEach(() => {
    registry = new PresetRegistry();
    registry.register(SHOOTING_TEMPLATE);
    registry.register(CATCH_TEMPLATE);
    registry.register(RUNNER_TEMPLATE);
  });

  // ── Registration ──

  it('registers templates and reports count', () => {
    expect(registry.size()).toBe(3);
  });

  it('rejects duplicate id', () => {
    expect(() => registry.register(SHOOTING_TEMPLATE)).toThrow(/duplicate/i);
  });

  // ── Lookup ──

  it('gets template by id', () => {
    const t = registry.get('shooting-basic');
    expect(t).toBeDefined();
    expect(t!.title).toBe('Basic Shooting Game');
  });

  it('returns undefined for unknown id', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  // ── Query by gameType ──

  it('finds templates by gameType', () => {
    const results = registry.findByGameType('shooting');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('shooting-basic');
  });

  it('returns empty array for unknown gameType', () => {
    expect(registry.findByGameType('puzzle')).toHaveLength(0);
  });

  // ── Query by tag ──

  it('finds templates by single tag', () => {
    const results = registry.findByTag('action');
    expect(results).toHaveLength(2); // shooting + runner
  });

  it('finds templates by tag intersection', () => {
    const results = registry.findByTags(['casual', 'reflex']);
    expect(results).toHaveLength(1); // only catch has both
    expect(results[0].id).toBe('catch-basic');
  });

  it('returns empty for non-matching tag intersection', () => {
    const results = registry.findByTags(['physics', 'endless']);
    expect(results).toHaveLength(0);
  });

  // ── List all ──

  it('lists all templates', () => {
    const all = registry.listAll();
    expect(all).toHaveLength(3);
  });

  // ── Search by text ──

  it('searches by title substring (case-insensitive)', () => {
    const results = registry.search('shooting');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('shooting-basic');
  });

  it('searches by description or title', () => {
    const results = registry.search('endless');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('runner-basic');
  });

  it('returns empty for no match', () => {
    expect(registry.search('zzzzz')).toHaveLength(0);
  });

  // ── Unregister ──

  it('unregisters a template', () => {
    expect(registry.unregister('catch-basic')).toBe(true);
    expect(registry.size()).toBe(2);
    expect(registry.get('catch-basic')).toBeUndefined();
  });

  it('returns false when unregistering unknown id', () => {
    expect(registry.unregister('ghost')).toBe(false);
  });

  // ── Required modules query ──

  it('lists unique required modules across all templates', () => {
    const mods = registry.allRequiredModules();
    expect(mods).toContain('Spawner');
    expect(mods).toContain('Aim');
    expect(mods).toContain('Runner');
    expect(mods).toContain('ScrollingLayers');
  });

  // ── Bulk register ──

  it('bulk registers multiple templates', () => {
    const fresh = new PresetRegistry();
    fresh.registerAll([SHOOTING_TEMPLATE, CATCH_TEMPLATE]);
    expect(fresh.size()).toBe(2);
  });
});
