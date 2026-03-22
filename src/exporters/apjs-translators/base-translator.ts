import type { ModuleConfig } from '@/engine/core';

/**
 * Base class for Effect House .apjs module translators.
 * Each translator converts a specific ModuleConfig type into
 * Effect House compatible JavaScript code.
 */
export abstract class BaseTranslator {
  abstract readonly moduleType: string;

  /**
   * Translate a module config into Effect House .apjs script code.
   */
  abstract translate(config: ModuleConfig): string;

  /**
   * Return the Effect House capabilities required by this module.
   * e.g. 'FACE_TRACKING', 'HAND_TRACKING', 'TOUCH', 'AUDIO'
   */
  abstract getRequiredCapabilities(): string[];

  /**
   * Helper to generate a comment header for the translated block.
   */
  protected header(label: string): string {
    return `// --- ${label} ---`;
  }
}
