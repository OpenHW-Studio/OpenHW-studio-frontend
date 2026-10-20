import { test, expect } from '@playwright/test';

// micro:bit v2 SAADC (ADC) cell.
//
// The guest firmware (public/firmware/microbit/saadc_nrf.bin, source
// saadc_nrf.s) programs SAADC CH0/AIN0, arms RESULT.PTR/MAXCNT, starts a
// sample and prints the RAW COUNT it read out of the RESULT buffer.
//
// The host owns the analog world: the runner pump takes the staged
// RESULT transfer, writes the sample into guest RAM and completes it
// (owner recipe: take_result -> mem_write -> complete_result). The
// printed number is therefore the value the host injected, observed by
// the guest through the ADC — never a firmware self-report.
//
// Two cells:
//  - potentiometer: pot SIG -> mb1:P0 (P0.02 = AIN0), 3V3/GND rails.
//    The runner converts the pot's wiper voltage into SAADC counts
//    (0.6 V VREF, gain 1/6 -> 3.6 V full scale, 12-bit -> 0..4095).
//  - board attr: `adcMv` drives the same input when nothing is wired.
//
// Expected counts (counts = round(mV * 4096 / 3600)):
//  50 % pot on a 3.3 V rail -> 1650 mV -> 1877
//  600 mV attr            ->  683
const RUNS = [
  { tag: 'pot', attrs: {}, extra: 'pot', expected: 1877 },
  { tag: 'attr-600mV', attrs: { adcMv: 600 }, extra: null, expected: 683 },
];

test.describe('micro:bit v2 SAADC (AIN0)', () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const run of RUNS) {
    test(`guest reads the injected sample (${run.tag})`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);

      const components = [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { firmware: '/firmware/microbit/saadc_nrf.bin', ...run.attrs }, x: 100, y: 100 },
      ];
      const wires = [];
      if (run.extra === 'pot') {
        components.push({ id: 'pot1', type: 'openhw-potentiometer', attrs: { value: 50 }, x: 450, y: 120 });
        wires.push(
          { from: 'mb1:P0', to: 'pot1:SIG' },
          { from: 'mb1:3V3', to: 'pot1:1' },
          { from: 'mb1:GND', to: 'pot1:2' },
        );
      }
      const setup = await page.evaluate(({ components, wires }) => window.OpenHWE2E.setupCircuit({
        components, wires, code: '',
      }), { components, wires });
      expect(setup.ok).toBe(true);

      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 25000, serialNeedle: 'MB_SAADC:', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`MB SAADC ${run.tag} serial:`, JSON.stringify((verdict.serial || '').slice(0, 200)));
      expect(verdict.pass).toBe(true);

      const m = /MB_SAADC:(\d+)/.exec(verdict.serial || '');
      expect(m).toBeTruthy();
      const got = Number(m[1]);
      console.log(`MB SAADC ${run.tag}: got ${got}, expected ${run.expected}`);
      expect(got).toBe(run.expected);
      expect(errors).toEqual([]);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
