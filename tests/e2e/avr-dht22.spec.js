import { test, expect } from '@playwright/test';

// DHT22 on Uno (live): bit-banged single-wire read through the AVR runner's
// DHT propagation path. Human-senses proof: real temperature + humidity
// numbers from the sensor model, printed on hardware Serial.
const CODE = '#include <DHT.h>\n#define DHTPIN 2\n#define DHTTYPE DHT22\nDHT dht(DHTPIN, DHTTYPE);\nvoid setup(){Serial.begin(9600);Serial.println("DHT_READY");dht.begin();}\nvoid loop(){float h=dht.readHumidity();float t=dht.readTemperature();Serial.print("DHT_READ DHT_T:");Serial.print(t);Serial.print(" DHT_H:");Serial.println(h);delay(2000);}\n';

test.describe('AVR DHT22', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Uno reads DHT22 temp + humidity', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'dht1', type: 'openhw-dht22', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:2', to: 'dht1:DATA' },
        { from: 'uno1:5V', to: 'dht1:VCC' },
        { from: 'uno1:GND', to: 'dht1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, selectTelemetry: ['dht1'], serialNeedle: 'DHT_READ', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('DHT verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('DHT serial head:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const m = /DHT_T:([0-9.]+) DHT_H:([0-9.]+)/.exec(verdict.serial || '');
    console.log('DHT values:', m ? m.slice(1) : 'NONE');
    expect(m).toBeTruthy();
    expect(Number(m[1])).toBeGreaterThan(-40);
    expect(Number(m[1])).toBeLessThan(80);
    expect(Number(m[2])).toBeGreaterThan(0);
    expect(Number(m[2])).toBeLessThanOrEqual(100);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
