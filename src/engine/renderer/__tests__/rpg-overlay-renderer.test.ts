import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Tests for RPGOverlayRenderer.
 *
 * We test the pure logic functions:
 * - computeDialogueBoxLayout: box dimensions relative to canvas
 * - computeXpBarWidth: proportional XP fill
 * - computeEffectDurationRatio: remaining duration proportion
 * - getEffectColor: color by effect type (buff/debuff)
 * - formatDropLabel: "x3" label for drop counts
 */

import {
  computeDialogueBoxLayout,
  computeXpBarWidth,
  computeEffectDurationRatio,
  getEffectColor,
  formatDropLabel,
} from '../rpg-overlay-renderer';

// ── Dialogue box layout ─────────────────────────────────────────

describe('computeDialogueBoxLayout', () => {
  const CANVAS_W = 1080;
  const CANVAS_H = 1920;

  it('should place box at bottom 25% of canvas', () => {
    const layout = computeDialogueBoxLayout(CANVAS_W, CANVAS_H);
    expect(layout.y).toBe(CANVAS_H * 0.75);
    expect(layout.height).toBe(CANVAS_H * 0.25);
  });

  it('should span full canvas width with padding', () => {
    const layout = computeDialogueBoxLayout(CANVAS_W, CANVAS_H);
    expect(layout.x).toBe(0);
    expect(layout.width).toBe(CANVAS_W);
  });

  it('should have text area with internal padding', () => {
    const layout = computeDialogueBoxLayout(CANVAS_W, CANVAS_H);
    expect(layout.textX).toBeGreaterThan(layout.x);
    expect(layout.textY).toBeGreaterThan(layout.y);
    expect(layout.textWidth).toBeLessThan(layout.width);
  });

  it('should work with smaller canvas', () => {
    const layout = computeDialogueBoxLayout(540, 960);
    expect(layout.y).toBe(960 * 0.75);
    expect(layout.height).toBe(960 * 0.25);
    expect(layout.width).toBe(540);
  });
});

// ── XP bar width ────────────────────────────────────────────────

describe('computeXpBarWidth', () => {
  const MAX_WIDTH = 200;

  it('should return 0 for no XP progress', () => {
    expect(computeXpBarWidth(0, 100, MAX_WIDTH)).toBe(0);
  });

  it('should return half width at 50% progress', () => {
    expect(computeXpBarWidth(50, 100, MAX_WIDTH)).toBe(100);
  });

  it('should return full width when XP equals requirement', () => {
    expect(computeXpBarWidth(100, 100, MAX_WIDTH)).toBe(MAX_WIDTH);
  });

  it('should clamp to max width for overflow', () => {
    expect(computeXpBarWidth(200, 100, MAX_WIDTH)).toBe(MAX_WIDTH);
  });

  it('should handle zero xpToNext without dividing by zero', () => {
    expect(computeXpBarWidth(0, 0, MAX_WIDTH)).toBe(0);
  });
});

// ── Effect duration ratio ───────────────────────────────────────

describe('computeEffectDurationRatio', () => {
  it('should return 1.0 at start of effect', () => {
    expect(computeEffectDurationRatio(5000, 5000)).toBeCloseTo(1.0);
  });

  it('should return 0.5 at halfway', () => {
    expect(computeEffectDurationRatio(2500, 5000)).toBeCloseTo(0.5);
  });

  it('should return 0 when expired', () => {
    expect(computeEffectDurationRatio(0, 5000)).toBeCloseTo(0);
  });

  it('should handle zero maxDuration', () => {
    expect(computeEffectDurationRatio(0, 0)).toBe(0);
  });

  it('should clamp to 1.0 for negative remaining', () => {
    // duration should not exceed maxDuration but clamp just in case
    expect(computeEffectDurationRatio(6000, 5000)).toBeCloseTo(1.0);
  });
});

// ── Effect color ────────────────────────────────────────────────

describe('getEffectColor', () => {
  it('should return green for buff', () => {
    expect(getEffectColor('buff')).toBe(0x44CC44);
  });

  it('should return red for debuff', () => {
    expect(getEffectColor('debuff')).toBe(0xCC4444);
  });
});

// ── Drop label ──────────────────────────────────────────────────

describe('formatDropLabel', () => {
  it('should return empty string for count 1', () => {
    expect(formatDropLabel(1)).toBe('');
  });

  it('should return "x2" for count 2', () => {
    expect(formatDropLabel(2)).toBe('x2');
  });

  it('should return "x10" for count 10', () => {
    expect(formatDropLabel(10)).toBe('x10');
  });

  it('should return empty for count 0', () => {
    expect(formatDropLabel(0)).toBe('');
  });
});
