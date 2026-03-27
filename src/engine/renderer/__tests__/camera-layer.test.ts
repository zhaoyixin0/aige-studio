import { describe, it, expect } from 'vitest';

/**
 * Tests for CameraLayer cover scaling logic.
 *
 * The CameraLayer must scale a video feed to fill a canvas (9:16 portrait)
 * while preserving aspect ratio ("cover" strategy), then mask overflow.
 *
 * We test the static computeCoverLayout() method which returns layout info
 * without requiring PixiJS.
 */

// Import the pure function we'll create
import { computeCoverLayout } from '../camera-layer';

describe('computeCoverLayout', () => {
  const CANVAS_W = 1080;
  const CANVAS_H = 1920;

  describe('4:3 video on 9:16 canvas (most common case)', () => {
    const videoW = 640;
    const videoH = 480;

    it('should scale to fill canvas height', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      // Video scaled height should equal canvas height
      expect(layout.scaledHeight).toBe(CANVAS_H);
    });

    it('should have scaled width greater than canvas width (overflow on sides)', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.scaledWidth).toBeGreaterThan(CANVAS_W);
    });

    it('should center the video horizontally (negative offsetX)', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.offsetX).toBeLessThan(0);
      // Offset should be symmetric: -(scaledWidth - canvasWidth) / 2
      const expectedOffset = -(layout.scaledWidth - CANVAS_W) / 2;
      expect(layout.offsetX).toBeCloseTo(expectedOffset);
    });

    it('should have zero vertical offset', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.offsetY).toBe(0);
    });

    it('should preserve aspect ratio', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      const originalAR = videoW / videoH;
      const scaledAR = layout.scaledWidth / layout.scaledHeight;
      expect(scaledAR).toBeCloseTo(originalAR, 5);
    });

    it('should report correct crop info for coordinate remapping', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      // For 4:3 on 9:16, sides are cropped
      // Visible fraction of video width = canvasAR / videoAR = 0.5625 / 1.3333 ≈ 0.4219
      const videoAR = videoW / videoH;
      const canvasAR = CANVAS_W / CANVAS_H;
      const visibleFraction = canvasAR / videoAR;
      const cropMargin = (1 - visibleFraction) / 2;

      expect(layout.crop.startX).toBeCloseTo(cropMargin, 4);
      expect(layout.crop.endX).toBeCloseTo(1 - cropMargin, 4);
      expect(layout.crop.startY).toBe(0);
      expect(layout.crop.endY).toBe(1);
    });
  });

  describe('16:9 video on 9:16 canvas', () => {
    const videoW = 1920;
    const videoH = 1080;

    it('should scale to fill canvas height (video is very wide)', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.scaledHeight).toBe(CANVAS_H);
    });

    it('should crop significant sides', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      // 16:9 = 1.778 vs 9:16 = 0.5625 → massive side crop
      expect(layout.scaledWidth).toBeGreaterThan(CANVAS_W * 2);
      expect(layout.offsetX).toBeLessThan(-CANVAS_W / 2);
    });

    it('should preserve 16:9 aspect ratio', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      const scaledAR = layout.scaledWidth / layout.scaledHeight;
      expect(scaledAR).toBeCloseTo(16 / 9, 4);
    });
  });

  describe('9:16 video on 9:16 canvas (perfect match)', () => {
    const videoW = 720;
    const videoH = 1280;

    it('should have no crop (exact aspect ratio match)', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.offsetX).toBeCloseTo(0, 1);
      expect(layout.offsetY).toBeCloseTo(0, 1);
      expect(layout.crop.startX).toBeCloseTo(0, 4);
      expect(layout.crop.endX).toBeCloseTo(1, 4);
      expect(layout.crop.startY).toBeCloseTo(0, 4);
      expect(layout.crop.endY).toBeCloseTo(1, 4);
    });

    it('should scale to fill canvas exactly', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.scaledWidth).toBeCloseTo(CANVAS_W, 1);
      expect(layout.scaledHeight).toBeCloseTo(CANVAS_H, 1);
    });
  });

  describe('1:1 video on 9:16 canvas', () => {
    const videoW = 640;
    const videoH = 640;
    // 1:1 AR (1.0) > 9:16 AR (0.5625) → video is wider, sides cropped

    it('should scale to fill canvas height', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.scaledHeight).toBe(CANVAS_H);
    });

    it('should crop sides (scaled width > canvas width)', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.scaledWidth).toBeGreaterThan(CANVAS_W);
      expect(layout.offsetX).toBeLessThan(0);
    });

    it('should have zero vertical offset', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.offsetY).toBe(0);
    });

    it('should report correct crop info (sides cropped)', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.crop.startX).toBeGreaterThan(0);
      expect(layout.crop.endX).toBeLessThan(1);
      expect(layout.crop.startY).toBe(0);
      expect(layout.crop.endY).toBe(1);
    });
  });

  describe('vertical video (3:4) on 9:16 canvas — top/bottom cropped', () => {
    // 3:4 AR = 0.75, which is > 9:16 (0.5625), so still sides cropped
    // Need AR < 0.5625 for top/bottom crop. Use 1:2 = 0.5
    const videoW = 360;
    const videoH = 720;

    it('should scale to fill canvas width (video is narrower)', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      // 1:2 AR (0.5) < 9:16 AR (0.5625) → fit width, crop top/bottom
      expect(layout.scaledWidth).toBe(CANVAS_W);
    });

    it('should crop top and bottom', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.scaledHeight).toBeGreaterThan(CANVAS_H);
      expect(layout.offsetY).toBeLessThan(0);
    });

    it('should have zero horizontal offset', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.offsetX).toBe(0);
    });

    it('should report correct crop info (top/bottom cropped)', () => {
      const layout = computeCoverLayout(videoW, videoH, CANVAS_W, CANVAS_H);
      expect(layout.crop.startX).toBe(0);
      expect(layout.crop.endX).toBe(1);
      expect(layout.crop.startY).toBeGreaterThan(0);
      expect(layout.crop.endY).toBeLessThan(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very small video (160x120)', () => {
      const layout = computeCoverLayout(160, 120, CANVAS_W, CANVAS_H);
      expect(layout.scaledHeight).toBe(CANVAS_H);
      expect(layout.scaledWidth).toBeGreaterThan(CANVAS_W);
    });

    it('should handle equal dimensions to canvas', () => {
      const layout = computeCoverLayout(CANVAS_W, CANVAS_H, CANVAS_W, CANVAS_H);
      expect(layout.scaledWidth).toBe(CANVAS_W);
      expect(layout.scaledHeight).toBe(CANVAS_H);
      expect(layout.offsetX).toBe(0);
      expect(layout.offsetY).toBe(0);
    });
  });
});
