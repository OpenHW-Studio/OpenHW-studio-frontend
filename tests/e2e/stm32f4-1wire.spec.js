import { test, expect } from '@playwright/test';

// F4 DHT22 single-wire (all five chips) — NO-GO, ENGINE-SIDE (2026-10-20,
// lane/f4-cov re-confirmed on the F407 disco, gap pinned to one register).
//
// THE GAP: `SysTick->VAL` (0xE000E018) is not modelled as a free-running
// down-counter. The engine latched a toggle and returned LOAD on even
// reads, CVR (0) on odd reads. The STM32duino core derives the
// sub-millisecond part of `micros()` from exactly that register
// (getCurrentMicros(), libraries/SrcWrapper/src/stm32/clock.c), so
// `micros()` degenerated into a 1ms-quantised clock. Measured on the
// deployed engine bytes (F407, DISCO core):
//     SysTick->LOAD            = 167999   (168MHz/1000-1 — correct)
//     SysTick->VAL x8          = 0,167999,0,167999,0,167999,0,167999
//     micros() - micros()      = 0
//     micros() over delayMicroseconds(500) = 0
// A DHT22 slot is 26us low / 70us high — the guest cannot resolve it, so
// the library returns NaN on every F4 chip. Runner-side delivery is fine
// (ODR-drive WAKE feed + per-20K-chunk polling + 512-instr fine slicing
// all engage — isTransactionActive goes live): the blocker is the guest's
// time resolution, not the wire.
//
// FIX (delivered, not applied — the engine repo is read-only here):
// patches/f4-systick-val-downcounter.patch + patches/README-f4-systick-val.md
// model VAL as LOAD - (instructions since the last tick), which makes
// micros() exact in guest time. Re-run this spec after the owner applies
// it; the needle below is what the cell expects.
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
