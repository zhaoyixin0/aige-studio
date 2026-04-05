import { describe, it, expect } from 'vitest';
import { ease, EASING_NAMES, type EasingName } from '../easings';

describe('Easing Functions', () => {
  it('exports 16 easing names', () => {
    expect(EASING_NAMES.length).toBe(16);
  });

  it('every easing returns 0 at t=0', () => {
    for (const name of EASING_NAMES) {
      expect(ease(name, 0), `${name}(0)`).toBeCloseTo(0, 5);
    }
  });

  it('every easing returns 1 at t=1', () => {
    for (const name of EASING_NAMES) {
      expect(ease(name, 1), `${name}(1)`).toBeCloseTo(1, 5);
    }
  });

  it('Linear is identity', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      expect(ease('Linear', t)).toBeCloseTo(t, 5);
    }
  });

  it('In easings are monotonically non-decreasing', () => {
    const inEasings: EasingName[] = ['QuadIn', 'CubicIn', 'ExpoIn', 'SineIn'];
    for (const name of inEasings) {
      let prev = 0;
      for (let t = 0.01; t <= 1; t += 0.01) {
        const v = ease(name, t);
        expect(v, `${name}(${t}) >= prev`).toBeGreaterThanOrEqual(prev - 1e-10);
        prev = v;
      }
    }
  });

  it('Out easings are monotonically non-decreasing', () => {
    const outEasings: EasingName[] = ['QuadOut', 'CubicOut', 'ExpoOut', 'SineOut'];
    for (const name of outEasings) {
      let prev = 0;
      for (let t = 0.01; t <= 1; t += 0.01) {
        const v = ease(name, t);
        expect(v, `${name}(${t}) >= prev`).toBeGreaterThanOrEqual(prev - 1e-10);
        prev = v;
      }
    }
  });

  it('InOut easings pass through 0.5 near t=0.5', () => {
    const inOutEasings: EasingName[] = ['QuadInOut', 'CubicInOut', 'ExpoInOut', 'SineInOut', 'BounceInOut'];
    for (const name of inOutEasings) {
      const v = ease(name, 0.5);
      expect(v, `${name}(0.5)`).toBeCloseTo(0.5, 1);
    }
  });

  it('ease clamps t outside [0, 1]', () => {
    expect(ease('Linear', -0.5)).toBe(0);
    expect(ease('Linear', 1.5)).toBe(1);
  });

  it('BounceOut has characteristic bounce shape', () => {
    // BounceOut should be > 0.5 at t=0.5
    expect(ease('BounceOut', 0.5)).toBeGreaterThan(0.5);
    // and > 0.9 at t=0.9
    expect(ease('BounceOut', 0.9)).toBeGreaterThan(0.9);
  });

  it('unknown easing name falls back to Linear', () => {
    expect(ease('NonExistent' as EasingName, 0.5)).toBeCloseTo(0.5, 5);
  });
});
