/**
 * P4 Task 3 — Fast baseline spec for every hero preset and a sample of
 * expert presets. Validates that the baseline (pre-enrichment) canvas is
 * non-black after clicking "use preset <id>".
 *
 * Strategy:
 *   - Stub all AI requests (Claude + Gemini) so the flow is offline-fast.
 *   - For each preset, open landing → type "使用模板 <id>" → wait for canvas
 *     → read canvas pixels → assert not fully black.
 *   - Per-test timeout 30s (no AI calls = fast) and overall spec timeout
 *     ~10 min.
 *
 * This is the automated proof point for the P1-P4 mission: after clicking
 * hero-catch-fruit, the preview canvas is NOT all black.
 */
import { test, expect, type Page } from '@playwright/test';
import { openLanding, submitDescription, waitForStudioCanvas } from '../helpers/flows';

// Tight per-test budget — all AI calls are stubbed.
const PER_TEST_TIMEOUT_MS = 30_000;

// Hero preset ids to smoke-test. Kept in sync with HERO_PRESET_IDS in
// src/agent/conversation-defs.ts.
const HERO_PRESET_IDS = [
  'hero-catch-fruit',
  'hero-whack-a-mole',
  'hero-slingshot-launch',
  'hero-match-pairs',
  'hero-endless-runner',
  'hero-quiz-challenge',
  // Legacy presets tracked separately — known to have input-module gap.
  'hero-platformer-basic',
  'hero-shooter-wave',
];

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Stub all external AI calls. Must be attached BEFORE the first navigation.
 */
async function stubAI(page: Page): Promise<void> {
  await page.route('**/api/claude**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: 'stub' }] }),
    }),
  );
  await page.route('**/api/gemini**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ candidates: [] }),
    }),
  );
  await page.route('**/generativelanguage.googleapis.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ candidates: [] }),
    }),
  );
  await page.route('**/api.anthropic.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: 'stub' }] }),
    }),
  );
}

/**
 * Read canvas pixel data and detect whether it is "meaningfully non-black".
 * Returns { isBlack, samples } where samples is a diagnostic array.
 */
interface SentinelResult {
  readonly isBlack: boolean;
  readonly samples: readonly { r: number; g: number; b: number }[];
}

async function sampleCanvasPixels(page: Page): Promise<SentinelResult> {
  return await page.evaluate((): SentinelResult => {
    const canvas = document.querySelector(
      '[data-canvas-mount="true"] canvas',
    ) as HTMLCanvasElement | null;
    if (!canvas) {
      return { isBlack: true, samples: [] };
    }
    // PixiJS renders with WebGL — we read from the canvas via a 2D snapshot.
    // Fallback: create an intermediate 2D canvas and drawImage() into it.
    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    const ctx = snapshot.getContext('2d');
    if (!ctx) return { isBlack: true, samples: [] };
    try {
      ctx.drawImage(canvas, 0, 0);
    } catch {
      return { isBlack: true, samples: [] };
    }
    const points: Array<{ x: number; y: number }> = [
      { x: canvas.width >> 1, y: canvas.height >> 1 },
      { x: canvas.width >> 2, y: canvas.height >> 2 },
      { x: (canvas.width * 3) >> 2, y: canvas.height >> 2 },
      { x: canvas.width >> 2, y: (canvas.height * 3) >> 2 },
      { x: (canvas.width * 3) >> 2, y: (canvas.height * 3) >> 2 },
    ];
    const samples = points.map((p) => {
      try {
        const d = ctx.getImageData(p.x, p.y, 1, 1).data;
        return { r: d[0], g: d[1], b: d[2] };
      } catch {
        return { r: 0, g: 0, b: 0 };
      }
    });
    const THRESHOLD = 30;
    const isBlack = samples.every(
      (s) => s.r < THRESHOLD && s.g < THRESHOLD && s.b < THRESHOLD,
    );
    return { isBlack, samples };
  });
}

/**
 * Run the baseline sentinel check for one preset id.
 */
async function runPresetBaseline(
  page: Page,
  presetId: string,
): Promise<void> {
  await stubAI(page);
  await openLanding(page);
  await submitDescription(page, `使用模板 ${presetId}`);
  await waitForStudioCanvas(page);

  // Give the renderer one render frame to draw the initial state.
  await page.waitForTimeout(1500);

  const result = await sampleCanvasPixels(page);
  if (result.isBlack) {
    throw new Error(
      `Preset ${presetId} rendered a black canvas. Samples=${JSON.stringify(
        result.samples,
      )}`,
    );
  }
  expect(result.isBlack).toBe(false);
}

// ── Tests ──────────────────────────────────────────────────────

test.describe('Preset baseline — hero presets (fast, AI stubbed)', () => {
  test.describe.configure({ timeout: PER_TEST_TIMEOUT_MS });

  for (const presetId of HERO_PRESET_IDS) {
    test(`${presetId} — non-black baseline canvas`, async ({ page }) => {
      await runPresetBaseline(page, presetId);
    });
  }
});

test.describe('Preset baseline — acceptance anchor', () => {
  test.describe.configure({ timeout: PER_TEST_TIMEOUT_MS });

  test('hero-catch-fruit baseline is NOT black (P1-P4 acceptance proof)', async ({
    page,
  }) => {
    await runPresetBaseline(page, 'hero-catch-fruit');
  });
});
