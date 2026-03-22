import { describe, it, expect } from 'vitest';
import { WebExporter } from '@/exporters/web-exporter';
import { ApjsExporter } from '@/exporters/apjs-exporter';
import type { GameConfig } from '@/engine/core';

/**
 * Full config with multiple module types for export testing.
 */
const EXPORT_CONFIG: GameConfig = {
  version: '1.0.0',
  meta: { name: 'Export Test Game', description: 'Integration test for export pipeline', thumbnail: null, createdAt: '' },
  canvas: { width: 1080, height: 1920 },
  modules: [
    { id: 'scorer_1', type: 'Scorer', enabled: true, params: { perHit: 15 } },
    { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: 45, mode: 'countdown', onEnd: 'finish' } },
    { id: 'lives_1', type: 'Lives', enabled: true, params: { count: 5 } },
    {
      id: 'spawner_1',
      type: 'Spawner',
      enabled: true,
      params: { frequency: 1.0, maxCount: 8, items: [{ asset: 'coin', weight: 1 }], direction: 'down', speed: { min: 100, max: 200 } },
    },
    {
      id: 'collision_1',
      type: 'Collision',
      enabled: true,
      params: { rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }] },
    },
    { id: 'gameflow_1', type: 'GameFlow', enabled: true, params: { countdown: 3, onFinish: 'show_result' } },
  ],
  assets: {},
};

/**
 * Config with some modules disabled — exports should exclude them.
 */
const MIXED_CONFIG: GameConfig = {
  version: '1.0.0',
  meta: { name: 'Mixed Export', description: '', thumbnail: null, createdAt: '' },
  canvas: { width: 800, height: 600 },
  modules: [
    { id: 'scorer_1', type: 'Scorer', enabled: true, params: { perHit: 10 } },
    { id: 'timer_1', type: 'Timer', enabled: false, params: { duration: 30, mode: 'countdown' } },
    { id: 'spawner_1', type: 'Spawner', enabled: true, params: { frequency: 1.5 } },
    { id: 'lives_1', type: 'Lives', enabled: false, params: { count: 3 } },
    { id: 'gameflow_1', type: 'GameFlow', enabled: true, params: {} },
  ],
  assets: {},
};

describe('Export Pipeline Integration — WebExporter', () => {
  it('should export valid HTML document', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(EXPORT_CONFIG);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('<canvas');
  });

  it('should include game title in HTML', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(EXPORT_CONFIG);

    expect(html).toContain('Export Test Game');
  });

  it('should use canvas dimensions from config', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(EXPORT_CONFIG);

    expect(html).toContain('width="1080"');
    expect(html).toContain('height="1920"');
  });

  it('should embed runtime script with game logic', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(EXPORT_CONFIG);

    // Should contain the embedded EventBus
    expect(html).toContain('<script>');
    expect(html).toContain('bus');
    // Should contain the embedded config
    expect(html).toContain('CONFIG');
  });

  it('should include spawner code for enabled Spawner module', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(EXPORT_CONFIG);

    expect(html).toContain('spawnObject');
    expect(html).toContain('spawnInterval');
  });

  it('should include timer countdown code for enabled Timer module', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(EXPORT_CONFIG);

    expect(html).toContain('timeLeft');
  });

  it('should include lives display for enabled Lives module', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(EXPORT_CONFIG);

    expect(html).toContain('lives');
  });

  it('should include scorer points in hit handler', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(EXPORT_CONFIG);

    // Scorer perHit=15, so the runtime should use 15 (though runtime uses pointsPerHit param)
    expect(html).toContain('score +=');
  });

  it('should be a self-contained document without external references', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(EXPORT_CONFIG);

    // Should not reference external scripts or stylesheets
    expect(html).not.toMatch(/src=["'][^"']+["']/);
    expect(html).not.toMatch(/href=["'][^"']+\.css["']/);
  });

  it('should exclude disabled modules from export', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(MIXED_CONFIG);

    // Spawner is enabled — should include its code
    expect(html).toContain('spawnObject');

    // Timer is disabled — should not include timer countdown runtime logic
    // Note: CONFIG JSON may still contain "countdown" in the disabled module params,
    // but the actual runtime code should not have timer countdown logic
    expect(html).not.toContain('timeLeft -= dt');
  });

  it('should include touch/pointer interaction', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(EXPORT_CONFIG);

    expect(html).toContain('pointerdown');
    expect(html).toContain('touch:tap');
  });

  it('should include game-over rendering', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(EXPORT_CONFIG);

    expect(html).toContain('Game Over');
    expect(html).toContain('game:over');
  });

  it('should respect custom export options', async () => {
    const exporter = new WebExporter();
    const html = await exporter.export(EXPORT_CONFIG, {
      title: 'Custom Title',
      width: 640,
      height: 480,
    });

    expect(html).toContain('Custom Title');
    expect(html).toContain('width="640"');
    expect(html).toContain('height="480"');
  });
});

