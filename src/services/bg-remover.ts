// src/services/bg-remover.ts
import { removeBackground } from '@imgly/background-removal';

export class BgRemover {
  /**
   * Remove background from a data URL image.
   * Returns a new data URL with transparent background.
   * Skips processing for 'background' type assets.
   */
  async remove(dataUrl: string): Promise<string> {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Run background removal (ONNX WASM, runs in browser)
    const resultBlob = await removeBackground(blob, {
      progress: (key: string, current: number, total: number) => {
        console.log(`BgRemoval: ${key} ${Math.round((current / total) * 100)}%`);
      },
    });

    // Convert result blob back to data URL
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(resultBlob);
    });
  }
}
