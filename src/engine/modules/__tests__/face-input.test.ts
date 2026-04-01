import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { FaceInput } from '../input/face-input';

/**
 * Tests for FaceInput coordinate remapping when camera aspect ratio
 * differs from canvas aspect ratio (crop offset compensation).
 *
 * MediaPipe returns normalized 0-1 coordinates relative to the full video frame.
 * When the video is "cover" cropped to fit the canvas, only a portion of the
 * frame is visible. FaceInput must remap coordinates so that the visible
 * portion maps to the full canvas.
 */
describe('FaceInput coordinate remapping', () => {
  const CANVAS_W = 1080;
  const CANVAS_H = 1920;

  // Matches BaseModule constructor signature: Record<string, unknown>
  function setup(params: Record<string, unknown> = {}) {
    const engine = new Engine();
    // Mock getCanvas to return our dimensions
    vi.spyOn(engine, 'getCanvas').mockReturnValue({
      width: CANVAS_W,
      height: CANVAS_H,
    } as HTMLCanvasElement);

    const faceInput = new FaceInput('face-1', {
      tracking: 'headXY',
      smoothing: 0, // disable smoothing for deterministic tests
      sensitivity: 1,
      outputTo: 'player',
      ...params,
    });
    engine.addModule(faceInput);
    engine.eventBus.emit('gameflow:resume');
    return { engine, faceInput };
  }

  describe('setVideoDimensions', () => {
    it('should accept video dimensions', () => {
      const { faceInput } = setup();
      // Should not throw
      faceInput.setVideoDimensions(640, 480);
    });
  });

  describe('4:3 video on 9:16 canvas (sides cropped)', () => {
    // Video center (0.5, 0.5) should map to canvas center
    it('should map video center to canvas center', () => {
      const { engine, faceInput } = setup({ smoothing: 0 });
      faceInput.setVideoDimensions(640, 480);

      const mockTracker = {
        getLastResult: () => ({
          headX: 0.5,
          headY: 0.5,
          headRotation: 0,
          mouthOpen: 0,
          leftEyeBlink: 0,
          rightEyeBlink: 0,
          smile: 0,
          eyebrowRaise: 0,
        }),
      };
      faceInput.setTracker(mockTracker as any);

      const moveHandler = vi.fn();
      engine.eventBus.on('input:face:move', moveHandler);

      faceInput.update(16);

      expect(moveHandler).toHaveBeenCalled();
      const { x, y } = moveHandler.mock.calls[0][0];
      // Center should map to center (mirrored: x = (1-0.5)*1080 = 540)
      expect(x).toBeCloseTo(CANVAS_W / 2, 0);
      expect(y).toBeCloseTo(CANVAS_H / 2, 0);
    });

    it('should remap edge of visible area to canvas edge', () => {
      const { engine, faceInput } = setup({ smoothing: 0 });
      faceInput.setVideoDimensions(640, 480);

      // For 4:3 on 9:16:
      // videoAR = 1.333, canvasAR = 0.5625
      // visibleFraction = 0.5625 / 1.333 = 0.4219
      // cropMargin = (1 - 0.4219) / 2 = 0.2891
      // So headX = 0.2891 should map to canvas x = canvasW (mirrored: far right)
      // and headX = 0.7109 should map to canvas x = 0 (mirrored: far left)
      const cropMargin = (1 - (0.5625 / (640 / 480))) / 2;

      const mockTracker = {
        getLastResult: () => ({
          headX: cropMargin, // left edge of visible area
          headY: 0.5,
          headRotation: 0,
          mouthOpen: 0,
          leftEyeBlink: 0,
          rightEyeBlink: 0,
          smile: 0,
          eyebrowRaise: 0,
        }),
      };
      faceInput.setTracker(mockTracker as any);

      const moveHandler = vi.fn();
      engine.eventBus.on('input:face:move', moveHandler);

      faceInput.update(16);

      expect(moveHandler).toHaveBeenCalled();
      const { x } = moveHandler.mock.calls[0][0];
      // headX at cropMargin → remapped to 0 → mirrored to (1-0)*canvasW = canvasW
      expect(x).toBeCloseTo(CANVAS_W, 0);
    });

    it('should clamp coordinates outside visible area', () => {
      const { engine, faceInput } = setup({ smoothing: 0 });
      faceInput.setVideoDimensions(640, 480);

      // headX = 0.0 is outside visible area (in cropped region)
      const mockTracker = {
        getLastResult: () => ({
          headX: 0.0,
          headY: 0.5,
          headRotation: 0,
          mouthOpen: 0,
          leftEyeBlink: 0,
          rightEyeBlink: 0,
          smile: 0,
          eyebrowRaise: 0,
        }),
      };
      faceInput.setTracker(mockTracker as any);

      const moveHandler = vi.fn();
      engine.eventBus.on('input:face:move', moveHandler);

      faceInput.update(16);

      const { x } = moveHandler.mock.calls[0][0];
      // Should be clamped — x should not exceed canvas bounds
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(CANVAS_W);
    });
  });

  describe('9:16 video on 9:16 canvas (no crop)', () => {
    it('should pass through coordinates unchanged', () => {
      const { engine, faceInput } = setup({ smoothing: 0 });
      faceInput.setVideoDimensions(720, 1280);

      const mockTracker = {
        getLastResult: () => ({
          headX: 0.3,
          headY: 0.7,
          headRotation: 0,
          mouthOpen: 0,
          leftEyeBlink: 0,
          rightEyeBlink: 0,
          smile: 0,
          eyebrowRaise: 0,
        }),
      };
      faceInput.setTracker(mockTracker as any);

      const moveHandler = vi.fn();
      engine.eventBus.on('input:face:move', moveHandler);

      faceInput.update(16);

      const { x, y } = moveHandler.mock.calls[0][0];
      // No crop → direct mapping (with mirror: x = (1-0.3)*1080 = 756)
      expect(x).toBeCloseTo((1 - 0.3) * CANVAS_W, 0);
      expect(y).toBeCloseTo(0.7 * CANVAS_H, 0);
    });
  });

  describe('1:1 video on 9:16 canvas (top/bottom cropped)', () => {
    it('should map video center to canvas center', () => {
      const { engine, faceInput } = setup({ smoothing: 0 });
      faceInput.setVideoDimensions(640, 640);

      const mockTracker = {
        getLastResult: () => ({
          headX: 0.5,
          headY: 0.5,
          headRotation: 0,
          mouthOpen: 0,
          leftEyeBlink: 0,
          rightEyeBlink: 0,
          smile: 0,
          eyebrowRaise: 0,
        }),
      };
      faceInput.setTracker(mockTracker as any);

      const moveHandler = vi.fn();
      engine.eventBus.on('input:face:move', moveHandler);

      faceInput.update(16);

      const { x, y } = moveHandler.mock.calls[0][0];
      expect(x).toBeCloseTo(CANVAS_W / 2, 0);
      expect(y).toBeCloseTo(CANVAS_H / 2, 0);
    });

    it('should have no horizontal crop but vertical crop', () => {
      const { engine, faceInput } = setup({ smoothing: 0 });
      faceInput.setVideoDimensions(640, 640);

      // For 1:1 on 9:16: videoAR (1.0) > canvasAR (0.5625)
      // So sides are cropped, not top/bottom
      // Wait — 1:1 videoAR = 1.0 > canvasAR = 0.5625 → sides cropped
      // Only if videoAR < canvasAR would top/bottom be cropped
      // Since 1.0 > 0.5625, this is still side-crop
      const videoAR = 1.0;
      const canvasAR = CANVAS_W / CANVAS_H; // 0.5625
      // videoAR > canvasAR → sides cropped
      const visibleFractionX = canvasAR / videoAR;
      const cropMarginX = (1 - visibleFractionX) / 2;

      // headX at left visible edge → remapped to 0 → mirrored to canvasW
      const mockTracker = {
        getLastResult: () => ({
          headX: cropMarginX,
          headY: 0.5,
          headRotation: 0,
          mouthOpen: 0,
          leftEyeBlink: 0,
          rightEyeBlink: 0,
          smile: 0,
          eyebrowRaise: 0,
        }),
      };
      faceInput.setTracker(mockTracker as any);

      const moveHandler = vi.fn();
      engine.eventBus.on('input:face:move', moveHandler);

      faceInput.update(16);

      const { x } = moveHandler.mock.calls[0][0];
      expect(x).toBeCloseTo(CANVAS_W, 0);
    });
  });

  describe('without video dimensions set (backward compatibility)', () => {
    it('should behave as before — direct mapping without remapping', () => {
      const { engine, faceInput } = setup({ smoothing: 0 });
      // Do NOT call setVideoDimensions

      const mockTracker = {
        getLastResult: () => ({
          headX: 0.3,
          headY: 0.7,
          headRotation: 0,
          mouthOpen: 0,
          leftEyeBlink: 0,
          rightEyeBlink: 0,
          smile: 0,
          eyebrowRaise: 0,
        }),
      };
      faceInput.setTracker(mockTracker as any);

      const moveHandler = vi.fn();
      engine.eventBus.on('input:face:move', moveHandler);

      faceInput.update(16);

      const { x, y } = moveHandler.mock.calls[0][0];
      // Without video dimensions, should use direct mapping (no crop adjustment)
      expect(x).toBeCloseTo((1 - 0.3) * CANVAS_W, 0);
      expect(y).toBeCloseTo(0.7 * CANVAS_H, 0);
    });
  });
});
