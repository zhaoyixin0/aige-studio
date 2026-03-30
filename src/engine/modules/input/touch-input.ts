import type { ModuleSchema, GameEngine } from '@/engine/core';
import { BaseModule } from '@/engine/modules/base-module';

interface PointerState {
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
}

export class TouchInput extends BaseModule {
  readonly type = 'TouchInput';

  private canvas: HTMLElement | null = null;
  private pointerState: PointerState | null = null;
  private lastTapTime = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private currentPosition: { x: number; y: number } | null = null;

  // Bound handlers for cleanup
  private handlePointerDown: ((e: PointerEvent) => void) | null = null;
  private handlePointerMove: ((e: PointerEvent) => void) | null = null;
  private handlePointerUp: ((e: PointerEvent) => void) | null = null;

  getSchema(): ModuleSchema {
    return {
      gesture: {
        type: 'select',
        label: 'Gesture',
        default: 'tap',
        options: ['tap', 'swipe', 'longPress', 'doubleTap'],
      },
      action: {
        type: 'string',
        label: 'Action',
        default: '',
      },
      area: {
        type: 'rect',
        label: 'Active Area',
      },
      playerSize: {
        type: 'range',
        label: '角色大小',
        default: 64,
        min: 24,
        max: 128,
        step: 4,
        unit: 'px',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    // Default position: center-bottom so player is visible before first touch
    const canvas = engine.getCanvas();
    this.currentPosition = { x: canvas.width / 2, y: canvas.height * 0.85 };
  }

  setCanvas(canvas: HTMLElement): void {
    // Clean up previous bindings
    this.unbindEvents();

    this.canvas = canvas;
    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.canvas) return;

    this.handlePointerDown = (e: PointerEvent) => this.onPointerDown(e);
    this.handlePointerMove = (e: PointerEvent) => this.onPointerMove(e);
    this.handlePointerUp = (e: PointerEvent) => this.onPointerUp(e);

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    // Enable move tracking even without pointer down
    this.canvas.style.touchAction = 'none';
  }

  private unbindEvents(): void {
    if (!this.canvas) return;

    if (this.handlePointerDown)
      this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    if (this.handlePointerMove)
      this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    if (this.handlePointerUp)
      this.canvas.removeEventListener('pointerup', this.handlePointerUp);
  }

  /**
   * Convert pointer event to canvas-space coordinates.
   * Unlike FaceInput/HandInput, touch coordinates are NOT mirrored (no `1 - x`).
   * This is intentional: camera-based inputs mirror X to compensate for the camera's
   * natural mirror effect, so moving right physically maps to moving right on screen.
   * Touch is a direct interaction — the user taps where they mean — so no mirroring is needed.
   */
  private getRelativePos(e: PointerEvent): { x: number; y: number } {
    if (!this.canvas) return { x: e.clientX, y: e.clientY };
    const rect = this.canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    // Scale CSS coordinates to canvas internal resolution
    const canvas = this.canvas as HTMLCanvasElement;
    const scaleX = (canvas.width || rect.width) / rect.width;
    const scaleY = (canvas.height || rect.height) / rect.height;
    return {
      x: cssX * scaleX,
      y: cssY * scaleY,
    };
  }

  private onPointerDown(e: PointerEvent): void {
    const pos = this.getRelativePos(e);
    this.pointerState = {
      startX: pos.x,
      startY: pos.y,
      startTime: performance.now(),
      moved: false,
    };

    // Emit directional hold event based on touch position (left/right half of screen)
    const canvasWidth = (this.canvas as HTMLCanvasElement)?.width ?? 800;
    const side = pos.x < canvasWidth / 2 ? 'left' : 'right';
    this.emit('input:touch:hold', { x: pos.x, y: pos.y, side });

    // Start long press timer
    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      if (this.pointerState && !this.pointerState.moved) {
        this.emit('input:touch:longPress', { x: pos.x, y: pos.y });
      }
    }, 500);
  }

  private onPointerMove(e: PointerEvent): void {
    const pos = this.getRelativePos(e);
    this.currentPosition = pos;

    if (!this.pointerState) return;
    const dx = pos.x - this.pointerState.startX;
    const dy = pos.y - this.pointerState.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 10) {
      this.pointerState.moved = true;
      this.clearLongPressTimer();
    }
  }

  getPosition(): { x: number; y: number } | null {
    return this.currentPosition;
  }

  private onPointerUp(e: PointerEvent): void {
    this.clearLongPressTimer();
    this.emit('input:touch:release', {});

    if (!this.pointerState) return;
    const pos = this.getRelativePos(e);
    const dx = pos.x - this.pointerState.startX;
    const dy = pos.y - this.pointerState.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const elapsed = performance.now() - this.pointerState.startTime;

    if (this.pointerState.moved && distance > 30) {
      // Swipe
      const direction = this.getSwipeDirection(dx, dy);
      this.emit('input:touch:swipe', {
        x: pos.x,
        y: pos.y,
        direction,
        distance,
      });
    } else if (elapsed < 300) {
      // Tap or double tap
      const now = performance.now();
      if (now - this.lastTapTime < 300) {
        this.emit('input:touch:doubleTap', { x: pos.x, y: pos.y });
        this.lastTapTime = 0; // Reset to prevent triple-tap
      } else {
        this.emit('input:touch:tap', { x: pos.x, y: pos.y });
        this.lastTapTime = now;
      }
    }

    this.pointerState = null;
  }

  private getSwipeDirection(dx: number, dy: number): string {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  reset(): void {
    this.clearLongPressTimer();
    this.pointerState = null;
    this.lastTapTime = 0;
    // Restore default center-bottom position (same as init)
    const canvas = this.engine?.getCanvas();
    this.currentPosition = {
      x: (canvas?.width ?? 1080) / 2,
      y: (canvas?.height ?? 1920) * 0.85,
    };
  }

  update(_dt: number): void {
    // Re-emit hold event every frame while pointer is down (for continuous movement)
    if (this.pointerState && this.currentPosition && this.canvas) {
      const canvasWidth = (this.canvas as HTMLCanvasElement)?.width ?? 800;
      const side = this.currentPosition.x < canvasWidth / 2 ? 'left' : 'right';
      this.emit('input:touch:hold', { x: this.currentPosition.x, y: this.currentPosition.y, side });
    }
  }

  destroy(): void {
    this.unbindEvents();
    this.clearLongPressTimer();
    this.canvas = null;
    this.pointerState = null;
    super.destroy();
  }
}
