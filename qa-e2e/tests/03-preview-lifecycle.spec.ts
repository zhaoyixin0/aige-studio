import { test, expect } from '@playwright/test';
import { createGameNoApi } from '../helpers/flows';

test.describe('Preview mode lifecycle', () => {
  test('can switch from Edit to Play and back', async ({ page }) => {
    await createGameNoApi(page, '做一个接水果游戏');

    const editBtn = page.getByRole('button', { name: 'Edit' });
    const playBtn = page.getByRole('button', { name: 'Play' });

    await expect(editBtn).toBeVisible();
    await expect(playBtn).toBeVisible();

    // Switch to Play mode — toolbar hides, "Exit Play Mode" overlay appears
    await playBtn.click();
    await expect(page.getByRole('button', { name: 'Exit Play Mode' })).toBeVisible({ timeout: 5_000 });

    // Canvas remains mounted
    await expect(page.locator('[data-canvas-mount="true"] canvas')).toBeVisible();

    // Switch back to Edit via Exit button
    await page.getByRole('button', { name: 'Exit Play Mode' }).click();

    // Toolbar returns
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible({ timeout: 5_000 });
  });

  test('FPS overlay toggle button responds to clicks', async ({ page }) => {
    await createGameNoApi(page, '做一个接水果游戏');

    const fpsBtn = page.getByRole('button', { name: 'FPS' });
    await expect(fpsBtn).toBeVisible();

    // Initially aria-pressed=false
    await expect(fpsBtn).toHaveAttribute('aria-pressed', 'false');

    // Click toggles to pressed
    await fpsBtn.click();
    await expect(fpsBtn).toHaveAttribute('aria-pressed', 'true');

    // Click again toggles back
    await fpsBtn.click();
    await expect(fpsBtn).toHaveAttribute('aria-pressed', 'false');
  });
});
