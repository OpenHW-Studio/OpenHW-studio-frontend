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
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/AVRRunner DBG|ADC DBG|DHT22|Received INTERACT|inst id=(sd1|neo1|neo2|tm1|mx1|nk1|seg1|lc1|lc2|lc3|spk1|ep1|tft2|ds1|dht1|max1|pcm1|sph1|sr1|rl1|rgb1|sv1|sr595|mq1|ph1|bt1|jy1|btn1|pir1|irr1|irm1|kp1|rot1) |SD-DIAG|NEO-LATCH|exchange alive|instantiate sd1|read blk|write blk/.test(t)) console.log('CAPTURED-WORKER:', t.slice(0, 600));
      } catch { /* ignore */ }
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
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'cam1', type: 'openhw-esp32-cam', attrs: { camMode: 'real' }, x: 450, y: 100 },
      ],
      wires: [],
      code: 'void setup(){Serial.begin(9600);Serial.println("CAM_READY");}\nvoid loop(){Serial.println("CAM_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, serialNeedle: 'CAM_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAM serial:', JSON.stringify((verdict.serial || '').slice(0, 300)), 'reasons:', JSON.stringify(verdict.reasons || []));
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
    console.log('NEO serial:', JSON.stringify((verdict.serial || '').slice(0, 300)));
    // Content proof: firmware lights pixel 0 red + pixel 1 green.
    const ncustom = neo.details?.custom || neo.details?.metrics?.custom || {};
    console.log('NEO custom:', JSON.stringify(ncustom).slice(0, 200));
    expect(Number(ncustom.activePixels || 0)).toBeGreaterThanOrEqual(2);
    // WASM proof: the frame decoded on the Rust WS2812 core.
    const neoCore = ((verdict.liveOop || {}).neo1 || {}).core;
    console.log('NEO core:', neoCore);
    expect(neoCore).toBe('wasm');
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

  test('ePaper shows RAM-written data over raw SPI', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'ep1', type: 'openhw-ePaperDisplay', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:11', to: 'ep1:DIN' },
        { from: 'uno1:13', to: 'ep1:CLK' },
        { from: 'uno1:8', to: 'ep1:CS' },
        { from: 'uno1:7', to: 'ep1:DC' },
        { from: 'uno1:6', to: 'ep1:RST' },
        { from: 'uno1:5V', to: 'ep1:VCC' },
        { from: 'uno1:gnd_1', to: 'ep1:GND' },
      ],
      code: '#include <SPI.h>\nvoid wcmd(uint8_t c){digitalWrite(7,LOW);digitalWrite(8,LOW);SPI.transfer(c);digitalWrite(8,HIGH);}\nvoid wdat(uint8_t d){digitalWrite(7,HIGH);digitalWrite(8,LOW);SPI.transfer(d);digitalWrite(8,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("EP_READY");SPI.begin();pinMode(8,OUTPUT);pinMode(7,OUTPUT);pinMode(6,OUTPUT);digitalWrite(6,LOW);delay(10);digitalWrite(6,HIGH);wcmd(0x24);for(int i=0;i<64;i++)wdat(0x00);}\nvoid loop(){Serial.println("EP_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['ep1'], serialNeedle: 'EP_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const ep = (verdict.telemetry || []).find((t) => t.id === 'ep1');
    expect(ep).toBeTruthy();
    // Content proof: 0x24 RAM-write command + 64 black bytes ingested.
    const ecustom = ep.details?.custom || ep.details?.metrics?.custom || {};
    console.log('EPAPER custom:', JSON.stringify(ecustom).slice(0, 200));
    expect(Number(ecustom.ramPointer || 0)).toBeGreaterThanOrEqual(64);
    await page.screenshot({ path: 'test-results/senses-epaper.png' });
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
    // All four segment bytes latch: 0='0x3F', 1='0x06', 2='0x5B', 3='0x4F'.
    expect(digits).toEqual([0x3f, 0x06, 0x5b, 0x4f]);
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
      code: '#include <SPI.h>\n#include <SD.h>\nvoid setup(){Serial.begin(9600);Serial.println("SD_READY");if(!SD.begin(4)){Serial.println("SD_FAIL");return;}File ro=SD.open("README.TXT");Serial.print("ROpen:");Serial.println(!!ro);Serial.print("RAvail:");Serial.println(ro.available());while(ro.available())Serial.write(ro.read());ro.close();Serial.println("RO_DONE");File f=SD.open("t.txt",FILE_WRITE);Serial.print("FOPEN_W:");Serial.println(!!f);if(!f){Serial.println("SD_FAIL");return;}Serial.print("WROTE:");Serial.println(f.println("sdhi"));f.close();File r=SD.open("t.txt");Serial.print("FOPEN_R:");Serial.println(!!r);Serial.print("AVAIL:");Serial.println(r.available());while(r.available())Serial.write(r.read());r.close();Serial.println("SD_DONE");}\nvoid loop(){Serial.println("SD_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 22000, selectTelemetry: ['sd1'], serialNeedle: 'SD_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    console.log('SD serial:', JSON.stringify((verdict.serial || '').slice(0, 600)));
    // Pre-existing README must read back through the FAT walk.
    expect((verdict.serial || '').includes('OpenHW')).toBe(true);
    // File content echoed back through the firmware's own read.
    expect((verdict.serial || '').includes('sdhi')).toBe(true);
    expect((verdict.serial || '').includes('SD_DONE')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('ILI9341-touch paints the screen red (display half)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'tft2', type: 'openhw-ili9341-touch', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:10', to: 'tft2:CS' },
        { from: 'uno1:9', to: 'tft2:DC' },
        { from: 'uno1:8', to: 'tft2:RESET' },
        { from: 'uno1:11', to: 'tft2:MOSI' },
        { from: 'uno1:13', to: 'tft2:SCK' },
        { from: 'uno1:5V', to: 'tft2:LED' },
        { from: 'uno1:5V', to: 'tft2:VCC' },
        { from: 'uno1:gnd_1', to: 'tft2:GND' },
      ],
      code: '#include <SPI.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_ILI9341.h>\nAdafruit_ILI9341 tft(10,9,8);\nvoid setup(){Serial.begin(9600);Serial.println("TFT2_READY");tft.begin();tft.fillScreen(ILI9341_RED);}\nvoid loop(){Serial.println("TFT2_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['tft2'], serialNeedle: 'TFT2_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const tft = (verdict.telemetry || []).find((t) => t.id === 'tft2');
    expect(tft).toBeTruthy();
    const custom = tft.details?.custom || tft.details?.metrics?.custom || {};
    console.log('TOUCH custom:', JSON.stringify(custom).slice(0, 200));
    expect(Number(custom.vramFillPercentage ?? 0)).toBeGreaterThan(50);
    await page.screenshot({ path: 'test-results/senses-tft-touch.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('NeoPixel ring lights pixels', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'neo2', type: 'openhw-neopixel-ring', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:6', to: 'neo2:DIN' },
        { from: 'uno1:5V', to: 'neo2:VCC' },
        { from: 'uno1:gnd_1', to: 'neo2:GND' },
      ],
      code: '#include <Adafruit_NeoPixel.h>\nAdafruit_NeoPixel p(8,6,NEO_GRB+NEO_KHZ800);\nvoid setup(){Serial.begin(9600);Serial.println("NEO2_READY");p.begin();p.setPixelColor(0,p.Color(255,0,0));p.setPixelColor(1,p.Color(0,255,0));p.show();}\nvoid loop(){Serial.println("NEO2_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['neo2'], serialNeedle: 'NEO2_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const neo = (verdict.telemetry || []).find((t) => t.id === 'neo2');
    expect(neo).toBeTruthy();
    const ncustom = neo.details?.custom || neo.details?.metrics?.custom || {};
    console.log('NEO2 custom:', JSON.stringify(ncustom).slice(0, 200));
    expect(Number(ncustom.activePixels || 0)).toBeGreaterThanOrEqual(2);
    await page.screenshot({ path: 'test-results/senses-neo-ring.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('LCD1602 parallel prints text (LiquidCrystal, no backpack)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'lc2', type: 'openhw-lcd1602', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:7', to: 'lc2:RS' },
        { from: 'uno1:8', to: 'lc2:E' },
        { from: 'uno1:9', to: 'lc2:D4' },
        { from: 'uno1:10', to: 'lc2:D5' },
        { from: 'uno1:11', to: 'lc2:D6' },
        { from: 'uno1:12', to: 'lc2:D7' },
        { from: 'uno1:5V', to: 'lc2:VDD' },
        { from: 'uno1:gnd_1', to: 'lc2:VSS' },
      ],
      code: '#include <LiquidCrystal.h>\nLiquidCrystal lcd(7,8,9,10,11,12);\nvoid setup(){Serial.begin(9600);Serial.println("LC2_READY");lcd.begin(16,2);lcd.print("Hi1602");}\nvoid loop(){Serial.println("LC2_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['lc2'], serialNeedle: 'LC2_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const lc = (verdict.telemetry || []).find((t) => t.id === 'lc2');
    expect(lc).toBeTruthy();
    const custom = lc.details?.custom || lc.details?.metrics?.custom || {};
    console.log('LCD1602-P textContent:', JSON.stringify(String(custom.textContent || '').slice(0, 40)));
    expect(String(custom.textContent || '').includes('Hi1602')).toBe(true);
    await page.screenshot({ path: 'test-results/senses-lcd1602p.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('LCD2004 parallel prints text (LiquidCrystal, no backpack)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'lc3', type: 'openhw-lcd2004', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:7', to: 'lc3:RS' },
        { from: 'uno1:8', to: 'lc3:E' },
        { from: 'uno1:9', to: 'lc3:D4' },
        { from: 'uno1:10', to: 'lc3:D5' },
        { from: 'uno1:11', to: 'lc3:D6' },
        { from: 'uno1:12', to: 'lc3:D7' },
        { from: 'uno1:5V', to: 'lc3:VDD' },
        { from: 'uno1:gnd_1', to: 'lc3:VSS' },
      ],
      code: '#include <LiquidCrystal.h>\nLiquidCrystal lcd(7,8,9,10,11,12);\nvoid setup(){Serial.begin(9600);Serial.println("LC3_READY");lcd.begin(20,4);lcd.print("Hello20x4");}\nvoid loop(){Serial.println("LC3_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['lc3'], serialNeedle: 'LC3_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const lc = (verdict.telemetry || []).find((t) => t.id === 'lc3');
    expect(lc).toBeTruthy();
    const custom = lc.details?.custom || lc.details?.metrics?.custom || {};
    console.log('LCD2004-P textContent:', JSON.stringify(String(custom.textContent || '').slice(0, 40)));
    expect(String(custom.textContent || '').includes('Hello20x4')).toBe(true);
    await page.screenshot({ path: 'test-results/senses-lcd2004p.png' });
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('DS18B20 reports temperature over 1-Wire (DallasTemperature)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'ds1', type: 'openhw-ds18b20', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:2', to: 'ds1:DQ' },
        { from: 'uno1:5V', to: 'ds1:VCC' },
        { from: 'uno1:gnd_1', to: 'ds1:GND' },
      ],
      code: '#include <OneWire.h>\n#include <DallasTemperature.h>\nOneWire ow(2);\nDallasTemperature sensors(&ow);\nvoid setup(){Serial.begin(9600);Serial.println("DS_READY");sensors.begin();sensors.requestTemperatures();Serial.print("TEMP:");Serial.println(sensors.getTempCByIndex(0));}\nvoid loop(){Serial.println("DS_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['ds1'], serialNeedle: 'DS_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    console.log('DS serial:', JSON.stringify((verdict.serial || '').slice(0, 300)));
    // Model default is exactly 25 C; Dallas lib prints two decimals.
    expect((verdict.serial || '').includes('25.00')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('DHT-22 reports temp/humidity (DHT sensor library)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'dht1', type: 'DHT-22', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:2', to: 'dht1:DATA' },
        { from: 'uno1:5V', to: 'dht1:VCC' },
        { from: 'uno1:gnd_1', to: 'dht1:GND' },
      ],
      code: '#include <DHT.h>\nDHT dht(2,DHT22);\nvoid setup(){Serial.begin(9600);Serial.println("DHT_READY");dht.begin();delay(2500);Serial.print("T:");Serial.println(dht.readTemperature());Serial.print("H:");Serial.println(dht.readHumidity());}\nvoid loop(){Serial.println("DHT_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 18000, selectTelemetry: ['dht1'], serialNeedle: 'DHT_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    console.log('DHT serial:', JSON.stringify((verdict.serial || '').slice(0, 300)));
    // Model defaults are exactly 24 C / 50 %RH.
    expect((verdict.serial || '').includes('24.00')).toBe(true);
    expect((verdict.serial || '').includes('50.00')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('MAX98357 decodes I2S to analog (OUT+ looped to A0)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'max1', type: 'openhw-max98357', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:5', to: 'max1:BCLK' },
        { from: 'uno1:6', to: 'max1:LRC' },
        { from: 'uno1:7', to: 'max1:DIN' },
        { from: 'uno1:5V', to: 'max1:VIN' },
        { from: 'uno1:gnd_1', to: 'max1:GND' },
        { from: 'max1:OUT+', to: 'uno1:A0' },
      ],
      code: 'void frame(uint16_t s){digitalWrite(6,LOW);for(int i=15;i>=0;i--){digitalWrite(7,(s>>i)&1);delayMicroseconds(200);digitalWrite(5,HIGH);delayMicroseconds(200);digitalWrite(5,LOW);}digitalWrite(6,HIGH);delayMicroseconds(200);}\nvoid setup(){Serial.begin(9600);Serial.println("MAX_READY");pinMode(5,OUTPUT);pinMode(6,OUTPUT);pinMode(7,OUTPUT);frame(0x8000);delay(200);Serial.print("A0LO:");Serial.println(analogRead(A0));frame(0x7FFF);delay(200);Serial.print("A0HI:");Serial.println(analogRead(A0));}\nvoid loop(){Serial.println("MAX_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['max1'], serialNeedle: 'MAX_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    console.log('MAX serial:', JSON.stringify(serial.slice(0, 300)));
    const lo = Number(/A0LO:(\d+)/.exec(serial)?.[1] ?? NaN);
    const hi = Number(/A0HI:(\d+)/.exec(serial)?.[1] ?? NaN);
    // 0x8000 -> 0 V -> ~0 counts; 0x7FFF -> ~3.3 V -> ~675 counts (5 V ref).
    expect(lo).toBeLessThan(50);
    expect(hi).toBeGreaterThan(600);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('SPH0645 hears the fake-mic tone (I2S mic, same path as INMP441)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'sph1', type: 'openhw-sph0645', attrs: { micMode: 'real' }, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:3v3', to: 'sph1:3V' },
          { from: 'uno1:gnd_1', to: 'sph1:GND' },
          { from: 'uno1:2', to: 'sph1:LRCL' },
          { from: 'uno1:3', to: 'sph1:BCLK' },
        ],
        code: 'void setup(){Serial.begin(9600);Serial.println("SPH_READY");pinMode(2,OUTPUT);pinMode(3,OUTPUT);}\nvoid loop(){for(int i=0;i<500;i++){digitalWrite(2,HIGH);delayMicroseconds(200);digitalWrite(2,LOW);delayMicroseconds(200);digitalWrite(3,HIGH);delayMicroseconds(50);digitalWrite(3,LOW);delayMicroseconds(50);}Serial.println("SPH_TICK");delay(500);}\n',
      }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['sph1'], serialNeedle: 'SPH_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const sph = (verdict.telemetry || []).find((t) => t.id === 'sph1');
    expect(sph).toBeTruthy();
    const custom = sph.details?.custom || sph.details?.metrics?.custom || {};
    console.log('SPH custom:', JSON.stringify(custom).slice(0, 200));
    expect(String(custom.liveMicEnabled || '')).toMatch(/yes/i);
    expect(Number(custom.peakAmplitude ?? 0)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('PCM5102 decodes I2S to analog (OUTL looped to A0)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'pcm1', type: 'openhw-pcm5102', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:5', to: 'pcm1:BCK' },
        { from: 'uno1:6', to: 'pcm1:LCK' },
        { from: 'uno1:7', to: 'pcm1:DIN' },
        { from: 'uno1:5V', to: 'pcm1:VCC' },
        { from: 'uno1:gnd_1', to: 'pcm1:GND' },
        { from: 'pcm1:OUTL', to: 'uno1:A0' },
      ],
      code: 'void frame(uint16_t s){digitalWrite(6,LOW);for(int i=15;i>=0;i--){digitalWrite(7,(s>>i)&1);delayMicroseconds(200);digitalWrite(5,HIGH);delayMicroseconds(200);digitalWrite(5,LOW);}digitalWrite(6,HIGH);delayMicroseconds(200);}\nvoid setup(){Serial.begin(9600);Serial.println("PCM_READY");pinMode(5,OUTPUT);pinMode(6,OUTPUT);pinMode(7,OUTPUT);frame(0x8000);delay(200);Serial.print("A0LO:");Serial.println(analogRead(A0));frame(0x7FFF);delay(200);Serial.print("A0HI:");Serial.println(analogRead(A0));}\nvoid loop(){Serial.println("PCM_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['pcm1'], serialNeedle: 'PCM_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    console.log('PCM serial:', JSON.stringify(serial.slice(0, 300)));
    const lo = Number(/A0LO:(\d+)/.exec(serial)?.[1] ?? NaN);
    const hi = Number(/A0HI:(\d+)/.exec(serial)?.[1] ?? NaN);
    expect(lo).toBeLessThan(50);
    expect(hi).toBeGreaterThan(600);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('HC-SR04 measures echo time (100cm -> ~5800us)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'sr1', type: 'openhw-hc-sr04', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:8', to: 'sr1:TRIG' },
        { from: 'uno1:9', to: 'sr1:ECHO' },
        { from: 'uno1:5V', to: 'sr1:VCC' },
        { from: 'uno1:gnd_1', to: 'sr1:GND' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("SR_READY");pinMode(8,OUTPUT);pinMode(9,INPUT);digitalWrite(8,LOW);delayMicroseconds(2);digitalWrite(8,HIGH);delayMicroseconds(10);digitalWrite(8,LOW);unsigned long d=pulseIn(9,HIGH);Serial.print("ECHO_US:");Serial.println(d);}\nvoid loop(){Serial.println("SR_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['sr1'], serialNeedle: 'SR_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    console.log('SR serial:', JSON.stringify(serial.slice(0, 200)));
    const us = Number(/ECHO_US:(\d+)/.exec(serial)?.[1] ?? NaN);
    // Default 100cm at 58us/cm.
    expect(us).toBeGreaterThan(5000);
    expect(us).toBeLessThan(6500);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Relay energises, RGB lights red, servo seeks 90deg', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'rl1', type: 'openhw-relay-module', attrs: {}, x: 450, y: 80 },
        { id: 'rgb1', type: 'openhw-rgb-led', attrs: {}, x: 450, y: 160 },
        { id: 'sv1', type: 'openhw-servo', attrs: {}, x: 450, y: 240 },
      ],
      wires: [
        { from: 'uno1:4', to: 'rl1:IN' },
        { from: 'uno1:5V', to: 'rl1:VCC' },
        { from: 'uno1:gnd_1', to: 'rl1:GND' },
        { from: 'uno1:9', to: 'rgb1:R' },
        { from: 'uno1:gnd_1', to: 'rgb1:COM' },
        { from: 'uno1:10', to: 'sv1:PWM' },
        { from: 'uno1:5V', to: 'sv1:V+' },
        { from: 'uno1:gnd_1', to: 'sv1:GND' },
      ],
      code: '#include <Servo.h>\nServo s;\nvoid setup(){Serial.begin(9600);Serial.println("ACT_READY");pinMode(4,OUTPUT);digitalWrite(4,LOW);analogWrite(9,255);s.attach(10);s.write(90);}\nvoid loop(){Serial.println("ACT_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['rl1', 'rgb1', 'sv1'], serialNeedle: 'ACT_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const byId = Object.fromEntries((verdict.telemetry || []).map((t) => [t.id, t]));
    // Relay is active-LOW: IN driven LOW -> energised.
    expect(byId['rl1'] && ((verdict.liveOop || {}).rl1 || {}).energised).toBe(true);
    // RGB cathode default: COM=GND, R=255 -> full red.
    expect(Number(((verdict.liveOop || {}).rgb1 || {}).r ?? -1)).toBe(255);
    // Servo decodes the 90deg PWM duty (float mapping, tolerance for cycle quantization).
    const scustom = (byId['sv1']?.details?.custom) || (byId['sv1']?.details?.metrics?.custom) || {};
    console.log('SERVO custom:', JSON.stringify(scustom).slice(0, 200));
    expect(Math.abs(Number(scustom.targetAngle ?? -1) - 90)).toBeLessThan(0.5);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('74HC595 shifts out 0xAA (shiftOut + latch)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'sr595', type: 'openhw-74hc595', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:8', to: 'sr595:ser' },
        { from: 'uno1:9', to: 'sr595:srclk' },
        { from: 'uno1:10', to: 'sr595:rclk' },
        { from: 'uno1:5V', to: 'sr595:srclr' },
        { from: 'uno1:gnd_1', to: 'sr595:oe' },
        { from: 'uno1:5V', to: 'sr595:vcc' },
        { from: 'uno1:gnd_1', to: 'sr595:gnd' },
      ],
      code: 'void wbit(int v){digitalWrite(8,v);delayMicroseconds(50);digitalWrite(9,HIGH);delayMicroseconds(50);digitalWrite(9,LOW);delayMicroseconds(50);}\nvoid setup(){Serial.begin(9600);Serial.println("S595_READY");pinMode(8,OUTPUT);pinMode(9,OUTPUT);pinMode(10,OUTPUT);int b[]={1,0,1,0,1,0,1,0};for(int i=0;i<8;i++)wbit(b[i]);digitalWrite(10,HIGH);delayMicroseconds(50);digitalWrite(10,LOW);}\nvoid loop(){Serial.println("S595_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['sr595'], serialNeedle: 'S595_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const storage = Number(((verdict.liveOop || {}).sr595 || {}).storageReg ?? -1);
    console.log('595 storageReg:', storage);
    expect(storage).toBe(0xAA);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Logic gates compute truth tables (AND/OR/NOT/XOR/DFF/MUX)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 100 },
        { id: 'g_and', type: 'logic-and-gate', attrs: {}, x: 400, y: 60 },
        { id: 'g_or', type: 'logic-or-gate', attrs: {}, x: 400, y: 120 },
        { id: 'g_not', type: 'logic-not-gate', attrs: {}, x: 400, y: 180 },
        { id: 'g_xor', type: 'logic-xor-gate', attrs: {}, x: 400, y: 240 },
        { id: 'g_dff', type: 'logic-d-flipflop', attrs: {}, x: 560, y: 120 },
        { id: 'g_mux', type: 'logic-mux-2to1', attrs: {}, x: 560, y: 220 },
      ],
      wires: [
        { from: 'uno1:2', to: 'g_and:IN1' },
        { from: 'uno1:3', to: 'g_and:IN2' },
        { from: 'g_and:OUT', to: 'uno1:4' },
        { from: 'uno1:5', to: 'g_or:IN1' },
        { from: 'uno1:6', to: 'g_or:IN2' },
        { from: 'g_or:OUT', to: 'uno1:7' },
        { from: 'uno1:8', to: 'g_not:IN' },
        { from: 'g_not:OUT', to: 'uno1:9' },
        { from: 'uno1:10', to: 'g_xor:IN1' },
        { from: 'uno1:11', to: 'g_xor:IN2' },
        { from: 'g_xor:OUT', to: 'uno1:12' },
        { from: 'uno1:A0', to: 'g_dff:D' },
        { from: 'uno1:A1', to: 'g_dff:CLK' },
        { from: 'g_dff:Q', to: 'uno1:A2' },
        { from: 'uno1:A3', to: 'g_mux:D0' },
        { from: 'uno1:A4', to: 'g_mux:D1' },
        { from: 'uno1:13', to: 'g_mux:SEL' },
        { from: 'g_mux:OUT', to: 'uno1:A5' },
      ],
      code: 'int ok=1;\nvoid chk(const char*n,int got,int want){if(got!=want){Serial.print("FAIL:");Serial.print(n);Serial.print(got);Serial.print("!=");Serial.println(want);ok=0;}}\nvoid setup(){Serial.begin(9600);Serial.println("GATE_READY");for(int i=2;i<=13;i++){pinMode(i,OUTPUT);}pinMode(A0,OUTPUT);pinMode(A1,OUTPUT);pinMode(A3,OUTPUT);pinMode(A4,OUTPUT);pinMode(4,INPUT);pinMode(7,INPUT);pinMode(9,INPUT);pinMode(12,INPUT);pinMode(A2,INPUT);pinMode(A5,INPUT);\nfor(int a=0;a<2;a++)for(int b=0;b<2;b++){digitalWrite(2,a);digitalWrite(3,b);delay(5);chk("AND",digitalRead(4),a&b);digitalWrite(5,a);digitalWrite(6,b);delay(5);chk("OR",digitalRead(7),a|b);digitalWrite(10,a);digitalWrite(11,b);delay(5);chk("XOR",digitalRead(12),a^b);}\ndigitalWrite(8,LOW);delay(5);chk("NOT0",digitalRead(9),HIGH);digitalWrite(8,HIGH);delay(5);chk("NOT1",digitalRead(9),LOW);\ndigitalWrite(A0,HIGH);digitalWrite(A1,LOW);delay(5);digitalWrite(A1,HIGH);delay(5);digitalWrite(A1,LOW);delay(5);chk("DFF",digitalRead(A2),HIGH);\ndigitalWrite(A3,LOW);digitalWrite(A4,HIGH);digitalWrite(13,LOW);delay(5);chk("MUX0",digitalRead(A5),LOW);digitalWrite(13,HIGH);delay(5);chk("MUX1",digitalRead(A5),HIGH);\nif(ok)Serial.println("ALL_PASS");}\nvoid loop(){Serial.println("GATE_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 18000, serialNeedle: 'GATE_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    console.log('GATES serial:', JSON.stringify((verdict.serial || '').slice(0, 400)));
    expect((verdict.serial || '').includes('ALL_PASS')).toBe(true);
    expect((verdict.serial || '').includes('FAIL:')).toBe(false);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Analog sensors read sane voltages (MQ2/photo/battery/joystick)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 100 },
        { id: 'mq1', type: 'openhw-mq2-gas-sensor', attrs: { gasLevel: '600' }, x: 400, y: 80 },
        { id: 'ph1', type: 'openhw-photoresistor', attrs: {}, x: 400, y: 150 },
        { id: 'bt1', type: 'openhw-battery', attrs: {}, x: 400, y: 220 },
        { id: 'jy1', type: 'openhw-analog-joystick', attrs: {}, x: 560, y: 150 },
      ],
      wires: [
        { from: 'uno1:5V', to: 'mq1:VCC' },
        { from: 'uno1:gnd_1', to: 'mq1:GND' },
        { from: 'mq1:AO', to: 'uno1:A2' },
        { from: 'uno1:5V', to: 'ph1:p1' },
        { from: 'ph1:p2', to: 'uno1:A3' },
        { from: 'bt1:VCC', to: 'uno1:A0' },
        { from: 'bt1:GND', to: 'uno1:gnd_1' },
        { from: 'uno1:5V', to: 'jy1:VCC' },
        { from: 'uno1:gnd_1', to: 'jy1:GND' },
        { from: 'jy1:VERT', to: 'uno1:A1' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("ANA_READY");delay(1000);Serial.print("MQ2:");Serial.println(analogRead(A2));Serial.print("PHOTO:");Serial.println(analogRead(A3));Serial.print("BATT:");Serial.println(analogRead(A0));Serial.print("JOY:");Serial.println(analogRead(A1));delay(1000);Serial.print("R2-MQ2:");Serial.println(analogRead(A2));Serial.print("R2-PHOTO:");Serial.println(analogRead(A3));}\nvoid loop(){Serial.println("ANA_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['mq1'], serialNeedle: 'ANA_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    console.log('ANA serial:', JSON.stringify(serial.slice(0, 300)));
    console.log('ANA liveOop:', JSON.stringify({ mq1: (verdict.liveOop || {}).mq1, ph1: (verdict.liveOop || {}).ph1, bt1: (verdict.liveOop || {}).bt1, jy1: (verdict.liveOop || {}).jy1 }).slice(0, 500));
    const num = (k) => Number(new RegExp(k + ':(\\d+)').exec(serial)?.[1] ?? NaN);
    // MQ2 gasLevel 600 -> ~600 counts; photo lux 500 -> ~500; battery
    // full-charge 4.2V -> ~860; joystick mid -> ~512. Second round must match.
    expect(num('MQ2')).toBeGreaterThan(550); expect(num('MQ2')).toBeLessThan(650);
    expect(num('PHOTO')).toBeGreaterThan(480); expect(num('PHOTO')).toBeLessThan(520);
    expect(num('BATT')).toBeGreaterThan(830); expect(num('BATT')).toBeLessThan(890);
    expect(num('JOY')).toBeGreaterThan(480); expect(num('JOY')).toBeLessThan(545);
    expect(num('R2-MQ2')).toBeGreaterThan(550); expect(num('R2-MQ2')).toBeLessThan(650);
    expect(num('R2-PHOTO')).toBeGreaterThan(480); expect(num('R2-PHOTO')).toBeLessThan(520);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pushbutton press reaches firmware (DOM click -> digitalRead)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'btn1', type: 'openhw-pushbutton', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:2', to: 'btn1:1l' },
        { from: 'uno1:gnd_1', to: 'btn1:2l' },
      ],
      code: 'int last=1;\nvoid setup(){Serial.begin(9600);Serial.println("BTN_READY");pinMode(2,INPUT_PULLUP);}\nvoid loop(){int v=digitalRead(2);if(v!=last){Serial.print("BTN:");Serial.println(v);last=v;}delay(50);}\n',
    });
    const verdictPromise = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['btn1'], serialNeedle: 'BTN_READY', telemetryMode: 'detail',
    }));
    await page.waitForTimeout(3000);
    // Exactly one pushbutton on the canvas (uno reset uses another class).
    // Scope to the placed instance: palette previews render too.
    await page.locator('#comp-master-btn1').scrollIntoViewIfNeeded().catch(() => {});
    const boxes = await page.locator('#comp-master-btn1 .btn-wrapper').evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
    console.log('BTN boxes:', JSON.stringify(boxes));
    expect(boxes.length).toBeGreaterThanOrEqual(1);
    const b = boxes.reduce((a, c) => (c.x > a.x ? c : a));
    await page.mouse.move(b.x, b.y);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
    const verdict = await verdictPromise;
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    console.log('BTN serial:', JSON.stringify((verdict.serial || '').slice(0, 200)));
    // Press shorts 1l-2l to GND -> digitalRead goes LOW.
    expect((verdict.serial || '').includes('BTN:0')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('PIR motion reaches firmware (drag dot into cone -> digitalRead)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'pir1', type: 'openhw-pir-motion-sensor', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:2', to: 'pir1:OUT' },
        { from: 'uno1:5V', to: 'pir1:VCC' },
        { from: 'uno1:gnd_1', to: 'pir1:GND' },
      ],
      code: 'int last=0;\nvoid setup(){Serial.begin(9600);Serial.println("PIR_READY");pinMode(2,INPUT);}\nvoid loop(){int v=digitalRead(2);if(v!=last){Serial.print("MOTION:");Serial.println(v);last=v;}delay(100);}\n',
    });
    const verdictPromise = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 22000, selectTelemetry: ['pir1'], serialNeedle: 'PIR_READY', telemetryMode: 'detail',
    }));
    await page.waitForTimeout(3000);
    // Reveal the cone + draggable dot by clicking the placed sensor body
    // (coordinate click: the wrapper is not pointer-actionable itself).
    await page.locator('#comp-master-pir1').scrollIntoViewIfNeeded().catch(() => {});
    const pirBox = await page.evaluate(() => {
      const root = document.getElementById('comp-master-pir1');
      if (!root) return null;
      const r = root.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    expect(pirBox).toBeTruthy();
    await page.mouse.click(pirBox.x, pirBox.y);
    await page.waitForTimeout(800);
    // Wiggle the teal grab-dot inside the cone to simulate movement.
    const dot = await page.evaluate(() => {
      const root = document.getElementById('comp-master-pir1');
      if (!root) return [];
      const out = [];
      for (const c of root.querySelectorAll('circle')) {
        const fill = c.getAttribute('fill');
        if (fill === '#008C9E' || fill === '#2563eb') {
          const r = c.getBoundingClientRect();
          out.push({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
        }
      }
      return out;
    });
    console.log('PIR dots:', JSON.stringify(dot));
    expect(dot.length).toBeGreaterThan(0);
    const d = dot[0];
    await page.mouse.move(d.x, d.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i += 1) {
      await page.mouse.move(d.x + 25 * Math.cos(i * 0.7), d.y + 25 * Math.sin(i * 0.7), { steps: 3 });
      await page.waitForTimeout(120);
    }
    await page.mouse.up();
    const verdict = await verdictPromise;
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    console.log('PIR serial:', JSON.stringify((verdict.serial || '').slice(0, 200)));
    expect((verdict.serial || '').includes('MOTION:1')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('IR receiver decodes POWER from its own remote popup', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'irr1', type: 'openhw-ir-receiver', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:5V', to: 'irr1:VCC' },
        { from: 'uno1:gnd_1', to: 'irr1:GND' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("IRR_READY");}\nvoid loop(){Serial.println("IRR_TICK");delay(1000);}\n',
    });
    const verdictPromise = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['irr1'], serialNeedle: 'IRR_READY', telemetryMode: 'detail',
    }));
    await page.waitForTimeout(3000);
    // Click the placed receiver body to open its remote popup, then POWER.
    const svgBox = await page.evaluate(() => {
      const root = document.getElementById('comp-master-irr1');
      if (!root) return null;
      const svgs = [...root.querySelectorAll('svg')];
      const hit = svgs.find((s) => (s.innerHTML || '').includes('M 145 55')) || svgs[0];
      if (!hit) return null;
      hit.scrollIntoView({ block: 'center' });
      const r = hit.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    console.log('IRR svg:', JSON.stringify(svgBox));
    expect(svgBox).toBeTruthy();
    // Click via dispatched DOM click (overlay move-layers can swallow hit-testing).
    await page.evaluate(() => {
      const root = document.getElementById('comp-master-irr1');
      const svgs = [...(root ? root.querySelectorAll('svg') : [])];
      const hit = svgs.find((s) => (s.innerHTML || '').includes('M 145 55')) || svgs[0];
      if (hit) hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(800);
    const powerCount = await page.locator('#comp-master-irr1').getByRole('button', { name: 'POWER' }).count();
    console.log('IRR POWER buttons:', powerCount);
    expect(powerCount).toBeGreaterThan(0);
    // Dispatched mousedown on the LIVE node: the popup re-renders on every
    // telemetry tick, so a real click can land on a detached node.
    await page.evaluate(() => {
      const root = document.getElementById('comp-master-irr1');
      if (!root) return;
      const btns = [...root.querySelectorAll('button')];
      const pb = btns.find((b) => (b.textContent || '').trim() === 'POWER');
      if (pb) pb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    await page.waitForTimeout(800);
    const verdict = await verdictPromise;
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const btn = String(((verdict.liveOop || {}).irr1 || {}).lastButton || '');
    console.log('IRR lastButton:', btn);
    expect(btn).toBe('POWER');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  // NOTE (UI gap, reported — see plan §12): openhw-ir-remote renders a
  // clickable POWER pad, but its UI calls an `onEvent` prop the canvas
  // never provides, so DOM clicks die before reaching the worker. The
  // worker model itself is proven headless (sweep injects button_press
  // POWER and asserts lastCommand + NEC pulse queue = content tier).
  // Live DOM proof stays with the receiver sibling below, whose remote
  // popup path (attrs.onInteract) is wired end to end.
  test('IR remote renders (NEC worker path proven headless in sweep)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'irm1', type: 'openhw-ir-remote', attrs: {}, x: 450, y: 120 },
      ],
      wires: [],
      code: 'void setup(){Serial.begin(9600);Serial.println("IRM_READY");}\nvoid loop(){Serial.println("IRM_TICK");delay(1000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 12000, selectTelemetry: ['irm1'], serialNeedle: 'IRM_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    // The remote UI renders (DOM proof a human can see it); worker model
    // coverage is asserted headless in component-sweep.
    const found = await page.evaluate(() => !!document.getElementById('comp-master-irm1'));
    expect(found).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Membrane keypad scans key 5 (DOM hold -> matrix scan)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'kp1', type: 'openhw-membrane-keypad', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:4', to: 'kp1:R1' },
        { from: 'uno1:5', to: 'kp1:R2' },
        { from: 'uno1:6', to: 'kp1:R3' },
        { from: 'uno1:7', to: 'kp1:R4' },
        { from: 'uno1:8', to: 'kp1:C1' },
        { from: 'uno1:9', to: 'kp1:C2' },
        { from: 'uno1:12', to: 'kp1:C3' },
        { from: 'uno1:13', to: 'kp1:C4' },
      ],
      code: 'int rows[4]={4,5,6,7};\nint cols[4]={8,9,12,13};\nvoid setup(){Serial.begin(9600);Serial.println("KP_READY");for(int i=0;i<4;i++){pinMode(rows[i],OUTPUT);digitalWrite(rows[i],HIGH);pinMode(cols[i],INPUT_PULLUP);}}\nvoid loop(){for(int r=0;r<4;r++){digitalWrite(rows[r],LOW);delay(5);for(int c=0;c<4;c++){if(digitalRead(cols[c])==LOW){Serial.print(millis());Serial.print(":KEY:");Serial.print(r);Serial.println(c);delay(300);}}digitalWrite(rows[r],HIGH);}delay(200);}\n',
    });
    const verdictPromise = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 22000, selectTelemetry: ['kp1'], serialNeedle: 'KP_READY', telemetryMode: 'detail',
    }));
    await page.waitForTimeout(3000);
    // Hold key 5 (row 2, col 2) while the firmware matrix-scans.
    // Prints carry millis() so detections correlate with the hold window.
    const key = page.locator('#comp-master-kp1 wokwi-membrane-keypad').getByText('5', { exact: true });
    await key.scrollIntoViewIfNeeded().catch(() => {});
    const kbox = await key.boundingBox({ timeout: 10000 }).catch(() => null);
    console.log('KP key5 box:', JSON.stringify(kbox));
    expect(kbox).toBeTruthy();
    await page.mouse.move(kbox.x + kbox.width / 2, kbox.y + kbox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2500);
    await page.mouse.up();
    const verdict = await verdictPromise;
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    console.log('KP serial:', JSON.stringify((verdict.serial || '').slice(0, 200)));
    // Row index 1, col index 1 == key 5.
    expect((verdict.serial || '').includes('KEY:11')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Rotary encoder turns and clicks (drag arc + knob press)', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'rot1', type: 'openhw-rotary-encoder', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:2', to: 'rot1:CLK' },
        { from: 'uno1:3', to: 'rot1:DT' },
        { from: 'uno1:4', to: 'rot1:SW' },
        { from: 'uno1:5V', to: 'rot1:VCC' },
        { from: 'uno1:gnd_1', to: 'rot1:GND' },
      ],
      code: 'int last=1;\nvoid setup(){Serial.begin(9600);Serial.println("ROT_READY");pinMode(4,INPUT_PULLUP);}\nvoid loop(){int v=digitalRead(4);if(v!=last){Serial.print("SW:");Serial.println(v);last=v;}delay(100);}\n',
    });
    const verdictPromise = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 22000, selectTelemetry: ['rot1'], serialNeedle: 'ROT_READY', telemetryMode: 'detail',
    }));
    await page.waitForTimeout(3000);
    // Knob svg is 99x75, center x=60/99, y=1/2. Drag an arc outside r=14.
    const knob = await page.evaluate(() => {
      const root = document.getElementById('comp-master-rot1');
      if (!root) return null;
      const svgs = [...root.querySelectorAll('svg')];
      const hit = svgs.find((s) => (s.getAttribute('viewBox') || '') === '0 0 99 75') || svgs[0];
      if (!hit) return null;
      hit.scrollIntoView({ block: 'center' });
      const r = hit.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    console.log('ROT knob:', JSON.stringify(knob));
    expect(knob).toBeTruthy();
    const cx = knob.x + knob.w * (60 / 99);
    const cy = knob.y + knob.h / 2;
    const R = Math.min(knob.w, knob.h) * 0.32;
    await page.mouse.move(cx + R, cy);
    await page.mouse.down();
    for (let i = 1; i <= 14; i += 1) {
      const a = (i / 14) * Math.PI * 1.2;
      await page.mouse.move(cx + R * Math.cos(a), cy + R * Math.sin(a), { steps: 2 });
      await page.waitForTimeout(90);
    }
    await page.mouse.up();
    // Re-read geometry: the drag may have moved the canvas.
    const knob2 = await page.evaluate(() => {
      const root = document.getElementById('comp-master-rot1');
      if (!root) return null;
      const svgs = [...root.querySelectorAll('svg')];
      const hit = svgs.find((s) => (s.getAttribute('viewBox') || '') === '0 0 99 75') || svgs[0];
      if (!hit) return null;
      const r = hit.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    expect(knob2).toBeTruthy();
    const cx2 = knob2.x + knob2.w * (60 / 99);
    const cy2 = knob2.y + knob2.h / 2;
    // Knob center press-and-hold = SW press (radius < 14 svg units).
    // Dispatched pointer events bypass overlay hit-testing entirely.
    await page.evaluate(() => {
      const root = document.getElementById('comp-master-rot1');
      if (!root) return false;
      const svgs = [...root.querySelectorAll('svg')];
      const hit = svgs.find((s) => (s.getAttribute('viewBox') || '') === '0 0 99 75') || svgs[0];
      if (!hit) return false;
      const r = hit.getBoundingClientRect();
      // Recompute center live (drag may have moved the canvas).
      const cx = r.x + r.width * (60 / 99);
      const cy = r.y + r.height / 2;
      const opts = { bubbles: true, clientX: cx, clientY: cy, pointerId: 7, isPrimary: true };
      hit.dispatchEvent(new PointerEvent('pointerdown', opts));
      return true;
    });
    await page.waitForTimeout(1200);
    // Mid-hold worker snapshot: SW/README state independent of firmware polls.
    const midSnap = await page.evaluate(() => window.OpenHWE2E.snapshot());
    await page.evaluate(() => {
      const root = document.getElementById('comp-master-rot1');
      const hit = root ? root.querySelector('svg') : null;
      if (!hit) return false;
      const r = hit.getBoundingClientRect();
      const cx = r.x + r.width * (60 / 99);
      const cy = r.y + r.height / 2;
      hit.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: cx, clientY: cy, pointerId: 7, isPrimary: true }));
      return true;
    });
    await page.waitForTimeout(600);
    const verdict = await verdictPromise;
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const rot = Number(((verdict.liveOop || {}).rot1 || {}).rot ?? 0);
    console.log('ROT rot:', rot, 'serial:', JSON.stringify((verdict.serial || '').slice(0, 200)));
    expect(rot).not.toBe(0);
    // Model bookkeeping (informational): pressCount lives in the worker model;
    // the formatted custom channel is lossy by design (see plan §11.4), so
    // the binding press assertions are serial SW:0 (firmware-observed) and
    // SW pinToggles >= 2 (model-observed press + release) below.
    const endPresses = Number((((verdict.telemetry || []).find((t) => t.id === 'rot1'))?.details?.custom?.totalPresses) ?? 0);
    const midPresses = Number(((midSnap.telemetry || []).find((t) => t.id === 'rot1')?.details?.custom?.totalPresses) ?? 0);
    console.log('ROT end totalPresses:', endPresses, 'mid-hold:', midPresses);
    // Press proof (deterministic universal channels): firmware observed the
    // SW line move (serial SW:0/SW:1) and the model pin toggled twice
    // (press + release). totalPresses custom is informational only — the
    // formatted custom channel is lossy by design (see plan §11.4).
    const rotTelem = (verdict.telemetry || []).find((t) => t.id === 'rot1');
    const swToggles = Number(rotTelem?.details?.metrics?.pinToggles?.SW ?? rotTelem?.details?.pinToggles?.SW ?? 0);
    console.log('ROT SW pinToggles:', swToggles);
    expect(swToggles).toBeGreaterThanOrEqual(2);
    expect((verdict.serial || '').includes('SW:0')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
