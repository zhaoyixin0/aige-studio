import { BaseModule } from '../base-module';
import { ScrollingLayersSystem } from '@/engine/systems/scrolling-layers/scrolling-layers-system';
import type { LayerState, ParallaxLayerConfig } from '@/engine/systems/scrolling-layers/types';
import type { ModuleSchema } from '@/engine/core/types';
import type { ModuleContracts } from '@/engine/core/contracts';

export class ScrollingLayers extends BaseModule {
  readonly type = 'ScrollingLayers';

  private system: ScrollingLayersSystem | null = null;

  getSchema(): ModuleSchema {
    return {
      axis: { type: 'select', label: 'Scroll Axis', options: ['horizontal', 'vertical', 'both'], default: 'horizontal' },
      baseSpeed: { type: 'range', label: 'Base Speed (px/s)', min: 10, max: 1000, step: 10, default: 200 },
      direction: { type: 'select', label: 'Direction', options: ['-1', '1'], default: '-1' },
      layers: { type: 'object', label: 'Parallax Layers', default: [] },
    };
  }

  getContracts(): ModuleContracts {
    return {
      emits: ['scrolling:update'],
      consumes: ['gameflow:pause', 'gameflow:resume', 'scrolling:set-speed', 'scrolling:set-direction'],
      capabilities: ['parallax-controller'],
    };
  }

  init(engine: import('@/engine/core/types').GameEngine): void {
    super.init(engine);

    const canvas = engine.getCanvas();
    const axis = (this.params.axis as string) ?? 'horizontal';
    const baseSpeed = (this.params.baseSpeed as number) ?? 200;
    const dir = Number(this.params.direction ?? -1) as 1 | -1;
    const rawLayers = this.params.layers;

    const layers: ParallaxLayerConfig[] = [];
    if (Array.isArray(rawLayers)) {
      for (const l of rawLayers) {
        if (l && typeof l === 'object' && typeof l.textureId === 'string' && typeof l.ratio === 'number') {
          layers.push(l as ParallaxLayerConfig);
        }
      }
    }

    this.system = new ScrollingLayersSystem({
      axis: axis as 'horizontal' | 'vertical' | 'both',
      baseSpeed,
      direction: dir,
      loop: true,
      viewWidth: canvas.width,
      viewHeight: canvas.height,
      layers,
    });

    this.on('scrolling:set-speed', (data?: unknown) => {
      if (!data || typeof data !== 'object' || !this.system) return;
      const d = data as Record<string, unknown>;
      if (typeof d.speed === 'number') {
        this.system.setSpeed(d.speed);
      }
    });

    this.on('scrolling:set-direction', (data?: unknown) => {
      if (!data || typeof data !== 'object' || !this.system) return;
      const d = data as Record<string, unknown>;
      if (d.direction === 1 || d.direction === -1) {
        this.system.setDirection(d.direction);
      }
    });
  }

  update(dt: number): void {
    if (this.gameflowPaused || !this.system) return;
    this.system.update(dt);
    this.emit('scrolling:update', { layers: this.system.getLayerStates() });
  }

  getLayerStates(): readonly LayerState[] {
    return this.system?.getLayerStates() ?? [];
  }

  destroy(): void {
    this.system = null;
    super.destroy();
  }
}
