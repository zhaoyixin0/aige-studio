import type { GameConfig } from '@/engine/core';

/**
 * Encode a GameConfig to a URL-safe Base64 string.
 * Uses TextEncoder to handle Unicode (Chinese, emoji, etc.) safely.
 */
export function encodeConfig(config: GameConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(config));
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary);
}

/**
 * Decode a Base64 string back to a GameConfig.
 * Reverses the UTF-8 safe encoding produced by encodeConfig().
 */
export function decodeConfig(encoded: string): GameConfig {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as GameConfig;
}

/**
 * Try to load a GameConfig from the current URL hash.
 * Returns null if no `#config=` fragment is present or decoding fails.
 */
export function loadConfigFromHash(): GameConfig | null {
  const hash = window.location.hash;
  const prefix = '#config=';
  if (!hash.startsWith(prefix)) return null;

  try {
    return decodeConfig(hash.slice(prefix.length));
  } catch {
    return null;
  }
}
