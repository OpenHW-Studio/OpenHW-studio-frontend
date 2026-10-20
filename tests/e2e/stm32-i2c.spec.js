import { test, expect } from '@playwright/test';

// STM32 I2C matrix cells (live): Blue Pill (F1) + Disco F407 (F4) driving
// SSD1306 OLED and LCD2004 backpack over hardware I2C1 (PB7/PB6).
// Same assert shapes as the AVR/Pico I2C rows.
test.describe('STM32 I2C (bluepill + disco)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/F4 I2C DIAG|F1 I2C DIAG|F4 DEVICES|F4 PC DIAG/i.test(t)) console.log('CAPTURED-DIAG:', t.slice(0, 300));
      } catch { /* ignore */ }
    });
  });

  test('Blue Pill SSD1306 draws via I2C1', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
      ],
      wires: [
        { from: 'bp1:PB7', to: 'oled1:SDA' },
        { from: 'bp1:PB6', to: 'oled1:SCL' },
        { from: 'bp1:SWD_3V3', to: 'oled1:VCC' },
        { from: 'bp1:SWD_GND', to: 'oled1:GND' },
      ],
      code: '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d(128,64,&Wire,-1);\nvoid setup(){Serial.begin(9600);Serial.println("F1_OLED_READY");delay(500);Serial.println("F1_OLED_READY2");Wire.begin();d.begin(SSD1306_SWITCHCAPVCC,0x3C);d.clearDisplay();d.setTextSize(2);d.setTextColor(SSD1306_WHITE);d.setCursor(0,0);d.println("HiF1");d.display();Serial.println("F1_OLED_DRAWN");}\nvoid loop(){Serial.println("F1_OLED_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['oled1'], serialNeedle: 'F1_OLED_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1-OLED reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F1-OLED serial:', JSON.stringify((verdict.serial || '').slice(0, 200)));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('F1_OLED_DRAWN');
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('F1-OLED vramFill:', ocustom.vramFillPercentage, 'power:', ocustom.powerStatus);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Blue Pill LCD2004 prints via I2C1', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
        { id: 'lcd1', type: 'openhw-lcd2004-i2c', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'bp1:PB7', to: 'lcd1:SDA' },
        { from: 'bp1:PB6', to: 'lcd1:SCL' },
        { from: 'bp1:SWD_3V3', to: 'lcd1:VCC' },
        { from: 'bp1:SWD_GND', to: 'lcd1:GND' },
      ],
      code: '#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27,20,4);\nvoid setup(){Serial.begin(9600);Serial.println("F1_LCD_READY");delay(500);Serial.println("F1_LCD_READY2");Wire.begin();lcd.init();lcd.backlight();lcd.setCursor(0,0);lcd.print("Hello");lcd.setCursor(0,1);lcd.print("F1");}\nvoid loop(){Serial.println("F1_LCD_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['lcd1'], serialNeedle: 'F1_LCD_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1-LCD reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const lcd = (verdict.telemetry || []).find((t) => t.id === 'lcd1');
    expect(lcd).toBeTruthy();
    const lcdLines = (((verdict.liveOop || {}).lcd1 || {}).lines || []).join('\n');
    console.log('F1-LCD liveOop lines:', JSON.stringify(lcdLines.slice(0, 60)));
    expect(lcdLines.includes('Hello')).toBe(true);
    expect(lcdLines.includes('F1')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Disco F407 SSD1306 draws via I2C1', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f41', type: 'openhw-stm32f4', attrs: {}, x: 100, y: 100 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
      ],
      wires: [
        { from: 'f41:PB7', to: 'oled1:SDA' },
        { from: 'f41:PB6', to: 'oled1:SCL' },
        { from: 'f41:3V3', to: 'oled1:VCC' },
        { from: 'f41:SWD_GND', to: 'oled1:GND' },
      ],
      code: '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d(128,64,&Wire,-1);\nvoid setup(){Serial.begin(9600);Serial.println("F4_OLED_READY");delay(500);Serial.println("F4_OLED_READY2");Serial.println("M_WIRE_BEGIN");Wire.begin();Serial.println("M_WIRE_DONE");Serial.println("M_MANUAL");Wire.beginTransmission(0x3C);Wire.write(0x00);Wire.write(0xAE);int e=Wire.endTransmission();Serial.print("M_MANUAL_END:");Serial.println(e);Serial.println("M_DBEGIN");bool ok=d.begin(SSD1306_SWITCHCAPVCC,0x3C);Serial.print("M_DBEGIN_DONE:");Serial.println(ok?1:0);d.clearDisplay();d.setTextSize(2);d.setTextColor(SSD1306_WHITE);d.setCursor(0,0);d.println("HiF4");Serial.println("M_PREDRAW");d.display();Serial.println("F4_OLED_DRAWN");}\nvoid loop(){Serial.println("F4_OLED_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 24000, selectTelemetry: ['oled1'], serialNeedle: 'F4_OLED_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F4-OLED reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F4-OLED serial:', JSON.stringify((verdict.serial || '').slice(0, 200)));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('F4_OLED_DRAWN');
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('F4-OLED vramFill:', ocustom.vramFillPercentage, 'power:', ocustom.powerStatus);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
