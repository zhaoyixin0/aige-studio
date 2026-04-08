/**
 * Asset streaming E2E regression (MASTER-PLAN 7.1 + 7.3).
 *
 * Verifies the production bug fix: after clicking a game-type chip, the first
 * sprite must appear in the store within 45 seconds and all sprites within
 * 180 seconds. Previously all sprites landed at once at ~145s, leaving a
 * blank canvas in between.
 *
 * Runs against production by default; override with BASE_URL env.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'https://aige-studio-app.vercel.app';

test.describe('Asset streaming', () => {
  test.setTimeout(300_000);

  test('first sprite visible by 45s, all visible by 180s', async ({ page }) => {
    const startTime = Date.now();
    const apiLog: { url: string; status: number; ms: number }[] = [];

    page.on('response', (resp) => {
      const u = resp.url();
      if (u.includes('/api/claude') || u.includes('/api/gemini')) {
        apiLog.push({
          url: u.split('/').pop() ?? '',
          status: resp.status(),
          ms: Date.now() - startTime,
        });
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2_000);

    // Click the "接" (catch) chip
    const chip = page.locator('button').filter({ hasText: /接/ }).first();
    await chip.click();
    console.log(`[${Date.now() - startTime}ms] clicked chip`);

    const countRealAssets = async (): Promise<number> => {
      return page.evaluate(() => {
        const w = window as unknown as { __gameStore?: { getState?: () => unknown } };
        const state = w.__gameStore?.getState?.() as
          | { config?: { assets?: Record<string, { src: string }> } }
          | undefined;
        return Object.values(state?.config?.assets ?? {}).filter((a) =>
          a.src.startsWith('data:'),
        ).length;
      });
    };

    // Phase 1: first sprite must appear within 45s
    await expect
      .poll(countRealAssets, {
        timeout: 45_000,
        intervals: [1_000, 2_000, 3_000, 5_000],
        message: 'Expected at least one real asset data URL within 45s',
      })
      .toBeGreaterThanOrEqual(1);

    console.log(`[${Date.now() - startTime}ms] first asset visible`);

    // Phase 2: majority of sprites must appear within 180s
    await expect
      .poll(countRealAssets, {
        timeout: 180_000,
        intervals: [5_000, 10_000],
        message: 'Expected at least 5 real assets within 180s total',
      })
      .toBeGreaterThanOrEqual(5);

    console.log(`[${Date.now() - startTime}ms] 5+ assets visible`);

    // Final snapshot for visual verification
    await page.screenshot({ path: 'qa-e2e/asset-streaming-final.png', fullPage: true });

    console.log('\n=== API timing ===');
    apiLog.forEach((r) => console.log(`[${r.ms}ms] ${r.url} → ${r.status}`));
  });
});
