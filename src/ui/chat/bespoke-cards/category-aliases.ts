/**
 * Maps legacy/plan category names to canonical ParamCategory values.
 * Unknown keys pass through unchanged to enable generic fallback.
 */
const CATEGORY_ALIASES: Readonly<Record<string, string>> = {
  visual: 'visual_audio',
  audio: 'visual_audio',
  particles: 'visual_audio',
  player: 'game_objects',
  enemy: 'game_objects',
};

export function resolveCategory(category: string): string {
  return CATEGORY_ALIASES[category] ?? category;
}
