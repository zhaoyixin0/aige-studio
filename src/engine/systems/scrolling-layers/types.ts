export type ScrollAxis = 'horizontal' | 'vertical' | 'both';

export interface ParallaxLayerConfig {
  readonly textureId: string;
  readonly ratio: number;
  readonly spacing?: number;
}

export interface ScrollingLayersConfig {
  readonly axis: ScrollAxis;
  readonly baseSpeed: number;
  readonly direction: 1 | -1;
  readonly loop: boolean;
  readonly viewWidth: number;
  readonly viewHeight: number;
  readonly layers: readonly ParallaxLayerConfig[];
}

export interface LayerState {
  readonly textureId: string;
  readonly ratio: number;
  readonly offsetX: number;
  readonly offsetY: number;
}
