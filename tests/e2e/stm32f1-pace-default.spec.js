import { test, expect } from '@playwright/test';

// F1 default-settings pace guardrail (Blue Pill, no tickMHz attr): the
// runner-side per-tick cuts (leveling gate, SPI CS + fan-out caches,
// PWM no-listener skip, USB post-enumeration skip) must never slow or stall
// guest time. Same sketch as stm32f1-pace.spec.js (millis() serial proof).
// Asserts: MILLIS samples present, monotonic non-decreasing, net advance —
// presence + monotonicity only, never exact counts or spreads.
const CODE = 'void setup(){Serial.begin(9600);Serial.println("F1PACE_READY");}\nvoid loop(){Serial.print("MILLIS:");Serial.println(millis());delay(2000);}\n';

test.describe('F1 default pace (guest millis advances, no marker)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('default board advances guest millis with no clock marker', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 120000, serialNeedle: 'MILLIS', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1PACE-DEF reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F1PACE-DEF serial:', (verdict.serial || '').slice(0, 500));
    expect(verdict.pass).toBe(true);
    // Default divider off: no F1CLK marker.
    expect(verdict.serial || '').not.toContain('F1CLK:div=');
    // Guest time advances: dedupe (the serial path can double-deliver
    // lines across boots), then monotonic non-decreasing with net advance.
    const raw = [...(verdict.serial || '').matchAll(/MILLIS:(\d+)/g)].map((m) => Number(m[1]));
    const samples = raw.filter((v, i) => i === 0 || v !== raw[i - 1]);
    console.log('F1PACE-DEF millis samples:', JSON.stringify(samples.slice(0, 10)));
    expect(samples.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    expect(samples[samples.length - 1]).toBeGreaterThan(samples[0]);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
