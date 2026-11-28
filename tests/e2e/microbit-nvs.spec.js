import { test, expect } from '@playwright/test';

// micro:bit v2 NVS cell — STILL SKIPPED, now with exact blocker evidence.
// The runner erases pages (nvmc_take_erase → mem_write 0xFF → complete),
// but the byte-matched engine's `src/cpu/mem.rs:53` treats guest stores to
// flash as ignored ("real flash needs erase/program, serviced by the JS
// flash driver") and the NVMC model (`src/peripherals/nvmc_nrf.rs:123`)
// exposes only ERASE*, no program tap. Headless probe with the real MP
// image: `open('mylib.py','w')` reports 7 bytes written, then
// `os.listdir() == []` and `open('mylib.py','r')` raises ENOENT; adding
// QSPI read/write/erase pumps produces zero QSPI takes. No owner
// `nvs_nrf.bin` exists (blinky/*.bin list has none). Keeping the skip
// visible is honest; a green cell would require an engine flash-program
// tap, not a runner change.
test.describe.skip('micro:bit v2 NVS (blocked: runner patch + firmware)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('flash page erase -> write -> readback roundtrips magic', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    // The harness installs window.OpenHWE2E asynchronously; a fixed wait
    // races on a loaded host ("Cannot read properties of undefined
    // (reading 'setupCircuit')"). Wait for it explicitly.
    await page.waitForFunction(() => window.OpenHWE2E, null, { timeout: 90000 });
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { firmware: '/firmware/microbit/nvs_nrf.bin' }, x: 100, y: 100 },
      ],
      wires: [],
      code: '',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, serialNeedle: 'MB_NVS:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MB NVS serial:', (verdict.serial || '').slice(0, 200));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('MB_NVS:CAFEBABE');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
