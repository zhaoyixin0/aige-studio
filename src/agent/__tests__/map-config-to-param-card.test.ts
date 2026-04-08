import { describe, it, expect } from 'vitest';
import { mapConfigToParamCard } from '../conversation-helpers';
import type { GameConfig } from '@/engine/core';

describe('mapConfigToParamCard', () => {
  const baseConfig: GameConfig = {
    version: '1.0.0',
    meta: { name: 'Test', description: '', thumbnail: null, createdAt: '', theme: 'fruit', artStyle: 'cartoon' },
    canvas: { width: 1080, height: 1920 },
    modules: [
      { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: 30 } },
      { id: 'spawner_1', type: 'Spawner', enabled: true, params: { spawnInterval: 1000 } },
    ],
    assets: {
      player: { type: 'sprite', src: 'data:image/png;base64,AAA' },
      good_1: { type: 'sprite', src: 'data:image/png;base64,BBB' },
    },
  };

  it('returns a param-card ChatBlock with kind set', () => {
    const block = mapConfigToParamCard(baseConfig);
    expect(block.kind).toBe('param-card');
  });

  it('includes Timer duration slider with key Timer:duration', () => {
    const block = mapConfigToParamCard(baseConfig);
    const slider = block.fields.find(f => f.kind === 'slider' && f.key === 'Timer:duration');
    expect(slider).toBeDefined();
    if (slider?.kind === 'slider') {
      expect(slider.value).toBe(30);
    }
  });

  it('includes Spawner spawnInterval slider', () => {
    const block = mapConfigToParamCard(baseConfig);
    const slider = block.fields.find(f => f.kind === 'slider' && f.key === 'Spawner:spawnInterval');
    expect(slider).toBeDefined();
  });

  it('includes asset fields for player and good_1', () => {
    const block = mapConfigToParamCard(baseConfig);
    const player = block.fields.find(f => f.kind === 'asset' && f.key === 'player');
    const item = block.fields.find(f => f.kind === 'asset' && f.key === 'good_1');
    expect(player).toBeDefined();
    expect(item).toBeDefined();
  });

  it('uses category parameter as title', () => {
    const block = mapConfigToParamCard(baseConfig, 'catch');
    expect(block.title).toContain('catch');
  });

  it('skips fields for missing modules', () => {
    const minimalConfig = { ...baseConfig, modules: [] };
    const block = mapConfigToParamCard(minimalConfig);
    const sliders = block.fields.filter(f => f.kind === 'slider');
    expect(sliders.length).toBe(0);
  });
});
