import { Container, Sprite, Texture } from 'pixi.js';

export class CameraLayer {
  private container: Container;
  private videoSprite: Sprite | null = null;

  constructor(container: Container) {
    this.container = container;
  }

  setVideoElement(video: HTMLVideoElement, width: number, height: number): void {
    // Create texture from video element
    const texture = Texture.from(video);
    this.videoSprite = new Sprite(texture);
    // Scale to fill canvas, mirror horizontally (selfie mode)
    this.videoSprite.width = width;
    this.videoSprite.height = height;
    this.videoSprite.scale.x = -1; // mirror
    this.videoSprite.x = width;
    this.videoSprite.alpha = 0.3; // semi-transparent camera feed
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
  }
}
