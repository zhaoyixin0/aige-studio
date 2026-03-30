import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for ShooterRenderer.
 *
 * We test the pure logic functions that the renderer uses:
 * - computeProjectileRotation: angle from direction vector
 * - computeHealthBarWidth: proportional bar width
 * - computeAimIndicatorPos: crosshair position from direction + player pos
 * - computeShieldAlpha: opacity from charges
 *
 * PixiJS rendering is not tested (requires WebGL context).
 * We test the sync logic by verifying correct sprite map operations.
 */

import {
  computeProjectileRotation,
  computeHealthBarWidth,
  computeAimIndicatorPos,
  computeShieldAlpha,
  resolvePlayerPosition,
} from '../shooter-renderer';

// ── Pure function tests ────────────────────────────────────────

describe('computeProjectileRotation', () => {
  it('should return 0 for rightward direction (1, 0)', () => {
    expect(computeProjectileRotation(1, 0)).toBeCloseTo(0);
  });

  it('should return PI/2 for downward direction (0, 1)', () => {
    expect(computeProjectileRotation(0, 1)).toBeCloseTo(Math.PI / 2);
  });

  it('should return -PI/2 for upward direction (0, -1)', () => {
    expect(computeProjectileRotation(0, -1)).toBeCloseTo(-Math.PI / 2);
  });

  it('should return PI for leftward direction (-1, 0)', () => {
    const rot = computeProjectileRotation(-1, 0);
    // atan2(0, -1) = PI
    expect(Math.abs(rot)).toBeCloseTo(Math.PI);
  });

  it('should return PI/4 for diagonal (1, 1) normalized', () => {
    const s = Math.SQRT1_2;
    expect(computeProjectileRotation(s, s)).toBeCloseTo(Math.PI / 4);
  });
});

describe('computeHealthBarWidth', () => {
  const MAX_BAR_WIDTH = 40;

  it('should return full width at full health', () => {
    expect(computeHealthBarWidth(100, 100, MAX_BAR_WIDTH)).toBe(MAX_BAR_WIDTH);
  });

  it('should return half width at half health', () => {
    expect(computeHealthBarWidth(50, 100, MAX_BAR_WIDTH)).toBe(20);
  });

  it('should return 0 at zero health', () => {
    expect(computeHealthBarWidth(0, 100, MAX_BAR_WIDTH)).toBe(0);
  });

  it('should clamp to 0 for negative hp', () => {
    expect(computeHealthBarWidth(-10, 100, MAX_BAR_WIDTH)).toBe(0);
  });

  it('should clamp to max for over-heal', () => {
    expect(computeHealthBarWidth(150, 100, MAX_BAR_WIDTH)).toBe(MAX_BAR_WIDTH);
  });

  it('should handle 0 maxHp without dividing by zero', () => {
    expect(computeHealthBarWidth(0, 0, MAX_BAR_WIDTH)).toBe(0);
  });
});

describe('computeAimIndicatorPos', () => {
  const OFFSET = 80;

  it('should place crosshair above player for upward aim', () => {
    const pos = computeAimIndicatorPos(540, 960, 0, -1, OFFSET);
    expect(pos.x).toBeCloseTo(540);
    expect(pos.y).toBeCloseTo(960 - OFFSET);
  });

  it('should place crosshair to the right for rightward aim', () => {
    const pos = computeAimIndicatorPos(540, 960, 1, 0, OFFSET);
    expect(pos.x).toBeCloseTo(540 + OFFSET);
    expect(pos.y).toBeCloseTo(960);
  });

  it('should handle diagonal aim', () => {
    const s = Math.SQRT1_2;
    const pos = computeAimIndicatorPos(100, 100, s, s, OFFSET);
    expect(pos.x).toBeCloseTo(100 + s * OFFSET);
    expect(pos.y).toBeCloseTo(100 + s * OFFSET);
  });

  it('should handle zero direction (default upward)', () => {
    const pos = computeAimIndicatorPos(540, 960, 0, 0, OFFSET);
    // Zero direction => no offset
    expect(pos.x).toBeCloseTo(540);
    expect(pos.y).toBeCloseTo(960);
  });
});

describe('computeShieldAlpha', () => {
  it('should return 1.0 at full charges', () => {
    expect(computeShieldAlpha(3, 3)).toBeCloseTo(1.0);
  });

  it('should return proportional alpha for partial charges', () => {
    expect(computeShieldAlpha(1, 3)).toBeCloseTo(1 / 3);
  });

  it('should return 0 at zero charges', () => {
    expect(computeShieldAlpha(0, 3)).toBeCloseTo(0);
  });

  it('should handle 0 maxCharges without dividing by zero', () => {
    expect(computeShieldAlpha(0, 0)).toBe(0);
  });

  it('should clamp to 1.0 if charges exceed max', () => {
    expect(computeShieldAlpha(5, 3)).toBeCloseTo(1.0);
  });
});

