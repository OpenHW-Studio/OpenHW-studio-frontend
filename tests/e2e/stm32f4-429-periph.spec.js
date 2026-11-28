import { test, expect } from '@playwright/test';

// F429 peripheral trio (openhw-stm32f429) — narrow claims, one board type,
// sequential phases, one serial needle per phase. No runner changes: every
// phase rides a path already proven live on sibling F4 boards through the
// shared stm32f4-runner (chip stm32f429: dac/rng/crc true in the package
// CHIPS table; PA0/PA4/PA5/PA7/PB6/PB7/3V3/GND.1/SWD_GND all exposed):
//   DAC: same analogWrite(PA4)->analogRead(PA0) loopback sketch as
//     stm32f4-dac (F407). DAC DOR readback bridged into ADC nets.
//   I2C: same SSD1306 sketch as the Disco row of stm32-i2c (I2C1 PB7/PB6).
//     Proof is oled vramFillPercentage > 0, not guest serial.
//   SPI: same MAX7219 sketch as stm32f4-spi (SPI1 PA7/PA5, manual CS PA4).
//     Proof is host-observed matrix rows 0x7E/0x30 + shutdown false.
// F429 VARIANT PINOUT (STM32 core 2.12.0 variant_DISCO_F429ZI.h:225-229,
// 214-221): Arduino defaults are Wire=I2C3 (PC9/PA8) and SPI=SPI5
// (PF9/PF8/PF7) — NOT the I2C1/SPI1 the runner taps and the circuit
// wires (PB7/PB6, PA7/PA5/PA4). Both sketches therefore remap with the
// standard STM32duino API (Wire.setSDA/SCL, SPI.setMOSI/MISO/SCLK) to
// I2C1/SPI1 before begin() — real firmware selecting the wired bus,
// same-peripheral moves that are no-ops on the sibling variants.
// Kept as three tests (not one circuit) because PA4 is both the DAC output
// and the SPI manual-CS pin — sharing it would short two drivers.

const DAC_CODE = 'void setup() {\n  Serial.begin(9600);\n  Serial.println("F429DAC_READY");\n  analogWriteResolution(12);\n  analogReadResolution(12);\n}\nvoid loop() {\n  int outs[3] = {0, 2048, 4095};\n  int vals[3];\n  for (int i = 0; i < 3; i++) {\n    analogWrite(PA4, outs[i]);\n    delay(100);\n    vals[i] = analogRead(PA0);\n  }\n  Serial.print("F429DAC_LOOP:");\n  Serial.print(vals[0]); Serial.print(",");\n  Serial.print(vals[1]); Serial.print(",");\n  Serial.println(vals[2]);\n  delay(2000);\n}\n';

const OLED_CODE = '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d(128,64,&Wire,-1);\nvoid setup(){Serial.begin(9600);Serial.println("F429OLED_READY");delay(500);Wire.setSDA(PB7);Wire.setSCL(PB6);Wire.begin();d.begin(SSD1306_SWITCHCAPVCC,0x3C);d.clearDisplay();d.setTextSize(2);d.setTextColor(SSD1306_WHITE);d.setCursor(0,0);d.println("Hi429");d.display();Serial.println("F429OLED_DRAWN");}\nvoid loop(){Serial.println("F429OLED_TICK");delay(1000);}\n';

const SPI_CODE = '#include <SPI.h>\nvoid wr(uint8_t r,uint8_t d){digitalWrite(PA4,LOW);SPI.transfer(r);SPI.transfer(d);digitalWrite(PA4,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("F429SPI_READY");delay(300);SPI.setMOSI(PA7);SPI.setMISO(PA6);SPI.setSCLK(PA5);SPI.begin();pinMode(PA4,OUTPUT);wr(0x0C,0x01);wr(0x0A,0x08);wr(0x0B,0x07);wr(0x01,0x7E);wr(0x02,0x30);Serial.println("F429SPI_DRAWN");}\nvoid loop(){Serial.println("F429SPI_TICK");delay(1000);}\n';

test.describe('F429 peripheral trio (DAC loopback + I2C OLED + SPI MAX7219)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('DAC staircase reads back on ADC through the wire', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f42', type: 'openhw-stm32f429', attrs: {}, x: 100, y: 100 },
      ],
      wires: [
        { from: 'f42:PA4', to: 'f42:PA0' },
      ],
      code,
    }), DAC_CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, serialNeedle: 'F429DAC_LOOP:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F429DAC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F429DAC serial head:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const m = /F429DAC_LOOP:(\d+),(\d+),(\d+)/.exec(verdict.serial || '');
    console.log('F429DAC steps:', m ? m.slice(1) : 'NONE');
    expect(m).toBeTruthy();
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    expect(a).toBeLessThan(400);
    expect(b).toBeGreaterThan(1400);
    expect(b).toBeLessThan(2700);
    expect(c).toBeGreaterThan(3600);
    expect(a < b && b < c).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('SSD1306 draws via I2C1 (vramFill proof)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f42', type: 'openhw-stm32f429', attrs: {}, x: 100, y: 100 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
      ],
      wires: [
        { from: 'f42:PB7', to: 'oled1:SDA' },
        { from: 'f42:PB6', to: 'oled1:SCL' },
        { from: 'f42:3V3', to: 'oled1:VCC' },
        { from: 'f42:SWD_GND', to: 'oled1:GND' },
      ],
      code,
    }), OLED_CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, selectTelemetry: ['oled1'], serialNeedle: 'F429OLED_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F429OLED reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F429OLED serial:', JSON.stringify((verdict.serial || '').slice(0, 200)));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('F429OLED_DRAWN');
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('F429OLED vramFill:', ocustom.vramFillPercentage, 'power:', ocustom.powerStatus);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('MAX7219 shows digits over SPI1 (matrix proof)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f42', type: 'openhw-stm32f429', attrs: {}, x: 100, y: 100 },
        { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'f42:PA7', to: 'mx1:DIN' },
        { from: 'f42:PA5', to: 'mx1:CLK' },
        { from: 'f42:PA4', to: 'mx1:CS' },
        { from: 'f42:3V3', to: 'mx1:VCC' },
        { from: 'f42:GND.1', to: 'mx1:GND' },
      ],
      code,
    }), SPI_CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, selectTelemetry: ['mx1'], serialNeedle: 'F429SPI_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F429SPI reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
    expect(mx).toBeTruthy();
    const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
    console.log('F429-MAX7219 custom:', JSON.stringify(custom).slice(0, 250));
    expect(custom.shutdown).toBe(false);
    expect(custom.matrix?.[0]).toBe(0x7E);
    expect(custom.matrix?.[1]).toBe(0x30);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
