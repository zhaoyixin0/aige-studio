import { ALL_GAME_TYPES, GAME_TYPE_META } from './game-presets';
import type { GameTypeOption } from '@/ui/chat/game-type-selector';

/**
 * Build the full list of game type options from GAME_TYPE_META.
 * Supported types appear first, then sorted alphabetically by category.
 *
 * Each option carries:
 *  - id / name / emoji / category from the catalog
 *  - supportedToday flag (drives the "Coming Soon" badge in the UI)
 *  - thumbnailUrl is intentionally omitted today; the selector falls back
 *    to emoji rendering until thumbnails ship.
 */
export function buildGameTypeOptions(): GameTypeOption[] {
  return ALL_GAME_TYPES
    .map((id): GameTypeOption => {
      const meta = GAME_TYPE_META[id];
      return {
        id,
        name: meta.displayName,
        emoji: meta.emoji,
        category: meta.category,
        supportedToday: meta.supportedToday,
      };
    })
    .sort((a, b) => {
      if (a.supportedToday !== b.supportedToday) return a.supportedToday ? -1 : 1;
      return (a.category ?? '').localeCompare(b.category ?? '');
    });
}

/**
 * Public alias for the full game type catalog. Prefer this name at call
 * sites that want to express intent ("give me the full catalog, not a
 * curated subset"), e.g. the GameTypeSelector inside StudioChatPanel.
 */
export function buildFullGameTypeOptions(): GameTypeOption[] {
  return buildGameTypeOptions();
}
