import { test, expect } from '@playwright/test';

// F4 pace honesty (serial-only, no display/telemetry moving parts):
// Disco F407 + tickMHz:42 (div=4 on the 168MHz chip). The sketch prints
// millis() every delay(500); asserts are flake-proof by construction —
// needle-gated run, divider marker presence, adjacent-deduped samples,
// monotonic non-decreasing + strict advance. No exact-step asserts (boots
// can restart and interleave serial), no telemetry asserts.
const CODE = '#include <Arduino.h>\nvoid setup(){Serial.begin(9600);Serial.println("PACE_READY");}\nvoid loop(){unsigned long m=millis();Serial.print("MILLIS:");Serial.println(m);delay(500);}\n';

test.describe('F4 pace (millis monotonicity + divider marker)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('tickMHz:42 divides SysTick and guest millis advances monotonically', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f41', type: 'openhw-stm32f4', attrs: { tickMHz: 42 }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, serialNeedle: 'PACE_READY',
    }));
    expect(verdict.ok).toBe(true);
    console.log('PACE reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('PACE serial:', (verdict.serial || '').slice(0, 500));
    expect(verdict.pass).toBe(true);
    // Divider armed (168/42 = div 4).
    expect(verdict.serial || '').toContain('F4CLK:div=4');
    // Guest time advances: dedupe adjacent repeats (the serial path can
    // double-deliver lines across boots), then require monotonic
    // non-decreasing samples with strict overall advance.
    const raw = [...(verdict.serial || '').matchAll(/MILLIS:(\d+)/g)].map((m) => Number(m[1]));
    const samples = raw.filter((v, i) => i === 0 || v !== raw[i - 1]);
    console.log('PACE millis samples:', JSON.stringify(samples.slice(0, 12)));
    expect(samples.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    expect(Math.max(...samples)).toBeGreaterThan(Math.min(...samples));
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
