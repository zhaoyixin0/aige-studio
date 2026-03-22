import { describe, it, expect } from 'vitest';
import { WebExporter } from '../web-exporter';
import { RuntimeBundler } from '../runtime-bundler';
import type { GameConfig } from '@/engine/core';

const MOCK_CONFIG: GameConfig = {
  version: '1.0.0',
  meta: { name: 'Test Game', description: '', thumbnail: null, createdAt: '' },
  canvas: { width: 1080, height: 1920 },
  modules: [
    { id: 'scorer_1', type: 'Scorer', enabled: true, params: { pointsPerHit: 10 } },
    { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: 30, mode: 'countdown' } },
    { id: 'spawner_1', type: 'Spawner', enabled: true, params: {} },
  ],
  assets: {},
};

describe('WebExporter', () => {
  it('should export valid HTML with embedded config', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(MOCK_CONFIG);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test Game');
    expect(html).toContain('<canvas');
  });

  it('should include game runtime script', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(MOCK_CONFIG);
    expect(html).toContain('<script>');
    expect(html).toContain('CONFIG');
    expect(html).toContain('requestAnimationFrame');
  });

  it('should respect export options', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(MOCK_CONFIG, {
      title: 'Custom Title',
      width: 800,
      height: 600,
    });
    expect(html).toContain('Custom Title');
    expect(html).toContain('width="800"');
    expect(html).toContain('height="600"');
  });

  it('should use config dimensions when options not provided', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(MOCK_CONFIG);
    expect(html).toContain('width="1080"');
    expect(html).toContain('height="1920"');
  });

  it('should produce a self-contained HTML document', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(MOCK_CONFIG);
    // Must have opening and closing html tags
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    // Must have a <script> with the IIFE
    expect(html).toMatch(/<script>\s*\n\(function\(\)/);
    expect(html).toContain('</script>');
    // Should not reference external scripts
    expect(html).not.toMatch(/src=["'][^"']+["']/);
  });

  it('should escape HTML characters in title', async () => {
    const config: GameConfig = {
      ...MOCK_CONFIG,
      meta: { ...MOCK_CONFIG.meta, name: 'Game <b>"test"</b>' },
    };
    const exporter = new WebExporter();
    const html = await exporter.export(config);
    // The <title> tag should contain escaped HTML
    expect(html).toMatch(/<title>Game &lt;b&gt;&quot;test&quot;&lt;\/b&gt;<\/title>/);
  });

  it('should include touch event handling', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(MOCK_CONFIG);
    expect(html).toContain('pointerdown');
    expect(html).toContain('touch:tap');
  });

  it('should include canvas 2d rendering code', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(MOCK_CONFIG);
    expect(html).toContain('getContext');
    expect(html).toContain('fillRect');
    expect(html).toContain('arc');
  });

  it('should include game-over logic', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(MOCK_CONFIG);
    expect(html).toContain('Game Over');
    expect(html).toContain("game:over");
  });
});

describe('RuntimeBundler', () => {
  it('should embed the config as JSON', () => {
    const bundler = new RuntimeBundler();
    const js = bundler.bundle(MOCK_CONFIG);
    expect(js).toContain(JSON.stringify(MOCK_CONFIG));
  });

  it('should include EventBus implementation', () => {
    const bundler = new RuntimeBundler();
    const js = bundler.bundle(MOCK_CONFIG);
    expect(js).toContain('bus');
    expect(js).toContain('.on');
    expect(js).toContain('.emit');
  });

  it('should generate spawner code when Spawner module is present', () => {
    const bundler = new RuntimeBundler();
    const js = bundler.bundle(MOCK_CONFIG);
    expect(js).toContain('spawnObject');
    expect(js).toContain('spawnInterval');
  });

  it('should generate timer countdown when Timer module is present', () => {
    const bundler = new RuntimeBundler();
    const js = bundler.bundle(MOCK_CONFIG);
    expect(js).toContain('timeLeft');
    expect(js).toContain('countdown');
  });

  it('should use timer duration from module params', () => {
    const bundler = new RuntimeBundler();
    expect(bundler.getTimerDuration(MOCK_CONFIG.modules)).toBe(30);
  });

  it('should default timer duration to 30 when no Timer module', () => {
    const bundler = new RuntimeBundler();
    expect(bundler.getTimerDuration([])).toBe(30);
  });

  it('should default lives count to 3 when no Lives module', () => {
    const bundler = new RuntimeBundler();
    expect(bundler.getLivesCount([])).toBe(3);
  });

  it('should extract lives count from Lives module params', () => {
    const bundler = new RuntimeBundler();
    const modules = [
      { id: 'lives_1', type: 'Lives', enabled: true, params: { count: 5 } },
    ];
    expect(bundler.getLivesCount(modules)).toBe(5);
  });

  it('should include scorer points in hit handler', () => {
    const bundler = new RuntimeBundler();
    const js = bundler.bundle(MOCK_CONFIG);
    expect(js).toContain('score += 10');
  });

  it('should only include enabled modules', () => {
    const config: GameConfig = {
      ...MOCK_CONFIG,
      modules: [
        { id: 'scorer_1', type: 'Scorer', enabled: true, params: { pointsPerHit: 5 } },
        { id: 'spawner_1', type: 'Spawner', enabled: false, params: {} },
      ],
    };
    const bundler = new RuntimeBundler();
    const js = bundler.bundle(config);
    // Scorer is enabled so its points should appear
    expect(js).toContain('score += 5');
    // Spawner is disabled so spawner code should not appear
    expect(js).not.toContain('spawnObject');
  });
});
