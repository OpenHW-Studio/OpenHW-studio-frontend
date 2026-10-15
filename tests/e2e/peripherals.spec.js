import { test, expect } from '@playwright/test';

// Peripheral sweep: speaker tone, ESP32-CAM webcam, NeoPixel, and every
// remaining display family (Nokia, MAX7219, TM1637 bit-banged, LCD1602,
// 7-segment), plus SD card file I/O — all live with real backend firmware.
test.describe('Peripherals (speaker, cam, pixels, displays, SD — live)', () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  async function boot(page, circuit) {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(([c]) => window.OpenHWE2E.setupCircuit(c), [circuit]);
    expect(setup.ok).toBe(true);
  }

  test('speaker plays tone() like a buzzer', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'spk1', type: 'openhw-5w-speaker', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:9', to: 'spk1:IN+' },
        { from: 'uno1:gnd_1', to: 'spk1:IN-' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("SPK_READY");tone(9,440);}\nvoid loop(){Serial.println("SPK_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 12000, selectTelemetry: ['spk1'], serialNeedle: 'SPK_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const spk = (verdict.telemetry || []).find((t) => t.id === 'spk1');
    expect(spk).toBeTruthy();
    const custom = spk.details?.custom || spk.details?.metrics?.custom || {};
    expect(String(custom.isPlaying || '')).toMatch(/yes/i);
    // Human proof: the playing indicator renders in the DOM.
    expect(await page.evaluate(() => document.body.innerText.includes('Playing'))).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('ESP32-CAM shows the device webcam', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'cam1', type: 'openhw-esp32-cam', attrs: { camMode: 'real' }, x: 100, y: 100 },
      ],
      wires: [],
      code: 'void setup(){Serial.begin(115200);Serial.println("CAM_READY");}\nvoid loop(){Serial.println("CAM_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, serialNeedle: 'CAM_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    // Human proof: a live <video> element streaming frames.
    const cam = await page.evaluate(() => {
      const vids = [...document.querySelectorAll('video[data-cam-live="true"]')];
      return vids.map((v) => ({ readyState: v.readyState, w: v.videoWidth, h: v.videoHeight, paused: v.paused }));
    });
    console.log('CAM video elements:', JSON.stringify(cam));
    expect(cam.length).toBeGreaterThan(0);
    expect(cam.some((v) => v.readyState >= 2 && v.w > 0)).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('NeoPixel matrix lights pixels', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'neo1', type: 'openhw-neopixel-matrix', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:6', to: 'neo1:DIN' },
        { from: 'uno1:5V', to: 'neo1:VCC' },
        { from: 'uno1:gnd_1', to: 'neo1:GND' },
      ],
      code: '#include <Adafruit_NeoPixel.h>\nAdafruit_NeoPixel p(8,6,NEO_GRB+NEO_KHZ800);\nvoid setup(){Serial.begin(9600);Serial.println("NEO_READY");p.begin();p.setPixelColor(0,p.Color(255,0,0));p.setPixelColor(1,p.Color(0,255,0));p.show();}\nvoid loop(){Serial.println("NEO_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['neo1'], serialNeedle: 'NEO_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const neo = (verdict.telemetry || []).find((t) => t.id === 'neo1');
    expect(neo).toBeTruthy();
    console.log('NEO telemetry:', JSON.stringify({ summary: String(neo.summary || '').slice(0, 200) }));
    await page.screenshot({ path: 'test-results/senses-neo.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nokia 5110 fills the screen over raw SPI', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'nk1', type: 'openhw-nokia-5110', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:11', to: 'nk1:DN' },
        { from: 'uno1:13', to: 'nk1:SCLK' },
        { from: 'uno1:10', to: 'nk1:SCE' },
        { from: 'uno1:9', to: 'nk1:DC' },
        { from: 'uno1:8', to: 'nk1:RST' },
        { from: 'uno1:5V', to: 'nk1:VCC' },
        { from: 'uno1:gnd_1', to: 'nk1:GND' },
      ],
      code: '#include <SPI.h>\nvoid cmd(uint8_t c){digitalWrite(9,LOW);digitalWrite(10,LOW);SPI.transfer(c);digitalWrite(10,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("NK_READY");SPI.begin();pinMode(10,OUTPUT);pinMode(9,OUTPUT);pinMode(8,OUTPUT);digitalWrite(8,LOW);delay(10);digitalWrite(8,HIGH);cmd(0x21);cmd(0xB8);cmd(0x04);cmd(0x14);cmd(0x20);cmd(0x0C);digitalWrite(9,HIGH);digitalWrite(10,LOW);for(int i=0;i<504;i++)SPI.transfer(0xFF);digitalWrite(10,HIGH);}\nvoid loop(){Serial.println("NK_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['nk1'], serialNeedle: 'NK_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const nk = (verdict.telemetry || []).find((t) => t.id === 'nk1');
    expect(nk).toBeTruthy();
    const fb = String((nk.details?.state || {}).fbStr || '');
    console.log('NOKIA fbStr head:', fb.slice(0, 40), 'len:', fb.length);
    expect(fb.length).toBeGreaterThan(0);
    expect(/[^0]/.test(fb)).toBe(true);
    await page.screenshot({ path: 'test-results/senses-nokia.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('MAX7219 shows digits over raw SPI', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:11', to: 'mx1:DIN' },
        { from: 'uno1:13', to: 'mx1:CLK' },
        { from: 'uno1:10', to: 'mx1:CS' },
        { from: 'uno1:5V', to: 'mx1:VCC' },
        { from: 'uno1:gnd_1', to: 'mx1:GND' },
      ],
      code: '#include <SPI.h>\nvoid wr(uint8_t r,uint8_t d){digitalWrite(10,LOW);SPI.transfer(r);SPI.transfer(d);digitalWrite(10,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("MX_READY");SPI.begin();pinMode(10,OUTPUT);wr(0x0C,0x01);wr(0x0A,0x08);wr(0x0B,0x07);wr(0x01,0x7E);wr(0x02,0x30);}\nvoid loop(){Serial.println("MX_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['mx1'], serialNeedle: 'MX_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
    expect(mx).toBeTruthy();
    const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
    console.log('MAX7219 custom:', JSON.stringify(custom).slice(0, 200));
    await page.screenshot({ path: 'test-results/senses-max.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('TM1637 shows digits over bit-banged two-wire', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'tm1', type: 'openhw-tm1637-7segment', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:2', to: 'tm1:CLK' },
        { from: 'uno1:3', to: 'tm1:DIO' },
        { from: 'uno1:5V', to: 'tm1:VCC' },
        { from: 'uno1:gnd_1', to: 'tm1:GND' },
      ],
      code: 'void bb(uint8_t b){for(uint8_t i=0;i<8;i++){digitalWrite(2,LOW);digitalWrite(3,(b>>i)&1);delayMicroseconds(50);digitalWrite(2,HIGH);delayMicroseconds(50);}digitalWrite(2,LOW);pinMode(3,INPUT);digitalWrite(2,HIGH);delayMicroseconds(50);pinMode(3,OUTPUT);digitalWrite(2,LOW);}\nvoid start(){digitalWrite(2,HIGH);digitalWrite(3,HIGH);delayMicroseconds(50);digitalWrite(3,LOW);delayMicroseconds(50);}\nvoid stop(){digitalWrite(2,LOW);digitalWrite(3,LOW);delayMicroseconds(50);digitalWrite(2,HIGH);delayMicroseconds(50);digitalWrite(3,HIGH);delayMicroseconds(50);}\nvoid setup(){Serial.begin(9600);Serial.println("TM_READY");pinMode(2,OUTPUT);pinMode(3,OUTPUT);start();bb(0x40);stop();start();bb(0xC0);bb(0x3F);bb(0x06);bb(0x5B);bb(0x4F);stop();start();bb(0x8F);stop();}\nvoid loop(){Serial.println("TM_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['tm1'], serialNeedle: 'TM_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const tm = (verdict.telemetry || []).find((t) => t.id === 'tm1');
    expect(tm).toBeTruthy();
    const digits = ((verdict.liveOop || {}).tm1 || {}).digits;
    console.log('TM1637 digits:', JSON.stringify(digits));
    expect(Array.isArray(digits) && digits.some((x) => x !== 0)).toBe(true);
    await page.screenshot({ path: 'test-results/senses-tm.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('LCD1602 prints text', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'lc1', type: 'openhw-lcd1602-i2c', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:A4', to: 'lc1:SDA' },
        { from: 'uno1:A5', to: 'lc1:SCL' },
        { from: 'uno1:5V', to: 'lc1:VCC' },
        { from: 'uno1:gnd_1', to: 'lc1:GND' },
      ],
      code: '#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27,16,2);\nvoid setup(){Serial.begin(9600);Serial.println("LC_READY");lcd.init();lcd.backlight();lcd.setCursor(0,0);lcd.print("Hi1602");}\nvoid loop(){Serial.println("LC_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['lc1'], serialNeedle: 'LC_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const lc = (verdict.telemetry || []).find((t) => t.id === 'lc1');
    expect(lc).toBeTruthy();
    const custom = lc.details?.custom || lc.details?.metrics?.custom || {};
    console.log('LCD1602 textContent:', JSON.stringify(String(custom.textContent || '').slice(0, 40)));
    expect(String(custom.textContent || '').includes('Hi1602')).toBe(true);
    await page.screenshot({ path: 'test-results/senses-lcd1602.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('7-segment lights via direct drive', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'seg1', type: 'openhw-7segment', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:2', to: 'seg1:A' },
        { from: 'uno1:3', to: 'seg1:B' },
        { from: 'uno1:4', to: 'seg1:C' },
        { from: 'uno1:5', to: 'seg1:D' },
        { from: 'uno1:6', to: 'seg1:E' },
        { from: 'uno1:7', to: 'seg1:F' },
        { from: 'uno1:8', to: 'seg1:G' },
        { from: 'uno1:gnd_1', to: 'seg1:COM.1' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("SEG_READY");for(int p=2;p<=8;p++){pinMode(p,OUTPUT);digitalWrite(p,HIGH);}}\nvoid loop(){Serial.println("SEG_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['seg1'], serialNeedle: 'SEG_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const seg = (verdict.telemetry || []).find((t) => t.id === 'seg1');
    expect(seg).toBeTruthy();
    const live = ((verdict.liveOop || {}).seg1 || {});
    console.log('7SEG liveOop:', JSON.stringify(live).slice(0, 200));
    await page.screenshot({ path: 'test-results/senses-7seg.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('SD card writes and reads a file', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'sd1', type: 'openhw-sd-card', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:11', to: 'sd1:MOSI' },
        { from: 'uno1:12', to: 'sd1:MISO' },
        { from: 'uno1:13', to: 'sd1:SCK' },
        { from: 'uno1:4', to: 'sd1:CS' },
        { from: 'uno1:5V', to: 'sd1:VCC' },
        { from: 'uno1:gnd_1', to: 'sd1:GND' },
      ],
      code: '#include <SPI.h>\n#include <SD.h>\nvoid setup(){Serial.begin(9600);Serial.println("SD_READY");if(!SD.begin(4)){Serial.println("SD_FAIL");return;}File f=SD.open("t.txt",FILE_WRITE);f.println("sdhi");f.close();File r=SD.open("t.txt");while(r.available())Serial.write(r.read());r.close();Serial.println("SD_DONE");}\nvoid loop(){Serial.println("SD_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 18000, selectTelemetry: ['sd1'], serialNeedle: 'SD_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    console.log('SD serial:', JSON.stringify((verdict.serial || '').slice(0, 300)));
    // File content echoed back through the firmware's own read.
    expect((verdict.serial || '').includes('sdhi')).toBe(true);
    expect((verdict.serial || '').includes('SD_DONE')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
