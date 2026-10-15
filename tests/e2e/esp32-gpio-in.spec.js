import { test, expect } from '@playwright/test';

// ESP32 GPIO-in (DevKit static): 3V3 rail wired to GPIO13 must read HIGH,
// GND wired to GPIO14 must read LOW. Input path is setPinInput via the
// base bidirectional poll (engine gap note in esp32-runner.ts covers only
// the output-readback half). Same assert shape as stm32-gpio-in.
const CODE = 'void setup(){Serial.begin(115200);Serial.println("GPIOIN_READY");pinMode(13,INPUT);pinMode(14,INPUT);}\nvoid loop(){Serial.print("GPIO13=");Serial.print(digitalRead(13));Serial.print(" GPIO14=");Serial.println(digitalRead(14));delay(500);}\n';

test.describe('ESP32 GPIO-in static', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('DevKit reads wired HIGH and LOW', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [
        { from: 'esp1:3V3', to: 'esp1:13' },
        { from: 'esp1:GND.1', to: 'esp1:14' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, serialNeedle: 'GPIOIN_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPGPIOIN reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPGPIOIN serial:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('GPIO13=1');
    expect(verdict.serial || '').toContain('GPIO14=0');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
