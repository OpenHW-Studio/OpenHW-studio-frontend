import { test, expect } from '@playwright/test';

// GD32 bring-up: ADC/PWM/GPIO-in trio for all three GD32 board types.
// Verbatim mirror of the stm32f1-maple-cb trio (same F103-class silicon,
// same stm32f1-runner ADC inject / TIM observe / GPIO paths, identical pin
// shells: PA0 pot at mid-scale, PA8 PWM LED at 75% duty, PB0->3V3.1 /
// PB1->GND.1 static reads). Board ids/pins only; no runner changes.
const TYPES = [
  { tag: 'GC8', type: 'openhw-stm32-gd32f103c8' },
  { tag: 'GCB', type: 'openhw-stm32-gd32f103cb' },
  { tag: 'GRB', type: 'openhw-stm32-gd32f103rb' },
];

const ADC_CODE = (tag) =>
  `void setup(){Serial.begin(9600);Serial.println("${tag}ADC_READY");analogReadResolution(12);}\nvoid loop(){int v=analogRead(PA0);Serial.print("${tag}ADC_VAL:");Serial.println(v);delay(500);}\n`;

const PWM_CODE = (tag) =>
  `void setup(){Serial.begin(9600);Serial.println("${tag}PWM_READY");analogWrite(PA8,192);Serial.println("${tag}PWM_SET");}\nvoid loop(){Serial.println("${tag}PWM_TICK");delay(1000);}\n`;

const GPIOIN_CODE = (tag) =>
  `void setup(){Serial.begin(9600);Serial.println("${tag}GPIOIN_READY");pinMode(PB0,INPUT);pinMode(PB1,INPUT);}\nvoid loop(){Serial.print("PB0=");Serial.print(digitalRead(PB0));Serial.print(" PB1=");Serial.println(digitalRead(PB1));delay(500);}\n`;

test.describe('GD32 ADC/PWM/GPIO-in trio (live)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type } of TYPES) {
    test(`analogRead tracks the pot wiper (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'gd1', type: t, attrs: {}, x: 100, y: 100 },
          { id: 'pot1', type: 'openhw-potentiometer', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'gd1:PA0', to: 'pot1:SIG' },
          { from: 'gd1:3V3.1', to: 'pot1:1' },
          { from: 'gd1:GND.1', to: 'pot1:2' },
        ],
        code,
      }), { t: type, code: ADC_CODE(tag) });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate((needle) => window.OpenHWE2E.run({
        forMs: 20000, selectTelemetry: ['pot1'], serialNeedle: needle, telemetryMode: 'detail',
      }), `${tag}ADC_VAL:`);
      expect(verdict.ok).toBe(true);
      console.log(`${tag}ADC reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}ADC serial:`, JSON.stringify((verdict.serial || '').slice(-300)));
      expect(verdict.pass).toBe(true);
      const re = new RegExp(`${tag}ADC_VAL:(\\d+)`, 'g');
      const vals = [...(verdict.serial || '').matchAll(re)].map((m) => Number(m[1]));
      console.log(`${tag}ADC values:`, JSON.stringify(vals.slice(0, 8)));
      expect(vals.length).toBeGreaterThan(0);
      // 50% of 3V3 at 12-bit = 2048; drop the startup transient.
      const settled = vals.slice(4);
      expect(settled.length).toBeGreaterThan(0);
      for (const v of settled) expect(Math.abs(v - 2048)).toBeLessThan(500);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`LED brightness tracks analogWrite duty (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'gd1', type: t, attrs: {}, x: 100, y: 100 },
          { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'gd1:PA8', to: 'led1:A' },
          { from: 'gd1:GND.1', to: 'led1:K' },
        ],
        code,
      }), { t: type, code: PWM_CODE(tag) });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate((needle) => window.OpenHWE2E.run({
        forMs: 20000, selectTelemetry: ['led1'], serialNeedle: needle, telemetryMode: 'detail',
      }), `${tag}PWM_SET`);
      expect(verdict.ok).toBe(true);
      console.log(`${tag}PWM reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
      expect(led).toBeTruthy();
      const lcustom = led.details?.custom || led.details?.metrics?.custom || {};
      console.log(`${tag}PWM led:`, JSON.stringify(lcustom).slice(0, 200));
      // PWM-driven (not DC): status dim + glow, with zero DC current.
      expect(lcustom.status).toBe('dim');
      expect(lcustom.glow).toBe(true);
      expect(lcustom.current).toBe('0.00 mA');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`reads wired HIGH and LOW (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'gd1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [
          { from: 'gd1:3V3.1', to: 'gd1:PB0' },
          { from: 'gd1:GND.1', to: 'gd1:PB1' },
        ],
        code,
      }), { t: type, code: GPIOIN_CODE(tag) });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate((needle) => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: needle, telemetryMode: 'detail',
      }), `${tag}GPIOIN_READY`);
      expect(verdict.ok).toBe(true);
      console.log(`${tag}GPIOIN verdict:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}GPIOIN serial:`, (verdict.serial || '').slice(0, 300));
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain('PB0=1');
      expect(verdict.serial || '').toContain('PB1=0');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
