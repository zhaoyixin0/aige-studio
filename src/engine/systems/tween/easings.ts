export type EasingName =
  | 'Linear'
  | 'QuadIn' | 'QuadOut' | 'QuadInOut'
  | 'CubicIn' | 'CubicOut' | 'CubicInOut'
  | 'ExpoIn' | 'ExpoOut' | 'ExpoInOut'
  | 'SineIn' | 'SineOut' | 'SineInOut'
  | 'BounceIn' | 'BounceOut' | 'BounceInOut';

export const EASING_NAMES: readonly EasingName[] = [
  'Linear',
  'QuadIn', 'QuadOut', 'QuadInOut',
  'CubicIn', 'CubicOut', 'CubicInOut',
  'ExpoIn', 'ExpoOut', 'ExpoInOut',
  'SineIn', 'SineOut', 'SineInOut',
  'BounceIn', 'BounceOut', 'BounceInOut',
] as const;

const PI_HALF = Math.PI / 2;

function bounceOut(t: number): number {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  } else if (t < 2 / 2.75) {
    const u = t - 1.5 / 2.75;
    return 7.5625 * u * u + 0.75;
  } else if (t < 2.5 / 2.75) {
    const u = t - 2.25 / 2.75;
    return 7.5625 * u * u + 0.9375;
  } else {
    const u = t - 2.625 / 2.75;
    return 7.5625 * u * u + 0.984375;
  }
}

const EASING_FNS: Record<EasingName, (t: number) => number> = {
  Linear: (t) => t,

  QuadIn: (t) => t * t,
  QuadOut: (t) => t * (2 - t),
  QuadInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  CubicIn: (t) => t * t * t,
  CubicOut: (t) => { const u = t - 1; return u * u * u + 1; },
  CubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),

  ExpoIn: (t) => (t === 0 ? 0 : 2 ** (10 * (t - 1))),
  ExpoOut: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  ExpoInOut: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5
      ? 0.5 * 2 ** (20 * t - 10)
      : 1 - 0.5 * 2 ** (-20 * t + 10);
  },

  SineIn: (t) => 1 - Math.cos(t * PI_HALF),
  SineOut: (t) => Math.sin(t * PI_HALF),
  SineInOut: (t) => 0.5 * (1 - Math.cos(Math.PI * t)),

  BounceOut: bounceOut,
  BounceIn: (t) => 1 - bounceOut(1 - t),
  BounceInOut: (t) =>
    t < 0.5
      ? 0.5 * (1 - bounceOut(1 - 2 * t))
      : 0.5 * bounceOut(2 * t - 1) + 0.5,
};

export function ease(name: EasingName, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const fn = EASING_FNS[name];
  if (!fn) return clamped; // fallback to Linear
  return fn(clamped);
}
