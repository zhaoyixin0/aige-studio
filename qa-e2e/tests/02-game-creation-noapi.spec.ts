import { test, expect } from '@playwright/test';
import { createGameNoApi, openLanding, submitDescription, waitForStudioCanvas } from '../helpers/flows';

test.describe('Game creation without API key', () => {
  test('regex fallback creates a catch game from "做一个接水果游戏"', async ({ page }) => {
    await openLanding(page);
    await submitDescription(page, '做一个接水果游戏');

    // Studio phase canvas appears
    await waitForStudioCanvas(page);

    // Verify the inner PixiJS canvas exists
    const canvas = page.locator('[data-canvas-mount="true"] canvas');
    await expect(canvas).toBeVisible();

    // Preview toolbar should be present in edit mode
    await expect(page.getByText('Preview', { exact: false }).first()).toBeVisible();
  });

  test('end-to-end no-api flow via helper', async ({ page }) => {
    await createGameNoApi(page, '做一个射击游戏');

    // Confirm preview toolbar buttons exist
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  });
});