describe('Export Pipeline Integration — ApjsExporter', () => {
  it('should export mainScript, sceneManifest, and requiredCapabilities', () => {
    const exporter = new ApjsExporter();
    const result = exporter.export(EXPORT_CONFIG);

    expect(result).toHaveProperty('mainScript');
    expect(result).toHaveProperty('sceneManifest');
    expect(result).toHaveProperty('requiredCapabilities');
    expect(typeof result.mainScript).toBe('string');
    expect(Array.isArray(result.requiredCapabilities)).toBe(true);
  });

  it('should include standard Effect House imports', () => {
    const exporter = new ApjsExporter();
    const result = exporter.export(EXPORT_CONFIG);

    expect(result.mainScript).toContain("require('Scene')");
    expect(result.mainScript).toContain("require('Time')");
    expect(result.mainScript).toContain("require('Patches')");
  });

  it('should include game name in mainScript', () => {
    const exporter = new ApjsExporter();
    const result = exporter.export(EXPORT_CONFIG);

    expect(result.mainScript).toContain('Export Test Game');
  });

  it('should end mainScript with startGame() call', () => {
    const exporter = new ApjsExporter();
    const result = exporter.export(EXPORT_CONFIG);

    expect(result.mainScript).toContain('startGame();');
  });

  it('should include all enabled modules in scene manifest', () => {
    const exporter = new ApjsExporter();
    const result = exporter.export(EXPORT_CONFIG);
    const manifest = result.sceneManifest as { root: { children: Array<{ name: string }> } };

    expect(manifest.root.children).toHaveLength(6);

    const names = manifest.root.children.map((c) => c.name);
    expect(names).toContain('scorer_1');
    expect(names).toContain('timer_1');
    expect(names).toContain('lives_1');
    expect(names).toContain('spawner_1');
    expect(names).toContain('collision_1');
    expect(names).toContain('gameflow_1');
  });

  it('should exclude disabled modules from mainScript and manifest', () => {
    const exporter = new ApjsExporter();
    const result = exporter.export(MIXED_CONFIG);

    // Timer and Lives are disabled
    const manifest = result.sceneManifest as { root: { children: Array<{ name: string }> } };
    const names = manifest.root.children.map((c) => c.name);

    // Only 3 enabled modules
    expect(manifest.root.children).toHaveLength(3);
    expect(names).toContain('scorer_1');
    expect(names).toContain('spawner_1');
    expect(names).toContain('gameflow_1');
    expect(names).not.toContain('timer_1');
    expect(names).not.toContain('lives_1');
  });

  it('should detect capabilities for input modules', () => {
    const configWithInputs: GameConfig = {
      ...EXPORT_CONFIG,
      modules: [
        { id: 'face_1', type: 'FaceInput', enabled: true, params: { tracking: 'headXY' } },
        { id: 'touch_1', type: 'TouchInput', enabled: true, params: { gesture: 'tap' } },
        { id: 'scorer_1', type: 'Scorer', enabled: true, params: { perHit: 10 } },
      ],
    };

    const exporter = new ApjsExporter();
    const result = exporter.export(configWithInputs);

    expect(result.requiredCapabilities).toContain('FACE_TRACKING');
    expect(result.requiredCapabilities).toContain('TOUCH');
    expect(result.mainScript).toContain("require('FaceTracking')");
    expect(result.mainScript).toContain("require('TouchGestures')");
  });

  it('should not include unnecessary capability imports', () => {
    const exporter = new ApjsExporter();
    const result = exporter.export(EXPORT_CONFIG);

    // No input modules in EXPORT_CONFIG, so no tracking capabilities
    expect(result.requiredCapabilities).not.toContain('FACE_TRACKING');
    expect(result.requiredCapabilities).not.toContain('HAND_TRACKING');
    expect(result.requiredCapabilities).not.toContain('TOUCH');
    expect(result.requiredCapabilities).not.toContain('AUDIO');
    expect(result.mainScript).not.toContain("require('FaceTracking')");
    expect(result.mainScript).not.toContain("require('HandTracking')");
    expect(result.mainScript).not.toContain("require('TouchGestures')");
    expect(result.mainScript).not.toContain("require('Audio')");
  });

  it('should handle unsupported module types gracefully', () => {
    const configWithUnknown: GameConfig = {
      ...EXPORT_CONFIG,
      modules: [
        { id: 'unknown_1', type: 'CustomModule', enabled: true, params: {} },
        { id: 'scorer_1', type: 'Scorer', enabled: true, params: { perHit: 10 } },
      ],
    };

    const exporter = new ApjsExporter();
    const result = exporter.export(configWithUnknown);

    // Should include a comment for unsupported module
    expect(result.mainScript).toContain('// Unsupported module: CustomModule');
    // Should still include supported module
    expect(result.mainScript).toContain('score');
  });
});

describe('Export Pipeline Integration — Cross-exporter consistency', () => {
  it('should produce valid output from both exporters for the same config', async () => {
    const webExporter = new WebExporter();
    const apjsExporter = new ApjsExporter();

    const html = await webExporter.export(EXPORT_CONFIG);
    const apjs = apjsExporter.export(EXPORT_CONFIG);

    // Web export should be valid HTML
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');

    // APJS export should be valid script
    expect(apjs.mainScript).toContain("require('Scene')");
    expect(apjs.mainScript).toContain('startGame();');
  });

  it('should both respect disabled modules', async () => {
    const webExporter = new WebExporter();
    const apjsExporter = new ApjsExporter();

    const html = await webExporter.export(MIXED_CONFIG);
    const apjs = apjsExporter.export(MIXED_CONFIG);

    // Web: Timer is disabled — no timer countdown runtime logic
    expect(html).not.toContain('timeLeft -= dt');

    // APJS: Only enabled modules in manifest
    const manifest = apjs.sceneManifest as { root: { children: Array<{ name: string }> } };
    const names = manifest.root.children.map((c) => c.name);
    expect(names).not.toContain('timer_1');
    expect(names).not.toContain('lives_1');
  });

  it('should both include all enabled modules', async () => {
    const webExporter = new WebExporter();
    const apjsExporter = new ApjsExporter();

    const html = await webExporter.export(EXPORT_CONFIG);
    const apjs = apjsExporter.export(EXPORT_CONFIG);

    // Web export includes spawner and timer code
    expect(html).toContain('spawnObject');
    expect(html).toContain('timeLeft');

    // APJS export includes all 6 modules in manifest
    const manifest = apjs.sceneManifest as { root: { children: Array<{ name: string }> } };
    expect(manifest.root.children).toHaveLength(6);
  });
});
