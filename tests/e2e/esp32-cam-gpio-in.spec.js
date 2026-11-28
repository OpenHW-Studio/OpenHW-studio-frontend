import { test, expect } from '@playwright/test';

// ESP32-CAM GPIO-in (switch -> digitalRead): the cam SHELL exposes GPIO
// 4, so a slide-switch wiper drives it. TWO runs (switch wiper HIGH /
// LOW) prove the input path really follows the wired level instead of
// returning a constant. The switch model's own state is the oracle.
const CODE = 'void setup(){Serial.begin(115200);Serial.println("CAMGPIOIN_READY");pinMode(4,INPUT);}\nvoid loop(){Serial.print("CAMGPIO4=");Serial.println(digitalRead(4));delay(500);}\n';

async function runCase(page, swValue) {
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
    forMs: 30000, selectTelemetry: ['sw1'], serialNeedle: 'CAMGPIOIN_READY', telemetryMode: 'detail',
  }));
  expect(verdict.ok).toBe(true);
  return verdict;
}

test.describe('ESP32-CAM GPIO-in (switch -> digitalRead)', () => {
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
    page.on('pageerror', (err) => console.log('CAM-GPIOIN PAGEERROR:', String(err).slice(0, 300)));
    page.on('console', (m) => {
      try {
        const t = m.text();
        if (/MNA-TMP|Error|error|warn/i.test(t)) console.log('CAM-GPIOIN CONSOLE:', t.slice(0, 220));
      } catch { /* ignore */ }
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const hi = await runCase(page, '1');
    console.log('CAM-GPIOIN HIGH reasons:', JSON.stringify(hi.reasons || []), 'lines:', hi.serialLines);
    console.log('CAM-GPIOIN HIGH serial:', JSON.stringify((hi.serial || '').slice(-300)));
    expect(hi.pass).toBe(true);
    expect(hi.serial || '').toContain('CAMGPIO4=1');
    const swHi = (hi.telemetry || []).find((t) => t.id === 'sw1');
    console.log('CAM-GPIOIN HIGH switch:', JSON.stringify((swHi?.details?.custom || {})).slice(0, 160));

    const lo = await runCase(page, '0');
    console.log('CAM-GPIOIN LOW reasons:', JSON.stringify(lo.reasons || []), 'lines:', lo.serialLines);
    console.log('CAM-GPIOIN LOW serial:', JSON.stringify((lo.serial || '').slice(-300)));
    expect(lo.pass).toBe(true);
    expect(lo.serial || '').toContain('CAMGPIO4=0');
    const swLo = (lo.telemetry || []).find((t) => t.id === 'sw1');
    console.log('CAM-GPIOIN LOW switch:', JSON.stringify((swLo?.details?.custom || {})).slice(0, 160));

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
