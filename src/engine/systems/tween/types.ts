import type { EasingName } from './easings';

export type TweenProperty = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'alpha';

export interface BezierPath {
  readonly points: ReadonlyArray<readonly [number, number]>;
  readonly closed?: boolean;
  readonly orientToTangent?: boolean;
}

export interface TweenTrack {
  readonly property: TweenProperty;
  readonly easing: EasingName;
  readonly from: number;
  readonly to: number;
  readonly bezierPath?: BezierPath;
}

export interface TweenClip {
  readonly id: string;
  readonly duration: number;
  readonly loop?: number | 'infinite';
  readonly pingPong?: boolean;
  readonly delay?: number;
  readonly timeScale?: number;
  readonly tracks: readonly TweenTrack[];
  readonly onComplete?: { readonly eventName?: string };
  readonly startOnCollision?: { readonly withTag?: string };
}

export type TweenState = 'delayed' | 'playing' | 'completed';

/** Read-only snapshot of a running tween — for external consumers */
export interface TweenSnapshot {
  readonly clipId: string;
  readonly entityId: string;
  readonly elapsed: number;
  readonly state: TweenState;
}
