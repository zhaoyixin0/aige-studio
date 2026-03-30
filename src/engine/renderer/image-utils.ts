import { Container, Sprite, Text, Texture, TextStyle } from 'pixi.js';

/**
 * Load a data URL image into a PixiJS Container as a Sprite (async).
 * Falls back to an emoji placeholder if the image fails to load.
 */
export function loadDataUrlIntoContainer(
  wrapper: Container,
  dataUrl: string,
  size: number,
  fallbackEmoji = '?',
): void {
  const img = new window.Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, size, size);
    const texture = Texture.from(canvas);
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.width = size;
    sprite.height = size;
    wrapper.addChild(sprite);
  };
  img.onerror = () => {
    // Fallback to emoji placeholder on load failure
    const text = new Text({
      text: fallbackEmoji,
      style: new TextStyle({ fontSize: Math.round(size * 0.8) }),
    });
    text.anchor.set(0.5);
    wrapper.addChild(text);
  };
  img.src = dataUrl;
}
