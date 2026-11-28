import { test, expect } from '@playwright/test';

// ESP32-CAM touch (T0 = GPIO4 — a shell pin): the runner's touch pump
// drives the engine's setTouchInput counts, the guest reads them with
// the real Arduino touchRead(T0). Two runs (wiper HIGH / LOW) prove both
// ends of the range; the switch model is the oracle.
// Same recipe as the DevKit touch cell (esp32-touch), re-pinned to the
// cam shell (the DevKit's T0 is also GPIO4).
const CODE = 'void setup(){Serial.begin(115200);Serial.println("CAMTOUCH_READY");}\nvoid loop(){int v=touchRead(T0);Serial.print("CAMTOUCH_VAL:");Serial.println(v);delay(500);}\n';

async function runTouch(page, swValue) {
  const setup = await page.evaluate(({ code, v }) => window.OpenHWE2E.setupCircuit({
    components: [
      { id: 'cam1', type: 'openhw-esp32-cam', attrs: {}, x: 100, y: 100 },
      { id: 'sw1', type: 'openhw-slide-switch', attrs: { value: v }, x: 450, y: 120 },
    ],
    wires: [
      { from: 'cam1:3V3', to: 'sw1:3' },
      { from: 'cam1:GND.1', to: 'sw1:1' },
      { from: 'sw1:2', to: 'cam1:4' },
    ],
    code,
  }), { code: CODE, v: swValue });
  expect(setup.ok).toBe(true);
  const verdict = await page.evaluate(() => window.OpenHWE2E.run({
    forMs: 30000, selectTelemetry: ['sw1'], serialNeedle: 'CAMTOUCH_VAL:', telemetryMode: 'detail',
    }));
  expect(verdict.ok).toBe(true);
  return verdict;
}

test.describe('ESP32-CAM touch T0 (switch-driven counts)', () => {
  test.setTimeout(420000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('HIGH wiper reads touched-low, LOW wiper reads untouched', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('pageerror', (err) => console.log('CAM-TOUCH PAGEERROR:', String(err).slice(0, 300)));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const hi = await runTouch(page, '1');
    console.log('CAM-TOUCH HIGH reasons:', JSON.stringify(hi.reasons || []), 'lines:', hi.serialLines);
    const hiVals = [...(hi.serial || '').matchAll(/CAMTOUCH_VAL:(\d+)/g)].map((m) => Number(m[1]));
    console.log('CAM-TOUCH HIGH values:', JSON.stringify(hiVals.slice(0, 8)));
    expect(hi.pass).toBe(true);
    expect(hiVals.length).toBeGreaterThan(0);
    for (const v of hiVals.slice(2)) expect(v).toBeLessThan(100);

    const lo = await runTouch(page, '0');
    console.log('CAM-TOUCH LOW reasons:', JSON.stringify(lo.reasons || []), 'lines:', lo.serialLines);
    const loVals = [...(lo.serial || '').matchAll(/CAMTOUCH_VAL:(\d+)/g)].map((m) => Number(m[1]));
    console.log('CAM-TOUCH LOW values:', JSON.stringify(loVals.slice(0, 8)));
    expect(lo.pass).toBe(true);
    expect(loVals.length).toBeGreaterThan(0);
    for (const v of loVals.slice(2)) expect(v).toBeGreaterThan(500);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
