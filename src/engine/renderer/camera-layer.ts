import { Container, Graphics, Sprite, Texture } from 'pixi.js';

/** Layout info returned by computeCoverLayout for positioning and coordinate remapping. */
export interface CoverLayout {
  /** Scaled video width in canvas pixels */
  scaledWidth: number;
  /** Scaled video height in canvas pixels */
  scaledHeight: number;
  /** Horizontal offset (negative means overflow cropped from sides) */
  offsetX: number;
  /** Vertical offset (negative means overflow cropped from top/bottom) */
  offsetY: number;
  /** Crop boundaries in normalized video coordinates (0-1) for coordinate remapping */
  crop: {
    startX: number;
    endX: number;
    startY: number;
    endY: number;
  };
}

/**
 * Compute "cover" layout: scale video to fill canvas while preserving aspect ratio.
 * Overflow is cropped (centered). Returns layout info for rendering and coordinate remapping.
 *
 * Pure function — no PixiJS dependency, fully testable.
 */
export function computeCoverLayout(
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): CoverLayout {
  const videoAR = videoWidth / videoHeight;
  const canvasAR = canvasWidth / canvasHeight;

  let scale: number;
  let offsetX = 0;
  let offsetY = 0;
  let cropStartX = 0;
  let cropEndX = 1;
  let cropStartY = 0;
  let cropEndY = 1;

  if (videoAR > canvasAR) {
    // Video is wider than canvas — fit height, crop sides
    scale = canvasHeight / videoHeight;
    const scaledW = videoWidth * scale;
    offsetX = -(scaledW - canvasWidth) / 2;

    // Compute crop in normalized video coordinates
    const visibleFraction = canvasAR / videoAR;
    const cropMargin = (1 - visibleFraction) / 2;
    cropStartX = cropMargin;
    cropEndX = 1 - cropMargin;
  } else if (videoAR < canvasAR) {
    // Video is taller than canvas — fit width, crop top/bottom
    scale = canvasWidth / videoWidth;
    const scaledH = videoHeight * scale;
    offsetY = -(scaledH - canvasHeight) / 2;

    // Compute crop in normalized video coordinates
    const visibleFraction = videoAR / canvasAR;
    const cropMargin = (1 - visibleFraction) / 2;
    cropStartY = cropMargin;
    cropEndY = 1 - cropMargin;
  } else {
    // Perfect match — no crop
    scale = canvasWidth / videoWidth;
  }

  return {
    scaledWidth: videoWidth * scale,
    scaledHeight: videoHeight * scale,
    offsetX,
    offsetY,
    crop: {
      startX: cropStartX,
      endX: cropEndX,
      startY: cropStartY,
      endY: cropEndY,
    },
  };
}

export class CameraLayer {
  private container: Container;
  private videoSprite: Sprite | null = null;
  private maskGraphics: Graphics | null = null;

  constructor(container: Container) {
    this.container = container;
  }

  setVideoElement(
    video: HTMLVideoElement,
    canvasWidth: number,
    canvasHeight: number,
    videoWidth?: number,
    videoHeight?: number,
  ): void {
    const vw = videoWidth ?? video.videoWidth;
    const vh = videoHeight ?? video.videoHeight;

    // Caller must ensure video dimensions are available (after loadedmetadata)
    if (!vw || !vh) {
      return;
    }

    const layout = computeCoverLayout(vw, vh, canvasWidth, canvasHeight);

    const texture = Texture.from(video);
    this.videoSprite = new Sprite(texture);

    // Apply cover scaling
    this.videoSprite.width = layout.scaledWidth;
    this.videoSprite.height = layout.scaledHeight;

    // Mirror horizontally (selfie mode) and position with cover offset
    this.videoSprite.scale.x *= -1;
    this.videoSprite.x = canvasWidth - layout.offsetX; // mirror flips, so adjust
    this.videoSprite.y = layout.offsetY;

    this.videoSprite.alpha = 0.3;

    // Mask to canvas bounds to clip overflow
    this.maskGraphics = new Graphics();
    this.maskGraphics.rect(0, 0, canvasWidth, canvasHeight).fill({ color: 0xffffff });
    this.container.addChild(this.maskGraphics);
    this.container.mask = this.maskGraphics;

    this.container.addChild(this.videoSprite);
  }

  setOpacity(alpha: number): void {
    if (this.videoSprite) this.videoSprite.alpha = alpha;
  }

  destroy(): void {
    if (this.videoSprite) {
      this.container.removeChild(this.videoSprite);
      this.videoSprite.destroy();
      this.videoSprite = null;
    }
    if (this.maskGraphics) {
      this.container.removeChild(this.maskGraphics);
      this.maskGraphics.destroy();
      this.maskGraphics = null;
    }
    this.container.mask = null;
  }
}
