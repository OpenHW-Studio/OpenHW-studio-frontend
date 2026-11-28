import { test, expect } from '@playwright/test';

/**
 * Theme + palette smoke test.
 *
 *  - toggling the theme twice leaves dataset.theme and localStorage in sync
 *    and produces no console/page errors
 *  - every new board can be added from the palette and produces a canvas item
 *    with its manifest label (including the micro:bit regex regression)
 */
const BOARDS = [
  { type: 'openhw-pi3', label: 'Raspberry Pi 3 B+ (Pyodide)' },
  { type: 'openhw-pi4', label: 'Raspberry Pi 4 B (Pyodide)' },
  { type: 'openhw-pi5', label: 'Raspberry Pi 5 (Pyodide)' },
  { type: 'openhw-esp32sc', label: 'ESP32 (esp32sim classic)' },
  { type: 'openhw-microbit-v2', label: 'BBC micro:bit v2' },
];

test.describe.configure({ mode: 'serial' });

test.describe('Theme + board-add smoke', () => {
  test.setTimeout(180000);

  test('theme toggles are clean and all new boards add from the palette', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      window.localStorage.setItem('theme', 'light');
    });
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-tour-id="palette-panel"]', { timeout: 60000 });
    // Registry warm-up gates palette/quick-add; wait for it explicitly.
    await expect(page.locator('[data-tour-id="palette-panel"]')).toHaveAttribute('aria-busy', 'false', { timeout: 60000 });

    // ── Theme: two toggles, attribute and storage must agree each time ──────
    const themeState = () => page.evaluate(() => ({
      attr: document.documentElement.dataset.theme,
      stored: localStorage.getItem('theme'),
    }));
    expect(await themeState()).toEqual({ attr: 'light', stored: 'light' });

    for (const expected of ['dark', 'light']) {
      const toggle = page.locator('button[title^="Switch to "]').first();
      await toggle.click();
      await expect.poll(themeState).toEqual({ attr: expected, stored: expected });
    }
    expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([]);

    // ── Palette: add each new board and see a labelled canvas item ──────────
    await page.locator('[data-tour-id="palette-panel"]').hover();
    await page.waitForTimeout(400);

    for (const { type, label } of BOARDS) {
      const tile = page.locator(`[data-tour-type="${type}"]`).first();
      await expect(tile, `missing palette tile for ${type}`).toBeVisible({ timeout: 30000 });
      await tile.click();
      const canvasItem = page.locator('[id^="comp-master-"]').filter({ hasText: label });
      await expect(canvasItem, `no canvas item labelled "${label}" after adding ${type}`)
        .toHaveCount(1, { timeout: 30000 });
      // comp-master is a zero-size positioning wrapper; its hit area proves
      // the board is actually rendered on the canvas.
      await expect(canvasItem.locator('[id^="comp-hit-"]').first())
        .toBeVisible({ timeout: 30000 });
    }

    expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([]);
  });
});
