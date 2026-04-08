import { test, expect } from '@playwright/test';
import { createGameNoApi } from '../helpers/flows';

/**
 * Smoke test multiple game types via the regex fallback.
 *
 * Each input should:
 * - Match a KEYWORD_MAP entry in conversation-defs.ts
 * - Trigger create_game in processWithoutApi
 * - Produce a working canvas
 */
const GAME_TYPE_INPUTS = [
  { description: '做一个接水果游戏', label: 'catch' },
  { description: '做一个射击游戏', label: 'shooting' },
  { description: '做一个答题游戏', label: 'quiz' },
];

test.describe('Multi game type smoke', () => {
  for (const { description, label } of GAME_TYPE_INPUTS) {
    test(`creates a ${label} game from "${description}"`, async ({ page }) => {
      await createGameNoApi(page, description);

      // Each game must produce a visible canvas
      const canvas = page.locator('[data-canvas-mount="true"] canvas');
      await expect(canvas).toBeVisible();

      // Preview toolbar must render
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    });
  }
});
