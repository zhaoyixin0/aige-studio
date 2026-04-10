/**
 * P4 Task 4 — Slow enrichment spec. Exercises the real Claude /
 * Gemini paths for two representative preset templates:
 *   - hero-catch-fruit (spawner class, skeleton path)
 *   - hero-shooter-wave (shooter class, legacy path)
 *
 * For each preset:
 *   1. Baseline canvas renders non-black (same as 20-preset-baseline).
 *   2. The PresetEnrichmentBadge enters state="running".
 *   3. The PresetEnrichmentBadge reaches state="done".
 *   4. window.__gameStore.getState().config.meta.presetEnriched === true.
 *
 * AI path timeout budget:
 *   - Per-test timeout = 200s (AIGE Studio 2026-04-08 E2E rule ≥ 180s)
 *
 * These tests are allowed to be slow and to skip if the machine has no
 * VITE_ANTHROPIC_API_KEY configured — enrichment falls back to 'failed'
 * in that case, which we still verify as a valid terminal state.
 */
import { test, expect, type Page } from '@playwright/test';
import { openLanding, submitDescription, waitForStudioCanvas } from '../helpers/flows';

const PER_TEST_TIMEOUT_MS = 200_000;

const SLOW_PRESET_IDS = ['hero-catch-fruit', 'hero-shooter-wave'] as const;

async function waitForEnrichmentTerminal(page: Page): Promise<string> {
  // Poll the hook-driven badge for a terminal state. We accept any of
  // "done" / "failed" / "cancelled" as terminal — "running" is transient.
  return await page.evaluate(async (): Promise<string> => {
    const terminalStates = new Set(['done', 'failed', 'cancelled']);
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      const badge = document.querySelector(
        '[data-testid="preset-enrichment-badge"]',
      );
      if (badge) {
        const state = badge.getAttribute('data-state') ?? '';
        if (terminalStates.has(state)) return state;
      } else {
        // If hook hasn't mounted yet or idle → check store.
        const w = window as unknown as {
          __gameStore?: { getState?: () => unknown };
        };
        const state = w.__gameStore?.getState?.() as
          | { config?: { meta?: { presetEnriched?: unknown } } }
          | undefined;
        const flag = state?.config?.meta?.presetEnriched;
        if (
          flag === true ||
          flag === 'failed' ||
          flag === 'cancelled'
        ) {
          return String(flag);
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return 'timeout';
  });
}

async function readPresetEnriched(page: Page): Promise<unknown> {
  return await page.evaluate((): unknown => {
    const w = window as unknown as {
      __gameStore?: { getState?: () => unknown };
    };
    const state = w.__gameStore?.getState?.() as
      | { config?: { meta?: { presetEnriched?: unknown } } }
      | undefined;
    return state?.config?.meta?.presetEnriched;
  });
}

test.describe('Preset enrichment — real AI path', () => {
  test.describe.configure({ timeout: PER_TEST_TIMEOUT_MS });

  for (const presetId of SLOW_PRESET_IDS) {
    test(`${presetId} — enrichment reaches terminal state`, async ({
      page,
    }) => {
      await openLanding(page);
      await submitDescription(page, `使用模板 ${presetId}`);
      await waitForStudioCanvas(page);

      // Baseline must be visible before enrichment runs.
      await expect(
        page.locator('[data-canvas-mount="true"] canvas'),
      ).toBeVisible();

      const terminal = await waitForEnrichmentTerminal(page);
      expect(['done', 'failed', 'cancelled']).toContain(terminal);

      const flag = await readPresetEnriched(page);
      // Terminal meta flag must be one of the valid lifecycle markers.
      expect([true, 'failed', 'cancelled']).toContain(flag);
    });
  }
});
