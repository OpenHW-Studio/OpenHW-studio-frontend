import { test, expect } from '@playwright/test';

// Pico x I2C matrix cells (live): SSD1306 OLED + LCD2004-I2C backpack on
// hardware I2C0 (GP4/GP5). Same assert shapes as the AVR I2C rows.
test.describe('Pico I2C (OLED + LCD backpack)', () => {
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
        if (/BUSLOG|SDD|VCD|EEPROM|GDBTRAP|PicoRunner GDB|GDBSTAT/i.test(t)) console.log('CAPTURED-BUSLOG:', t.slice(0, 900));
      } catch { /* ignore */ }
    });
  });

  test('SSD1306 OLED draws via Pico I2C0', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'pico1', type: 'openhw-pico', attrs: {}, x: 100, y: 100 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
      ],
      wires: [
        { from: 'pico1:GP4', to: 'oled1:SDA' },
        { from: 'pico1:GP5', to: 'oled1:SCL' },
        { from: 'pico1:3V3', to: 'oled1:VCC' },
        { from: 'pico1:GND', to: 'oled1:GND' },
      ],
      code: '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d(128,64,&Wire,-1);\nvoid setup(){Serial.begin(9600);Serial.println("PICO_OLED_READY");delay(500);Serial.println("PICO_OLED_READY2");Wire.setSDA(4);Wire.setSCL(5);d.begin(SSD1306_SWITCHCAPVCC,0x3C);d.clearDisplay();d.setTextSize(2);d.setTextColor(SSD1306_WHITE);d.setCursor(0,0);d.println("HiPico");d.display();Serial.println("PICO_OLED_DRAWN");}\nvoid loop(){d.clearDisplay();d.setCursor(0,0);d.println(millis());d.display();Serial.println("PICO_OLED_TICK");delay(200);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['oled1'], serialNeedle: 'PICO_OLED_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('PICO-OLED reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('PICO-OLED serial:', JSON.stringify((verdict.serial || '').slice(0, 400)));
    expect(verdict.serial || '').toContain('PICO_OLED_READY2');
    expect(verdict.serial || '').toContain('PICO_OLED_DRAWN');
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('PICO-OLED vramFill:', ocustom.vramFillPercentage, 'power:', ocustom.powerStatus);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('LCD2004 backpack prints via Pico I2C0', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'pico1', type: 'openhw-pico', attrs: {}, x: 100, y: 100 },
        { id: 'lcd1', type: 'openhw-lcd2004-i2c', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'pico1:GP4', to: 'lcd1:SDA' },
        { from: 'pico1:GP5', to: 'lcd1:SCL' },
        { from: 'pico1:3V3', to: 'lcd1:VCC' },
        { from: 'pico1:GND', to: 'lcd1:GND' },
      ],
      code: '#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27,20,4);\nvoid setup(){Serial.begin(9600);Serial.println("PICO_LCD_READY");Wire.setSDA(4);Wire.setSCL(5);lcd.init();lcd.backlight();lcd.setCursor(0,0);lcd.print("Hello");lcd.setCursor(0,1);lcd.print("Pico");}\nvoid loop(){Serial.println("PICO_LCD_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['lcd1'], serialNeedle: 'PICO_LCD_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const lcd = (verdict.telemetry || []).find((t) => t.id === 'lcd1');
    expect(lcd).toBeTruthy();
    const lcdLines = (((verdict.liveOop || {}).lcd1 || {}).lines || []).join('\n');
    console.log('PICO-LCD liveOop lines:', JSON.stringify(lcdLines.slice(0, 60)));
    expect(lcdLines.includes('Hello')).toBe(true);
    expect(lcdLines.includes('Pico')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
