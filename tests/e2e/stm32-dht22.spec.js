import { test, expect } from '@playwright/test';

// DHT22 on F1 Bluepill (live): bit-banged single-wire read via the shared
// _driveBoardPin bus service → engine gpio input injection. No engine
// changes: runner + engine API already exist. Proves the sensor path
// beyond AVR.
const CODE = '#include <DHT.h>\n#define DHTPIN PB0\n#define DHTTYPE DHT22\nDHT dht(DHTPIN, DHTTYPE);\nvoid setup(){Serial.begin(9600);Serial.println("DHT_READY");dht.begin();}\nvoid loop(){float h=dht.readHumidity();float t=dht.readTemperature();Serial.print("DHT_READ DHT_T:");Serial.print(t);Serial.print(" DHT_H:");Serial.println(h);delay(2000);}\n';

test.describe('F1 DHT22', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Bluepill reads DHT22 temp + humidity', async ({ page }) => {
    const dhtLogs = [];
    page.on('console', (msg) => {
      const t = msg.text();
      if (/dht|DHT-TEMP/i.test(t)) dhtLogs.push(t.slice(0, 160));
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
        { id: 'dht1', type: 'openhw-dht22', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'bp1:PB0', to: 'dht1:DATA' },
        { from: 'bp1:3V3.1', to: 'dht1:VCC' },
        { from: 'bp1:GND.1', to: 'dht1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, selectTelemetry: ['dht1'], serialNeedle: 'DHT_READ', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1DHT verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F1DHT serial head:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const m = /DHT_T:([0-9.\-]+) DHT_H:([0-9.\-]+)/.exec(verdict.serial || '');
    console.log('F1DHT values:', m ? m.slice(1) : 'NONE');
    console.log('F1DHT complog:', JSON.stringify(dhtLogs.slice(0, 12)));
    console.log('F1DHT liveOop:', JSON.stringify((verdict.liveOop || {}).dht1 || {}).slice(0, 400));
    const dt = (verdict.telemetry || []).find((t) => t.id === 'dht1');
    console.log('F1DHT telemetry:', JSON.stringify(dt || null).slice(0, 2600));
    expect(m).toBeTruthy();
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
