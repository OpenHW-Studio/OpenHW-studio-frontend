import { test, expect } from '@playwright/test';

// ESP32 GPIO interrupts (DevKit): firmware pulses GPIO12 (OUTPUT) wired
// back to GPIO13 (INPUT, RISING ISR). Proves the EXTI path end to end:
// guest output edge -> pollGpioChanges publish -> net -> setPinInput ->
// guest ISR. No runner change (both halves already pumped).
const CODE = 'volatile int isrCount=0;\nvoid IRAM_ATTR onEdge(){isrCount++;}\nvoid setup(){Serial.begin(115200);Serial.println("EXTI_READY");pinMode(12,OUTPUT);digitalWrite(12,LOW);pinMode(13,INPUT_PULLDOWN);attachInterrupt(digitalPinToInterrupt(13),onEdge,RISING);}\nvoid loop(){digitalWrite(12,HIGH);delay(60);digitalWrite(12,LOW);delay(400);Serial.print("EXTI_COUNT:");Serial.println(isrCount);}\n';

test.describe('ESP32 GPIO interrupts', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('loopback pulse fires the ISR', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [
        { from: 'esp1:12', to: 'esp1:13' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 45000, serialNeedle: 'EXTI_COUNT:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPEXTI reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPEXTI serial:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const counts = [...(verdict.serial || '').matchAll(/EXTI_COUNT:(\d+)/g)].map((m) => Number(m[1]));
    console.log('ESPEXTI counts:', JSON.stringify(counts.slice(0, 8)));
    expect(counts.length).toBeGreaterThan(0);
    expect(counts[counts.length - 1]).toBeGreaterThanOrEqual(2);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
