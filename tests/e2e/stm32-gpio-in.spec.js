import { test, expect } from '@playwright/test';

// F1 static digital-input probe (live): PB0 wired to 3V3 must read HIGH,
// PB1 wired to GND must read LOW. Bisects the DHT-nan failure into
// (a) input reads broken [engine] vs (b) response-path/timing [runner].
const CODE = 'void setup(){Serial.begin(9600);Serial.println("GPIOIN_READY");pinMode(PB0,INPUT);pinMode(PB1,INPUT);}\nvoid loop(){Serial.print("PB0=");Serial.print(digitalRead(PB0));Serial.print(" PB1=");Serial.println(digitalRead(PB1));delay(500);}\n';

test.describe('F1 GPIO-in static', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Bluepill reads wired HIGH and LOW', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
      ],
      wires: [
        { from: 'bp1:3V3.1', to: 'bp1:PB0' },
        { from: 'bp1:GND.1', to: 'bp1:PB1' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, serialNeedle: 'GPIOIN_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1GPIOIN verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F1GPIOIN serial:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('PB0=1');
    expect(verdict.serial || '').toContain('PB1=0');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
