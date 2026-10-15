import { test, expect } from '@playwright/test';

// F4 analog/serial remainder (401 / 411 / 407VE / 429): verbatim ports of
// the four Disco-green sketches — SSD1306 over I2C1 (PB7/PB6, vramFill
// proof), MAX7219 over SPI1 (PA7/PA5/PA4, matrix proof), pot->PA0 ADC
// (12-bit mid-scale proof), and PA6 TIM3_CH1 PWM->LED (glow proof). No
// runner changes: I2C1/SPI1 bridges, setAdcChannel inject, and the TIM3
// buzzer tap are chip-agnostic (all four chips list i2c:[1,2,3],
// spi 1..5, timers incl. TIM3 in the package CHIPS table; every shell
// exposes PA0/PA4/PA5/PA6/PA7/PB6/PB7/3V3/GND.1/SWD_GND).
const TYPES = [
  { tag: 'F401', type: 'openhw-stm32f401', id: 'f401' },
  { tag: 'F411', type: 'openhw-stm32f411', id: 'f411' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
  { tag: 'F429', type: 'openhw-stm32f429', id: 'f429' },
];

const OLED_CODE = '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d(128,64,&Wire,-1);\nvoid setup(){Serial.begin(9600);Serial.println("OLEDI2C_READY");delay(500);Wire.begin();d.begin(SSD1306_SWITCHCAPVCC,0x3C);d.clearDisplay();d.setTextSize(2);d.setTextColor(SSD1306_WHITE);d.setCursor(0,0);d.println("HiF4");d.display();Serial.println("OLEDI2C_DRAWN");}\nvoid loop(){Serial.println("OLEDI2C_TICK");delay(1000);}\n';

const SPI_CODE = '#include <SPI.h>\nvoid wr(uint8_t r,uint8_t d){digitalWrite(PA4,LOW);SPI.transfer(r);SPI.transfer(d);digitalWrite(PA4,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("F4SPI_READY");delay(300);SPI.begin();pinMode(PA4,OUTPUT);wr(0x0C,0x01);wr(0x0A,0x08);wr(0x0B,0x07);wr(0x01,0x7E);wr(0x02,0x30);Serial.println("F4SPI_DRAWN");}\nvoid loop(){Serial.println("F4SPI_TICK");delay(1000);}\n';

const ADC_CODE = 'void setup(){Serial.begin(9600);Serial.println("F4ADC_READY");analogReadResolution(12);}\nvoid loop(){Serial.println("F4ADC_PRE");int v=analogRead(PA0);Serial.print("F4ADC_VAL:");Serial.println(v);Serial.println("F4ADC_POST");delay(500);}\n';

const PWM_CODE = 'void setup(){Serial.begin(9600);Serial.println("F4PWM_READY");analogWrite(PA6,192);Serial.println("F4PWM_SET");}\nvoid loop(){Serial.println("F4PWM_TICK");delay(1000);}\n';

test.describe('F4 analog/serial remainder (I2C/SPI/ADC/PWM ports)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type, id } of TYPES) {
    test(`SSD1306 draws via I2C1 (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
          { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
        ],
        wires: [
          { from: `${i}:PB7`, to: 'oled1:SDA' },
          { from: `${i}:PB6`, to: 'oled1:SCL' },
          { from: `${i}:3V3`, to: 'oled1:VCC' },
          { from: `${i}:SWD_GND`, to: 'oled1:GND' },
        ],
        code,
      }), { t: type, i: id, code: OLED_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 30000, selectTelemetry: ['oled1'], serialNeedle: 'OLEDI2C_DRAWN', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}OLED reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
      expect(oled).toBeTruthy();
      const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
      console.log(`${tag}OLED vramFill:`, ocustom.vramFillPercentage);
      expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`MAX7219 shows digits over SPI1 (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
          { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: `${i}:PA7`, to: 'mx1:DIN' },
          { from: `${i}:PA5`, to: 'mx1:CLK' },
          { from: `${i}:PA4`, to: 'mx1:CS' },
          { from: `${i}:3V3`, to: 'mx1:VCC' },
          { from: `${i}:GND.1`, to: 'mx1:GND' },
        ],
        code,
      }), { t: type, i: id, code: SPI_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 30000, selectTelemetry: ['mx1'], serialNeedle: 'F4SPI_DRAWN', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}SPI reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
      expect(mx).toBeTruthy();
      const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
      expect(custom.shutdown).toBe(false);
      expect(custom.matrix?.[0]).toBe(0x7E);
      expect(custom.matrix?.[1]).toBe(0x30);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`analogRead tracks the pot wiper (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
          { id: 'pot1', type: 'openhw-potentiometer', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: `${i}:PA0`, to: 'pot1:SIG' },
          { from: `${i}:3V3`, to: 'pot1:1' },
          { from: `${i}:GND.1`, to: 'pot1:2' },
        ],
        code,
      }), { t: type, i: id, code: ADC_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 90000, selectTelemetry: ['pot1'], serialNeedle: 'F4ADC_VAL:', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}ADC reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const vals = [...(verdict.serial || '').matchAll(/F4ADC_VAL:(\d+)/g)].map((m) => Number(m[1]));
      console.log(`${tag}ADC values:`, JSON.stringify(vals.slice(0, 8)));
      expect(vals.length).toBeGreaterThan(0);
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
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
          { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: `${i}:PA6`, to: 'led1:A' },
          { from: `${i}:GND.1`, to: 'led1:C' },
        ],
        code,
      }), { t: type, i: id, code: PWM_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 30000, selectTelemetry: ['led1'], serialNeedle: 'F4PWM_SET', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}PWM reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
      expect(led).toBeTruthy();
      const custom = led.details?.custom || led.details?.metrics?.custom || {};
      console.log(`${tag}PWM led:`, JSON.stringify(custom).slice(0, 200));
      expect(custom.glow).toBe(true);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
