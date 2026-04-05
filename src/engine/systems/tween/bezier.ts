export interface Point2D {
  readonly x: number;
  readonly y: number;
}

function lerp2D(a: readonly [number, number], b: readonly [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function deCasteljau(points: ReadonlyArray<readonly [number, number]>, t: number): [number, number] {
  if (points.length === 1) return [points[0][0], points[0][1]];

  const next: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    next.push(lerp2D(points[i], points[i + 1], t));
  }
  return deCasteljau(next, t);
}

export function sampleBezierPath(
  points: ReadonlyArray<readonly [number, number]>,
  t: number,
): Point2D {
  const clamped = Math.max(0, Math.min(1, t));

  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { x: points[0][0], y: points[0][1] };

  const [x, y] = deCasteljau(points, clamped);
  return { x, y };
}

export function bezierTangent(
  points: ReadonlyArray<readonly [number, number]>,
  t: number,
): Point2D {
  const clamped = Math.max(0, Math.min(1, t));

  if (points.length < 2) return { x: 1, y: 0 };

  // Derivative of Bezier: n * deCasteljau on derivative control points
  const n = points.length - 1;
  const derivPoints: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    derivPoints.push([
      n * (points[i + 1][0] - points[i][0]),
      n * (points[i + 1][1] - points[i][1]),
    ]);
  }

  if (derivPoints.length === 1) {
    return { x: derivPoints[0][0], y: derivPoints[0][1] };
  }

  const [dx, dy] = deCasteljau(derivPoints, clamped);
  return { x: dx, y: dy };
}
