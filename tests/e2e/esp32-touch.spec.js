import { test, expect } from '@playwright/test';

// ESP32 touch (model truth, no touch component model): a slide-switch
// wiper wired to GPIO4 (T0) drives runner §E3 setTouchInput counts —
// 3V3 (HIGH) reads touched-low (~10), GND (LOW) reads untouched (~1000,
// engine default, worker-entry.js onTouchRead). Real Arduino touchRead.
// Two runs prove both ends; switch telemetry is the model-truth oracle.
const CODE = 'void setup(){Serial.begin(115200);Serial.println("TOUCH_READY");}\nvoid loop(){int v=touchRead(T0);Serial.print("TOUCH_VAL:");Serial.println(v);delay(500);}\n';

async function runTouch(page, swValue) {
  const setup = await page.evaluate(({ code, v }) => window.OpenHWE2E.setupCircuit({
    components: [
      { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      { id: 'sw1', type: 'openhw-slide-switch', attrs: { value: v }, x: 450, y: 120 },
    ],
    wires: [
      { from: 'esp1:3V3', to: 'sw1:3' },
      { from: 'esp1:GND.1', to: 'sw1:1' },
      { from: 'sw1:2', to: 'esp1:4' },
    ],
    code,
  }), { code: CODE, v: swValue });
  expect(setup.ok).toBe(true);
  const verdict = await page.evaluate(() => window.OpenHWE2E.run({
    forMs: 30000, selectTelemetry: ['sw1'], serialNeedle: 'TOUCH_VAL:', telemetryMode: 'detail',
  }));
  expect(verdict.ok).toBe(true);
  return verdict;
}

test.describe('ESP32 touch T0 (switch-driven counts)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('HIGH wiper reads touched-low', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const verdict = await runTouch(page, '1');
    console.log('TOUCH-HIGH reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const vals = [...(verdict.serial || '').matchAll(/TOUCH_VAL:(\d+)/g)].map((m) => Number(m[1]));
    console.log('TOUCH-HIGH values:', JSON.stringify(vals.slice(0, 8)));
    expect(vals.length).toBeGreaterThan(0);
    for (const v of vals.slice(2)) expect(v).toBeLessThan(100);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('LOW wiper reads untouched-high', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const verdict = await runTouch(page, '0');
    console.log('TOUCH-LOW reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const vals = [...(verdict.serial || '').matchAll(/TOUCH_VAL:(\d+)/g)].map((m) => Number(m[1]));
    console.log('TOUCH-LOW values:', JSON.stringify(vals.slice(0, 8)));
    expect(vals.length).toBeGreaterThan(0);
    for (const v of vals.slice(2)) expect(v).toBeGreaterThan(500);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
