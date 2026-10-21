import { test, expect } from '@playwright/test';

// ESP32 DevKit GPIO-in, SWITCH variant: the existing esp32-gpio-in cell
// wires STATIC rails (3V3 -> GPIO13, GND -> GPIO14). This cell closes
// the other half of the matrix gap ("no switch->digitalRead cell"): a
// slide-switch wiper drives GPIO13, and TWO runs (wiper HIGH / LOW)
// prove the guest read follows the wired level instead of a constant.
const CODE = 'void setup(){Serial.begin(115200);Serial.println("GPIOSW_READY");pinMode(13,INPUT);}\nvoid loop(){Serial.print("GPIO13=");Serial.println(digitalRead(13));delay(500);}\n';

async function runCase(page, swValue) {
  const setup = await page.evaluate(({ code, v }) => window.OpenHWE2E.setupCircuit({
    components: [
      { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      { id: 'sw1', type: 'openhw-slide-switch', attrs: { value: v }, x: 450, y: 120 },
    ],
    wires: [
      { from: 'esp1:3V3', to: 'sw1:3' },
      { from: 'esp1:GND.1', to: 'sw1:1' },
      { from: 'sw1:2', to: 'esp1:13' },
    ],
    code,
  }), { code: CODE, v: swValue });
  expect(setup.ok).toBe(true);
  const verdict = await page.evaluate(() => window.OpenHWE2E.run({
    forMs: 30000, selectTelemetry: ['sw1'], serialNeedle: 'GPIOSW_READY', telemetryMode: 'detail',
  }));
  expect(verdict.ok).toBe(true);
  return verdict;
}

test.describe('ESP32 GPIO-in (switch -> digitalRead)', () => {
  test.setTimeout(420000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('wiper HIGH reads 1, wiper LOW reads 0', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('pageerror', (err) => console.log('ESP-GPIOSW PAGEERROR:', String(err).slice(0, 300)));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const hi = await runCase(page, '1');
    console.log('ESP-GPIOSW HIGH reasons:', JSON.stringify(hi.reasons || []), 'lines:', hi.serialLines);
    console.log('ESP-GPIOSW HIGH serial:', JSON.stringify((hi.serial || '').slice(-300)));
    expect(hi.pass).toBe(true);
    expect(hi.serial || '').toContain('GPIO13=1');

    const lo = await runCase(page, '0');
    console.log('ESP-GPIOSW LOW reasons:', JSON.stringify(lo.reasons || []), 'lines:', lo.serialLines);
    console.log('ESP-GPIOSW LOW serial:', JSON.stringify((lo.serial || '').slice(-300)));
    expect(lo.pass).toBe(true);
    expect(lo.serial || '').toContain('GPIO13=0');

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
