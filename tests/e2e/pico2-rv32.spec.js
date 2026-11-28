import { test, expect } from '@playwright/test';

// Pico2 RV32 core (live): boots the engine's fixed rv32_tick proof image
// (backend has no RV32 Arduino toolchain) via the fixed-firmware board
// attr. Human-senses proof: RV32_TICK serial from the Hazard3 core.
const CODE = 'void setup(){}\nvoid loop(){}\n';

test.describe('Pico2 RV32', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('RV32 core prints RV32_TICK', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'p21', type: 'openhw-pico-2', attrs: { arch: 'rv32', firmware: '/firmware/rv32_tick.uf2' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, serialNeedle: 'RV32_TICK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('RV32 verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('RV32 serial head:', (verdict.serial || '').slice(0, 200));
    expect(verdict.pass).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
