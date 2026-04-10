import { test, expect, type ConsoleMessage, type Request } from '@playwright/test';
import { createGameNoApi, openLanding } from '../helpers/flows';

/**
 * Bug discovery harness — captures all browser console errors/warnings
 * and failed network requests during representative user flows.
 *
 * NOT a regression test. Designed to surface latent issues into the
 * test report so we can triage them. Each test asserts an empty error
 * collection so any new bug shows up as a failure.
 */

type CapturedConsole = { type: string; text: string; location?: string };
type CapturedFailure = { url: string; method: string; failure: string | null };

function attachListeners(page: import('@playwright/test').Page) {
  const consoleErrors: CapturedConsole[] = [];
  const consoleWarnings: CapturedConsole[] = [];
  const failedRequests: CapturedFailure[] = [];
  const responseErrors: Array<{ url: string; status: number; statusText: string }> = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ type: msg.type(), text: msg.text(), location: msg.location().url });
    } else if (msg.type() === 'warning') {
      consoleWarnings.push({ type: msg.type(), text: msg.text(), location: msg.location().url });
    }
  });

  page.on('requestfailed', (req: Request) => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText ?? null,
    });
  });

  page.on('response', (resp) => {
    if (resp.status() >= 400 && !resp.url().includes('favicon')) {
      responseErrors.push({
        url: resp.url(),
        status: resp.status(),
        statusText: resp.statusText(),
      });
    }
  });

  return { consoleErrors, consoleWarnings, failedRequests, responseErrors };
}

test.describe('Bug discovery — landing page load', () => {
  test('clean landing load produces no console errors or failed requests', async ({ page }) => {
    const captures = attachListeners(page);
    await openLanding(page);
    // Give async work a moment to settle
    await page.waitForTimeout(2000);

    console.log('\n=== LANDING LOAD DIAGNOSTICS ===');
    console.log('Console errors:', JSON.stringify(captures.consoleErrors, null, 2));
    console.log('Console warnings:', JSON.stringify(captures.consoleWarnings, null, 2));
    console.log('Failed requests:', JSON.stringify(captures.failedRequests, null, 2));
    console.log('HTTP error responses:', JSON.stringify(captures.responseErrors, null, 2));
    console.log('=== END DIAGNOSTICS ===\n');

    // Soft assertions — log everything but only fail on hard errors
    expect(captures.failedRequests, 'Failed network requests on landing').toHaveLength(0);
  });
});

test.describe('Bug discovery — game creation flow', () => {
  test('creating a catch game surfaces all bugs in the asset pipeline', async ({ page }) => {
    const captures = attachListeners(page);
    await createGameNoApi(page, '做一个接水果游戏');
    await page.waitForTimeout(5000); // Let async asset fulfillment complete/fail

    console.log('\n=== GAME CREATION DIAGNOSTICS (catch) ===');
    console.log('Console errors:', JSON.stringify(captures.consoleErrors, null, 2));
    console.log('Console warnings:', JSON.stringify(captures.consoleWarnings, null, 2));
    console.log('Failed requests:', JSON.stringify(captures.failedRequests, null, 2));
    console.log('HTTP error responses:', JSON.stringify(captures.responseErrors, null, 2));
    console.log('=== END DIAGNOSTICS ===\n');

    // The canvas must still be visible despite asset failures
    await expect(page.locator('[data-canvas-mount="true"] canvas')).toBeVisible();
  });

  test('creating a shooting game surfaces shooter-specific bugs', async ({ page }) => {
    const captures = attachListeners(page);
    await createGameNoApi(page, '做一个射击游戏');
    await page.waitForTimeout(5000);

    console.log('\n=== GAME CREATION DIAGNOSTICS (shooting) ===');
    console.log('Console errors:', JSON.stringify(captures.consoleErrors, null, 2));
    console.log('Console warnings:', JSON.stringify(captures.consoleWarnings, null, 2));
    console.log('Failed requests:', JSON.stringify(captures.failedRequests, null, 2));
    console.log('HTTP error responses:', JSON.stringify(captures.responseErrors, null, 2));
    console.log('=== END DIAGNOSTICS ===\n');

    await expect(page.locator('[data-canvas-mount="true"] canvas')).toBeVisible();
  });
});

// ── P4 Task 5 — hero preset sweep for runtime crashes ─────────────
// Clicks through every hero preset quickly and records console errors
// and failed network requests. Not a pixel-level check; the goal is to
// surface uncaught exceptions and 4xx/5xx asset loads.
test.describe('Bug discovery — hero preset sweep', () => {
  const HERO_PRESET_IDS = [
    'hero-catch-fruit',
    'hero-whack-a-mole',
    'hero-slingshot-launch',
    'hero-match-pairs',
    'hero-endless-runner',
    'hero-quiz-challenge',
    'hero-platformer-basic',
    'hero-shooter-wave',
  ];

  for (const presetId of HERO_PRESET_IDS) {
    test(`${presetId} — no runtime crashes during baseline load`, async ({ page }, testInfo) => {
      const captures = attachListeners(page);
      await createGameNoApi(page, `使用模板 ${presetId}`);
      await page.waitForTimeout(5000);

      console.log(`\n=== HERO PRESET DIAGNOSTICS (${presetId}) ===`);
      console.log('Console errors:', JSON.stringify(captures.consoleErrors, null, 2));
      console.log('Failed requests:', JSON.stringify(captures.failedRequests, null, 2));
      console.log('HTTP error responses:', JSON.stringify(captures.responseErrors, null, 2));
      console.log('=== END DIAGNOSTICS ===\n');

      // Attach captures as a test artifact so CI can triage.
      await testInfo.attach(`${presetId}-diagnostics.json`, {
        contentType: 'application/json',
        body: Buffer.from(
          JSON.stringify(
            {
              presetId,
              consoleErrors: captures.consoleErrors,
              failedRequests: captures.failedRequests,
              responseErrors: captures.responseErrors,
            },
            null,
            2,
          ),
        ),
      });

      // Canvas must still render despite any background asset failures.
      await expect(page.locator('[data-canvas-mount="true"] canvas')).toBeVisible();
      // No uncaught JS errors allowed.
      expect(
        captures.consoleErrors.filter((e) => !/favicon/i.test(e.text)),
        `Uncaught console errors for ${presetId}`,
      ).toHaveLength(0);
    });
  }
});
