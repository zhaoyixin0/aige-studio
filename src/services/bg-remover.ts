// src/services/bg-remover.ts
//
// Two background removal strategies:
// 1. chromaKeyRemove() — Fast HSV-based green screen removal (~10ms)
//    Used for sprites generated with #00FF00 green background prompts
// 2. remove() — @imgly ONNX WASM AI removal (~10-30s)
//    Fallback for images without green backgrounds

import { removeBackground } from '@imgly/background-removal';

export class BgRemover {
  /**
   * Fast chroma-key green screen removal using HSV color detection.
   * Targets #00FF00 green background with tolerance for Gemini's imperfect fills.
   * ~10ms per image vs ~10-30s for WASM AI removal.
   */
  async chromaKeyRemove(dataUrl: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let removedCount = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (this.isChromaGreen(r, g, b)) {
            // Make pixel fully transparent
            data[i + 3] = 0;
            removedCount++;
          } else if (this.isNearChromaGreen(r, g, b)) {
            // Semi-transparent for edge anti-aliasing
            const greenness = this.greenness(r, g, b);
            data[i + 3] = Math.round(255 * (1 - greenness));
            removedCount++;
          }
        }

        const totalPixels = data.length / 4;
        const removedPct = ((removedCount / totalPixels) * 100).toFixed(1);
        console.log(`[BgRemover] Chroma key: removed ${removedCount}/${totalPixels} pixels (${removedPct}%)`);

        // If less than 5% of pixels were green, the image probably didn't have
        // a green background — fall back to AI removal
        if (removedCount / totalPixels < 0.05) {
          console.warn('[BgRemover] Low green pixel count — image may not have green background, falling back to AI removal');
          this.remove(dataUrl).then(resolve).catch(() => resolve(dataUrl));
          return;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image for chroma key removal'));
      img.src = dataUrl;
    });
  }

  /** Check if a pixel is clearly chroma-key green */
  private isChromaGreen(r: number, g: number, b: number): boolean {
    // HSV-based: hue near 120° (green), high saturation, high value
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0 || max === 0) return false;

    const saturation = delta / max;
    const value = max / 255;

    // Must be saturated and bright
    if (saturation < 0.3 || value < 0.3) return false;

    // Hue must be in green range (90°-150°)
    let hue = 0;
    if (max === g) {
      hue = 60 * (((b - r) / delta) + 2);
    } else if (max === r) {
      hue = 60 * (((g - b) / delta) % 6);
    } else {
      hue = 60 * (((r - g) / delta) + 4);
    }
    if (hue < 0) hue += 360;

    return hue >= 80 && hue <= 160;
  }

  /** Check if pixel is near green (for anti-aliased edges) */
  private isNearChromaGreen(r: number, g: number, b: number): boolean {
    // Looser check for edge pixels that blend green with white/other colors
    if (g < 100) return false;
    if (g <= r || g <= b) return false;
    const greenDominance = g - Math.max(r, b);
    return greenDominance > 30;
  }

  /** How "green" is this pixel, 0-1 */
  private greenness(r: number, g: number, b: number): number {
    if (g === 0) return 0;
    const dominance = (g - Math.max(r, b)) / g;
    return Math.max(0, Math.min(1, dominance));
  }

  /**
   * AI-based background removal using @imgly ONNX WASM.
   * Slower (~10-30s) but works on any background color.
   */
  async remove(dataUrl: string): Promise<string> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const resultBlob = await removeBackground(blob, {
      progress: (key: string, current: number, total: number) => {
        console.log(`BgRemoval: ${key} ${Math.round((current / total) * 100)}%`);
      },
    });

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(resultBlob);
    });
  }
}
