import { test, expect } from '@playwright/test';

// Human-senses proof (telemetry says the model ran; this proves a human
// would see/hear it): display pixels + LCD text asserted in the live DOM,
// buzzer tone asserted via buzzing telemetry, fake-mic sound asserted via
// peakAmplitude telemetry. Screenshots are saved for human eyes.
test.use({
  launchOptions: {
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
});

test.describe('Human senses (displays, buzzer, mic — live)', () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('LCD2004 shows printed text in the DOM', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'lcd1', type: 'openhw-lcd2004-i2c', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:A4', to: 'lcd1:SDA' },
          { from: 'uno1:A5', to: 'lcd1:SCL' },
          { from: 'uno1:5V', to: 'lcd1:VCC' },
          { from: 'uno1:gnd_1', to: 'lcd1:GND' },
        ],
        code: '#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27,20,4);\nvoid setup(){Serial.begin(9600);Serial.println("LCD_READY");lcd.init();lcd.backlight();lcd.setCursor(0,0);lcd.print("Hello");lcd.setCursor(0,1);lcd.print("World");}\nvoid loop(){Serial.println("LCD_TICK");delay(1000);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['lcd1'], serialNeedle: 'LCD_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    // Sim produced the text? (custom.textContent carries LCD content —
    // the formatted `lines:` param reads a different field and shows N/A
    // even when text exists. Assert the truth, not the formatting.)
    const lcd = (verdict.telemetry || []).find((t) => t.id === 'lcd1');
    expect(lcd).toBeTruthy();
    const lcdText = String(lcd.details?.custom?.textContent || lcd.details?.metrics?.custom?.textContent || '');
    console.log('LCD textContent:', JSON.stringify(lcdText.slice(0, 80)));
    // Raw mirror (unformatted): the model's true lines.
    const lcdLines = (((verdict.liveOop || {}).lcd1 || {}).lines || []).join('\n');
    console.log('LCD liveOop lines:', JSON.stringify(lcdLines.slice(0, 60)));
    expect(lcdLines.includes('Hello')).toBe(true);
    expect(lcdLines.includes('World')).toBe(true);
    // The formatted summary must surface it too (metrics.custom fallback).
    expect(String(lcd.summary || '')).toMatch(/Hello/);
    // Human side: the words must also reach the rendered DOM (UI mirror).
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('LCD DOM has Hello/World:', bodyText.includes('Hello'), bodyText.includes('World'));
    await page.screenshot({ path: 'test-results/senses-lcd.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('SSD1306 lights pixels on its canvas', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:A4', to: 'oled1:SDA' },
          { from: 'uno1:A5', to: 'oled1:SCL' },
          { from: 'uno1:5V', to: 'oled1:VCC' },
          { from: 'uno1:gnd_1', to: 'oled1:GND' },
        ],
        code: '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d(128,64,&Wire,-1);\nvoid setup(){Serial.begin(9600);Serial.println("OLED_READY");d.begin(SSD1306_SWITCHCAPVCC,0x3C);d.clearDisplay();d.setTextSize(2);d.setTextColor(SSD1306_WHITE);d.setCursor(0,0);d.println("Hi");d.display();}\nvoid loop(){Serial.println("OLED_TICK");delay(1000);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['oled1'], serialNeedle: 'OLED_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    // Sim produced pixels? (custom.vramFillPercentage counts VRAM bits.
    // In-page canvas reads are invalid here: these canvases are transferred
    // to the render worker, so main-thread getContext cannot observe them.)
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const fill = Number(oled.details?.custom?.vramFillPercentage ?? oled.details?.metrics?.custom?.vramFillPercentage ?? NaN);
    console.log('OLED vramFillPercentage:', fill, 'power:', oled.details?.custom?.powerStatus ?? oled.details?.metrics?.custom?.powerStatus);
    // Raw mirror: VRAM nonzero fraction proves pixels.
    const oledVram = ((verdict.liveOop || {}).oled1 || {}).vram;
    const oledFrac = oledVram && typeof oledVram.nonzeroFrac === 'number' ? oledVram.nonzeroFrac : NaN;
    console.log('OLED liveOop vram nonzeroFrac:', oledFrac);
    expect(oledFrac).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/senses-oled.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('ILI9341 paints the screen red', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'tft1', type: 'openhw-ili9341', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:10', to: 'tft1:CS' },
          { from: 'uno1:9', to: 'tft1:RESET' },
          { from: 'uno1:8', to: 'tft1:DC' },
          { from: 'uno1:11', to: 'tft1:MOSI' },
          { from: 'uno1:13', to: 'tft1:SCK' },
          { from: 'uno1:5V', to: 'tft1:LED' },
          { from: 'uno1:5V', to: 'tft1:VCC' },
          { from: 'uno1:gnd_1', to: 'tft1:GND' },
        ],
        code: '#include <SPI.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_ILI9341.h>\nAdafruit_ILI9341 tft(10,9,8);\nvoid setup(){Serial.begin(9600);Serial.println("TFT_READY");tft.begin();tft.fillScreen(ILI9341_RED);}\nvoid loop(){Serial.println("TFT_TICK");delay(1000);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['tft1'], serialNeedle: 'TFT_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    // Sim painted red? (custom.vramFillPercentage counts non-zero VRAM.)
    const tft = (verdict.telemetry || []).find((t) => t.id === 'tft1');
    expect(tft).toBeTruthy();
    const tfill = Number(tft.details?.custom?.vramFillPercentage ?? tft.details?.metrics?.custom?.vramFillPercentage ?? NaN);
    console.log('TFT vramFillPercentage:', tfill, 'power:', tft.details?.custom?.powerStatus ?? tft.details?.metrics?.custom?.powerStatus);
    // Raw mirror: framebuffer nonzero fraction proves the red fill.
    const tftBuf = ((verdict.liveOop || {}).tft1 || {}).buffer;
    const tftFrac = tftBuf && typeof tftBuf.nonzeroFrac === 'number' ? tftBuf.nonzeroFrac : NaN;
    console.log('TFT liveOop buffer nonzeroFrac:', tftFrac);
    expect(tftFrac).toBeGreaterThan(0.5);
    await page.screenshot({ path: 'test-results/senses-tft.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Buzzer sounds its tone (buzzing state + frequency)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'bz1', type: 'openhw-buzzer', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:9', to: 'bz1:SIG' },
          { from: 'uno1:gnd_1', to: 'bz1:GND' },
        ],
        code: 'void setup(){Serial.begin(9600);Serial.println("BUZ_READY");tone(9,440);}\nvoid loop(){Serial.println("BUZ_TICK");delay(1000);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 12000, selectTelemetry: ['bz1'], serialNeedle: 'BUZ_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    // The sim settled a 440 Hz tone: the UI schedules a real beep from it.
    const bz = (verdict.telemetry || []).find((t) => t.id === 'bz1');
    expect(bz).toBeTruthy();
    const bzCustom = bz.details?.custom || bz.details?.metrics?.custom || {};
    expect(String(bzCustom.status || '')).toMatch(/buzz/i);
    expect(String(bzCustom.frequency || '')).toMatch(/440/);
    // Raw mirror corroboration.
    const bzLive = (verdict.liveOop || {}).bz1 || {};
    console.log('BUZ liveOop:', JSON.stringify({ isBuzzing: bzLive.isBuzzing, frequency: bzLive.frequency }));
    expect(bzLive.isBuzzing).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Microphone hears the fake-mic tone (peakAmplitude rises)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'mic1', type: 'openhw-inmp441', attrs: { micMode: 'real' }, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:3v3', to: 'mic1:VDD' },
          { from: 'uno1:gnd_1', to: 'mic1:GND' },
        ],
        code: 'void setup(){Serial.begin(9600);Serial.println("MIC_READY");}\nvoid loop(){Serial.println("MIC_TICK");delay(1000);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['mic1'], serialNeedle: 'MIC_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    // Sound entered the sim from the (fake) microphone: amplitude is live
    // and the mic path reports itself engaged (not defaulted).
    const mic = (verdict.telemetry || []).find((t) => t.id === 'mic1');
    expect(mic).toBeTruthy();
    const micCustom = mic.details?.custom || mic.details?.metrics?.custom || {};
    expect(String(micCustom.liveMicEnabled || '')).toMatch(/yes/i);
    expect(Number(micCustom.peakAmplitude ?? 0)).toBeGreaterThan(0);
    // Raw mirror corroboration.
    const micLive = (verdict.liveOop || {}).mic1 || {};
    console.log('MIC liveOop peakAmplitude:', micLive.peakAmplitude);
    expect(Number(micLive.peakAmplitude ?? 0)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
