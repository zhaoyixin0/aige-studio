import type { ScrollingLayersConfig, LayerState } from './types';

interface MutableLayerState {
  textureId: string;
  ratio: number;
  offsetX: number;
  offsetY: number;
}

export class ScrollingLayersSystem {
  private readonly config: ScrollingLayersConfig;
  private readonly layers: MutableLayerState[];
  private speed: number;
  private direction: 1 | -1;
  private paused = false;

  constructor(config: ScrollingLayersConfig) {
    this.config = config;
    this.speed = config.baseSpeed;
    this.direction = config.direction;

    this.layers = config.layers.map((l) => ({
      textureId: l.textureId,
      ratio: l.ratio,
      offsetX: 0,
      offsetY: 0,
    }));
  }

  update(dt: number): void {
    if (this.paused) return;

    const { axis, loop, viewWidth, viewHeight } = this.config;

    for (const layer of this.layers) {
      const delta = this.direction * this.speed * layer.ratio * dt;

      if (axis === 'horizontal' || axis === 'both') {
        layer.offsetX += delta;
        if (loop) {
          layer.offsetX = this.wrap(layer.offsetX, viewWidth);
        }
      }

      if (axis === 'vertical' || axis === 'both') {
        layer.offsetY += delta;
        if (loop) {
          layer.offsetY = this.wrap(layer.offsetY, viewHeight);
        }
      }
    }
  }

  getLayerStates(): readonly LayerState[] {
    return this.layers.map((l) => ({
      textureId: l.textureId,
      ratio: l.ratio,
      offsetX: l.offsetX,
      offsetY: l.offsetY,
    }));
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  setDirection(direction: 1 | -1): void {
    this.direction = direction;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  private wrap(offset: number, viewSize: number): number {
    // Modular wrap: keep offset within (-viewSize, viewSize]
    let wrapped = offset % viewSize;
    if (wrapped > viewSize) wrapped -= viewSize;
    if (wrapped < -viewSize) wrapped += viewSize;
    return wrapped;
  }
}
