import { test, expect } from '@playwright/test';

// Pico guest-clock (tickMHz) timing honesty (pico-runner.ts:
// resolvePicoClockMHz/applyPicoClock + getSimulatedTimeMs override).
// Firmware prints millis() every delay(1000) — both virtual. At
// tickMHz=25 the same retired-cycle budget yields 5x more virtual ms
// per wall second than the 125MHz default, so the 25MHz cell prints
// ~5x more PICOTICK_MS lines in the same wall window. Margins are
// wide (2x) so host wobble can't flip them; an invalid tickMHz must
// behave like the default (opt-in, default untouched).

const CODE = 'void setup(){Serial.begin(9600);}\nvoid loop(){Serial.println("PICOTICK_MS:" + String(millis()));delay(1000);}\n';

async function runCell(page, board, type, attrs, forMs = 25000) {
  await page.addInitScript(() => {
    window.localStorage.setItem('openhw-tour-completed', 'true');
  });
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const setup = await page.evaluate(([b, bt, at, cd]) => window.OpenHWE2E.setupCircuit({
    components: [{ id: b, type: bt, attrs: at, x: 100, y: 100 }],
    wires: [],
    code: cd,
  }), [board, type, attrs, CODE]);
  expect(setup.ok).toBe(true);
  const verdict = await page.evaluate((o) => window.OpenHWE2E.run(o), {
    forMs, serialNeedle: 'PICOTICK_MS:', telemetryMode: 'detail',
  });
  expect(verdict.ok).toBe(true);
  console.log(`tickMHz=${JSON.stringify(attrs)} verdict:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
  expect(verdict.pass).toBe(true);
  const lines = (verdict.serial || '').match(/PICOTICK_MS:/g) || [];
  console.log(`tickMHz=${JSON.stringify(attrs)} PICOTICK_MS count:`, lines.length);
  await page.evaluate(() => window.OpenHWE2E.stop());
  await page.waitForTimeout(2000);
  return lines.length;
}

test.describe('Pico guest-clock (tickMHz) timing honesty', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('tickMHz=25 runs ~5x more virtual ms per wall second than default', async ({ page }) => {
    const slow = await runCell(page, 'pico1', 'openhw-pico', {});
    expect(slow).toBeGreaterThanOrEqual(1);
    const fast = await runCell(page, 'pico1', 'openhw-pico', { tickMHz: '25' });
    expect(fast).toBeGreaterThanOrEqual(slow * 2);
  });

  test('invalid tickMHz falls back to the default clock', async ({ page }) => {
    const def = await runCell(page, 'pico1', 'openhw-pico', {});
    expect(def).toBeGreaterThanOrEqual(1);
    const bogus = await runCell(page, 'pico1', 'openhw-pico', { tickMHz: 'banana' });
    expect(bogus).toBeGreaterThanOrEqual(Math.max(1, Math.floor(def / 2)));
    expect(bogus).toBeLessThanOrEqual(Math.max(4, def * 2));
  });
});
