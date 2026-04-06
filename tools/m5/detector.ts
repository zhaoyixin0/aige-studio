// tools/m5/detector.ts
// Classifies expert JSON files into one of three formats.

import type { ExpertFormat } from './types.ts';

/**
 * Detect the format of an expert JSON file.
 *
 * - knowledge: Has a `root` key (scene tree structure)
 * - sequence:  Has a top-level `command_sequence` array
 * - utility:   Everything else (snapshots, named templates, fragments)
 */
export function detectFormat(data: unknown): ExpertFormat {
  if (data == null || typeof data !== 'object') return 'utility';

  const obj = data as Record<string, unknown>;

  // Knowledge format: has a scene tree root
  if ('root' in obj && obj.root != null) return 'knowledge';

  // Sequence format: has a top-level command_sequence array
  if ('command_sequence' in obj && Array.isArray(obj.command_sequence)) return 'sequence';

  // Everything else is utility (snapshots, named template collections, etc.)
  return 'utility';
}
