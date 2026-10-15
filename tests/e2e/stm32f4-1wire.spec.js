import { test, expect } from '@playwright/test';

// F4 DHT22 single-wire (all five chips) — NO-GO (2026-10-12, lane/f4
// bisected, specs unchanged): reads return NaN on all chips. Runner-side
// delivery verified working (ODR-drive WAKE feed + per-20K-chunk polling +
// 512-instr fine slicing all engage — isTransactionActive goes live), but
// the guest decodes bit slots with micros(), which is 1ms-quantized on
// this engine (probed: 200K-iteration busy loop reads 7000us while
// delayMicroseconds(500) reads 0) — 26/70us slots cannot decode (DWT /
// SysTick-VAL sub-ms modeling gap, engine-owner territory). Same P4
// fine-stepping design as the green F1 cell; blocked on guest time
// resolution, not on delivery.
const TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'F401', type: 'openhw-stm32f401', id: 'f401' },
  { tag: 'F411', type: 'openhw-stm32f411', id: 'f411' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
  { tag: 'F429', type: 'openhw-stm32f429', id: 'f429' },
];

const CODE = '#include <DHT.h>\n#define DHTPIN PB0\n#define DHTTYPE DHT22\nDHT dht(DHTPIN, DHTTYPE);\nvoid setup(){Serial.begin(9600);Serial.println("DHT_READY");dht.begin();}\nvoid loop(){float h=dht.readHumidity();float t=dht.readTemperature();Serial.print("DHT_READ DHT_T:");Serial.print(t);Serial.print(" DHT_H:");Serial.println(h);delay(2000);}\n';

test.describe('F4 DHT22 (STAGED, needs P4 fine-stepping)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type, id } of TYPES) {
    test(`reads DHT22 temp + humidity (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
          { id: 'dht1', type: 'openhw-dht22', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: `${i}:PB0`, to: 'dht1:DATA' },
          { from: `${i}:3V3`, to: 'dht1:VCC' },
          { from: `${i}:GND.1`, to: 'dht1:GND' },
        ],
        code,
      }), { t: type, i: id, code: CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 30000, selectTelemetry: ['dht1'], serialNeedle: 'DHT_READ', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}DHT verdict:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}DHT serial head:`, (verdict.serial || '').slice(0, 300));
      expect(verdict.pass).toBe(true);
      const m = /DHT_T:([0-9.\-]+) DHT_H:([0-9.\-]+)/.exec(verdict.serial || '');
      console.log(`${tag}DHT values:`, m ? m.slice(1) : 'NONE');
      expect(m).toBeTruthy();
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
