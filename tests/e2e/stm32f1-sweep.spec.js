import { test, expect } from '@playwright/test';

// F1 board-variant sweep (live): the tightened MAX7219 SPI cell runs once
// per F1 board type. Shared runner mechanism; variants differ in pin maps
// (all expose PA4/PA5/PA7 + 3V3/GND) and compile FQBN (per-type resolve).
// Launched per-variant (-g) in parallel shells; serially green each.
const VARIANTS = [
  'openhw-stm32-bluepill',
  'openhw-stm32f103cb',
  'openhw-stm32f103rc',
  'openhw-stm32-gd32f103c8',
  'openhw-stm32-gd32f103cb',
  'openhw-stm32-gd32f103rb',
  'openhw-stm32-maple-mini',
  'openhw-stm32-nucleo-f103rb',
];

const CODE = '#include <SPI.h>\nvoid wr(uint8_t r,uint8_t d){digitalWrite(PA4,LOW);SPI.transfer(r);SPI.transfer(d);digitalWrite(PA4,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("SWEEP_READY");SPI.begin();pinMode(PA4,OUTPUT);wr(0x0C,0x01);wr(0x0A,0x08);wr(0x0B,0x07);wr(0x01,0x7E);wr(0x02,0x30);Serial.println("SWEEP_DRAWN");}\nvoid loop(){Serial.println("SWEEP_TICK");delay(1000);}\n';

test.describe('F1 SPI variant sweep (MAX7219)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const type of VARIANTS) {
    test(`F1-SPI sweep (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'bp1', type: t, attrs: {}, x: 100, y: 100 },
          { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'bp1:PA7', to: 'mx1:DIN' },
          { from: 'bp1:PA5', to: 'mx1:CLK' },
          { from: 'bp1:PA4', to: 'mx1:CS' },
          { from: 'bp1:3V3.1', to: 'mx1:VCC' },
          { from: 'bp1:GND.1', to: 'mx1:GND' },
        ],
        code,
      }), { t: type, code: CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, selectTelemetry: ['mx1'], serialNeedle: 'SWEEP_DRAWN', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`SWEEP ${type}:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
      expect(mx).toBeTruthy();
      const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
      console.log(`SWEEP ${type} matrix:`, JSON.stringify(custom.matrix || null), 'shutdown:', custom.shutdown);
      expect(custom.shutdown).toBe(false);
      expect(custom.matrix?.[0]).toBe(0x7E);
      expect(custom.matrix?.[1]).toBe(0x30);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
