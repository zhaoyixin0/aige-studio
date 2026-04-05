import { describe, it, expect } from 'vitest';
import { sampleBezierPath, bezierTangent } from '../bezier';

describe('Bezier Path Sampling', () => {
  const straightLine: [number, number][] = [[0, 0], [100, 0]];
  const curve: [number, number][] = [[0, 0], [50, -100], [100, 0]];
  const cubic: [number, number][] = [[0, 0], [25, -50], [75, -50], [100, 0]];

  it('returns start point at t=0', () => {
    const p = sampleBezierPath(straightLine, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('returns end point at t=1', () => {
    const p = sampleBezierPath(straightLine, 1);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(0);
  });

  it('midpoint of straight line is at center', () => {
    const p = sampleBezierPath(straightLine, 0.5);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(0);
  });

  it('quadratic curve midpoint is pulled toward control point', () => {
    const p = sampleBezierPath(curve, 0.5);
    expect(p.x).toBeCloseTo(50, 0);
    expect(p.y).toBeLessThan(0); // pulled upward (negative y)
  });

  it('cubic curve is symmetric with symmetric control points', () => {
    const p1 = sampleBezierPath(cubic, 0.25);
    const p2 = sampleBezierPath(cubic, 0.75);
    expect(p1.y).toBeCloseTo(p2.y, 0);
  });

  it('clamps t below 0', () => {
    const p = sampleBezierPath(straightLine, -0.5);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('clamps t above 1', () => {
    const p = sampleBezierPath(straightLine, 1.5);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(0);
  });

  it('handles single-point path', () => {
    const p = sampleBezierPath([[42, 17]], 0.5);
    expect(p.x).toBeCloseTo(42);
    expect(p.y).toBeCloseTo(17);
  });

  it('tangent at start of straight line points right', () => {
    const t = bezierTangent(straightLine, 0);
    expect(t.x).toBeGreaterThan(0);
    expect(t.y).toBeCloseTo(0, 1);
  });

  it('tangent at midpoint of curve points roughly right', () => {
    const t = bezierTangent(curve, 0.5);
    expect(t.x).toBeGreaterThan(0);
  });
});
