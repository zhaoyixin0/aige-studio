import { ALL_GAME_TYPES, GAME_TYPE_META } from './game-presets';
import type { GameTypeOption } from '@/ui/chat/game-type-selector';

/**
 * Build the full list of game type options from GAME_TYPE_META.
 * Supported types appear first, then sorted alphabetically by category.
 */
export function buildGameTypeOptions(): GameTypeOption[] {
  return ALL_GAME_TYPES
    .map((id) => {
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