// ── Sprite map diffing tests ────────────────────────────────────

describe('diffSpriteIds', () => {
  // Import after defining — this tests the sync helper
  let diffSpriteIds: (
    currentIds: ReadonlySet<string>,
    activeIds: ReadonlySet<string>,
  ) => { toAdd: string[]; toRemove: string[] };

  beforeEach(async () => {
    const mod = await import('../shooter-renderer');
    diffSpriteIds = mod.diffSpriteIds;
  });

  it('should add new IDs not in current set', () => {
    const current = new Set(['a', 'b']);
    const active = new Set(['a', 'b', 'c']);
    const diff = diffSpriteIds(current, active);
    expect(diff.toAdd).toEqual(['c']);
    expect(diff.toRemove).toEqual([]);
  });

  it('should remove IDs no longer active', () => {
    const current = new Set(['a', 'b', 'c']);
    const active = new Set(['a']);
    const diff = diffSpriteIds(current, active);
    expect(diff.toAdd).toEqual([]);
    expect(diff.toRemove).toEqual(['b', 'c']);
  });

  it('should handle empty current set', () => {
    const current = new Set<string>();
    const active = new Set(['x', 'y']);
    const diff = diffSpriteIds(current, active);
    expect(diff.toAdd).toEqual(['x', 'y']);
    expect(diff.toRemove).toEqual([]);
  });

  it('should handle empty active set (remove all)', () => {
    const current = new Set(['a', 'b']);
    const active = new Set<string>();
    const diff = diffSpriteIds(current, active);
    expect(diff.toAdd).toEqual([]);
    expect(diff.toRemove).toEqual(['a', 'b']);
  });

  it('should handle identical sets (no changes)', () => {
    const current = new Set(['a', 'b']);
    const active = new Set(['a', 'b']);
    const diff = diffSpriteIds(current, active);
    expect(diff.toAdd).toEqual([]);
    expect(diff.toRemove).toEqual([]);
  });
});

// ── Health bar color tests ─────────────────────────────────────

describe('getHealthBarColor', () => {
  let getHealthBarColor: (ratio: number) => number;

  beforeEach(async () => {
    const mod = await import('../shooter-renderer');
    getHealthBarColor = mod.getHealthBarColor;
  });

  it('should return green for full health', () => {
    expect(getHealthBarColor(1.0)).toBe(0x44CC44);
  });

  it('should return yellow for half health', () => {
    expect(getHealthBarColor(0.5)).toBe(0xCCCC44);
  });

  it('should return red for critical health', () => {
    expect(getHealthBarColor(0.2)).toBe(0xCC4444);
  });

  it('should return red for zero health', () => {
    expect(getHealthBarColor(0)).toBe(0xCC4444);
  });
});

// ── Player position resolution tests ──────────────────────────

describe('resolvePlayerPosition', () => {
  const DEFAULT_POS = { x: 540, y: 1600 };

  it('should return faceInput position when available', () => {
    const face = { getPosition: () => ({ x: 100, y: 200 }) };
    expect(resolvePlayerPosition(face, undefined, undefined)).toEqual({ x: 100, y: 200 });
  });

  it('should fall back to handInput when faceInput is absent', () => {
    const hand = { getPosition: () => ({ x: 300, y: 400 }) };
    expect(resolvePlayerPosition(undefined, hand, undefined)).toEqual({ x: 300, y: 400 });
  });

  it('should fall back to touchInput when face and hand are absent', () => {
    const touch = { getPosition: () => ({ x: 500, y: 600 }) };
    expect(resolvePlayerPosition(undefined, undefined, touch)).toEqual({ x: 500, y: 600 });
  });

  it('should prefer faceInput over handInput and touchInput', () => {
    const face = { getPosition: () => ({ x: 1, y: 2 }) };
    const hand = { getPosition: () => ({ x: 3, y: 4 }) };
    const touch = { getPosition: () => ({ x: 5, y: 6 }) };
    expect(resolvePlayerPosition(face, hand, touch)).toEqual({ x: 1, y: 2 });
  });

  it('should return default position when all inputs are undefined', () => {
    expect(resolvePlayerPosition(undefined, undefined, undefined)).toEqual(DEFAULT_POS);
  });

  it('should fall back to default when present input returns null', () => {
    const handReturnsNull = { getPosition: () => null };
    expect(resolvePlayerPosition(undefined, handReturnsNull, undefined)).toEqual(DEFAULT_POS);
  });

  it('should return default when higher-priority input returns null', () => {
    const faceReturnsNull = { getPosition: () => null };
    const touch = { getPosition: () => ({ x: 700, y: 800 }) };
    // faceInput is non-nullish so it wins priority, but getPosition() returns null → default
    expect(resolvePlayerPosition(faceReturnsNull, undefined, touch)).toEqual(DEFAULT_POS);
  });
});
