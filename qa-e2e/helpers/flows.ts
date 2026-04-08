import { type Page, expect } from '@playwright/test';

/**
 * Shared helpers for AIGE Studio E2E tests.
 *
 * No selectors are hardcoded as data-testid because the source files
 * intentionally avoid leaking testing concerns into product code.
 * We use role + visible text matchers, which match how a user perceives
 * the UI and survive minor visual refactors.
 */

/**
 * Open the landing page and wait for the title heading to render.
 */
export async function openLanding(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AIGE Studio', level: 1 })).toBeVisible();
}

/**
 * Type a description into the landing textarea and submit it.
 *
 * Uses keyboard Enter (not Shift+Enter) which the LandingPage handler
 * (`handleKeyDown`) treats as submit.
 */
export async function submitDescription(page: Page, description: string): Promise<void> {
  const textarea = page.getByPlaceholder('描述你想做的游戏...');
  await textarea.click();
  await textarea.fill(description);
  await textarea.press('Enter');
}

/**
 * Wait for the studio phase to mount and a PixiJS canvas to be present.
 *
 * The canvas mount uses `data-canvas-mount="true"`. The actual <canvas>
 * element is appended by useEngine asynchronously after PixiRenderer.init().
 */
export async function waitForStudioCanvas(page: Page): Promise<void> {
  // The mount container appears as soon as layoutPhase === 'studio'
  await page.locator('[data-canvas-mount="true"]').waitFor({ state: 'visible', timeout: 30_000 });
  // Then the inner <canvas> element is added by PixiJS
  await page.locator('[data-canvas-mount="true"] canvas').waitFor({ state: 'visible', timeout: 30_000 });
}

/**
 * Create a game using the regex fallback path (no API key required).
 * Returns once the canvas is mounted in studio phase.
 */
export async function createGameNoApi(page: Page, description: string): Promise<void> {
  await openLanding(page);
  await submitDescription(page, description);
  await waitForStudioCanvas(page);
}
