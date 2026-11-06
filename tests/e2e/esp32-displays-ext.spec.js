import { test, expect } from '@playwright/test';

// ESP32 displays, remaining families, both over a REAL bus (no bit-bang):
//  - LCD1602 through a PCF8574 I2C backpack (SDA 21 / SCL 22). The cell
//    talks raw Wire (no LiquidCrystal_I2C): the standard HD44780 init
//    (0x30 x3 -> 0x20 4-bit, 0x28/0x0C/0x06/0x01) then characters, each
//    byte as two nibbles latched on the expander's EN falling edge.
//  - MAX7219 over the DevKit VSPI bus (DIN 23 / CLK 18 / CS 5), the same
//    register sequence the AVR and CAM cells use.
// Proof is model truth sampled MID-RUN (post-run capture happens after the
// firmware stops, so a working panel can read blank there).
test.describe('ESP32 displays ext (LCD1602 I2C, MAX7219 SPI)', () => {
  test.setTimeout(600000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
  });

  /** Sample one component's custom telemetry N times, 1.5 s apart. */
  const sampleLive = (page, id, keys, n, startDelayMs = 20000) => page.evaluate(async ({ id, keys, n, startDelayMs }) => {
    await new Promise((r) => setTimeout(r, startDelayMs));
    const out = [];
    for (let i = 0; i < n; i++) {
      const list = window.OpenHWTelemetry?.getLatestTelemetry?.() || [];
      const t = list.find((x) => x.id === id) || {};
      const st = t.details?.custom || t.details?.metrics?.custom || t.details?.state || {};
      const rec = {};
      for (const k of keys) rec[k] = st[k];
      out.push(rec);
      await new Promise((r) => setTimeout(r, 1500));
    }
    return out;
  }, { id, keys, n, startDelayMs });

  test('LCD1602 over PCF8574 shows text', async ({ page }) => {
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'lc1', type: 'openhw-lcd1602-i2c', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:21', to: 'lc1:SDA' },
        { from: 'esp1:22', to: 'lc1:SCL' },
        { from: 'esp1:3V3', to: 'lc1:VCC' },
        { from: 'esp1:GND.1', to: 'lc1:GND' },
      ],
      code: [
        '#include <Wire.h>',
        'void wr(uint8_t v){ Wire.beginTransmission(0x27); Wire.write(v); Wire.endTransmission(); }',
        'void pulse(uint8_t v){ wr(v|0x04); delayMicroseconds(80); wr(v & ~0x04); delayMicroseconds(80); }',
        'void nib(uint8_t n, uint8_t rs){ pulse((n<<4) | (rs?1:0) | 0x08); }',
        'void byte_(uint8_t b, uint8_t rs){ nib(b>>4, rs); nib(b & 0x0F, rs); }',
        'void setup(){ Serial.begin(115200); Wire.begin(21,22); Serial.println("LCD_READY"); delay(50);',
        '  pulse(0x38); delay(5); pulse(0x38); delay(5); pulse(0x38); delay(1); pulse(0x28); delay(1);',
        '  byte_(0x28,0); byte_(0x0C,0); byte_(0x06,0); byte_(0x01,0); delay(3);',
        '  const char* t = "Hi1602"; for(int i=0;t[i];i++) byte_(t[i],1);',
        '  Serial.println("LCD_DRAWN"); }',
        'void loop(){ delay(1000); }',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['lc1'], serialNeedle: 'LCD_DRAWN', telemetryMode: 'detail',
    }));
    const rows = await sampleLive(page, 'lc1', ['textContent', 'backlight', 'lineCount'], 6);
    const verdict = await runP;
    console.log('ESPLCD rows:', JSON.stringify(rows).slice(0, 500));
    expect(verdict.ok).toBe(true);
    expect(rows.length).toBeGreaterThan(2);
    const shown = rows.filter((r) => String(r.textContent || '').includes('Hi1602'));
    // Text must be latched on a majority of samples, not just at the end.
    expect(shown.length).toBeGreaterThanOrEqual(Math.ceil(rows.length / 2));
    expect(shown[0].backlight).toBe(true);
    expect(Number(shown[0].lineCount)).toBe(2);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });

  test('MAX7219 over DevKit VSPI latches registers', async ({ page }) => {
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:23', to: 'mx1:DIN' },
        { from: 'esp1:18', to: 'mx1:CLK' },
        { from: 'esp1:5', to: 'mx1:CS' },
        { from: 'esp1:3V3', to: 'mx1:VCC' },
        { from: 'esp1:GND.1', to: 'mx1:GND' },
      ],
      code: [
        '#include <SPI.h>',
        'void wr(uint8_t r,uint8_t d){ digitalWrite(5,LOW); SPI.transfer(r); SPI.transfer(d); digitalWrite(5,HIGH); }',
        'void setup(){ Serial.begin(115200); Serial.println("MX_READY"); pinMode(5,OUTPUT); digitalWrite(5,HIGH);',
        '  SPI.begin(); SPI.beginTransaction(SPISettings(4000000,MSBFIRST,SPI_MODE0));',
        '  wr(0x0C,0x01); wr(0x0A,0x08); wr(0x0B,0x07); wr(0x01,0x7E); wr(0x02,0x30);',
        '  Serial.println("MX_DRAWN"); }',
        'void loop(){ delay(1000); }',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['mx1'], serialNeedle: 'MX_DRAWN', telemetryMode: 'detail',
    }));
    const rows = await sampleLive(page, 'mx1', ['shutdown', 'matrix', 'csActive'], 6);
    const verdict = await runP;
    console.log('ESPMX rows:', JSON.stringify(rows).slice(0, 500));
    expect(verdict.ok).toBe(true);
    expect(rows.length).toBeGreaterThan(2);
    const latched = rows.filter((r) => Array.isArray(r.matrix) && r.matrix[0] === 0x7e && r.matrix[1] === 0x30);
    expect(latched.length).toBeGreaterThanOrEqual(Math.ceil(rows.length / 2));
    expect(latched[0].shutdown).toBe(false);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });
});
