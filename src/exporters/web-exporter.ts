import type { GameConfig } from '@/engine/core';
import { RuntimeBundler } from './runtime-bundler';

export interface WebExportOptions {
  width?: number;
  height?: number;
  title?: string;
  includeCamera?: boolean;
}

/**
 * Generates standalone HTML game files from a GameConfig.
 * The output is a single self-contained HTML string that works
 * in any modern browser (desktop + mobile).
 */
export class WebExporter {
  private bundler = new RuntimeBundler();

  async export(config: GameConfig, options?: WebExportOptions): Promise<string> {
    // 1. Generate runtime JS from config
    const runtimeJs = this.generateRuntime(config, options);

    // 2. Generate HTML wrapper
    return this.generateHtml(config, runtimeJs, options);
  }

  private generateRuntime(config: GameConfig, _options?: WebExportOptions): string {
    return this.bundler.bundle(config);
  }

  private generateHtml(
    config: GameConfig,
    runtimeJs: string,
    options?: WebExportOptions,
  ): string {
    const title = options?.title ?? config.meta.name ?? 'AIGE Game';
    const width = options?.width ?? config.canvas.width;
    const height = options?.height ?? config.canvas.height;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#000; display:flex; justify-content:center; align-items:center; height:100vh; overflow:hidden; touch-action:none; }
    canvas { max-width:100vw; max-height:100vh; }
  </style>
</head>
<body>
  <canvas id="game" width="${width}" height="${height}"></canvas>
  <script>${runtimeJs}</script>
</body>
</html>`;
  }
}

/** Escape special HTML characters in text content. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
