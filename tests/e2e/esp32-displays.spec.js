import { test, expect } from '@playwright/test';

// ESP32 displays driven straight from GPIO: a 7-segment digit (one pin per
// segment) and a TM1637 module (bit-banged CLK/DIO two-wire). Both assert
// the COMPONENT MODEL mid-run — the post-run snapshot is taken after the
// firmware has stopped driving the pins, so a working display can read as
// blank in a final dump (same trap as esp32-actuators).
//
// NeoPixel is NOT here: Adafruit_NeoPixel transmits over RMT, and the
// engine's RMT model ends a TX after one symbol (see the P3 owner ask in
// vendor/emulator-hook-specs/esp32-emu.md); the runner-side decoder is in
// src/worker/runners/rmt-neopixel.ts with unit coverage, waiting on that.
test.describe('ESP32 displays (7-segment, TM1637)', () => {
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

  /** Poll one component's live model state N times, 1.5 s apart. */
  const sampleLive = (page, id, keys, n, startDelayMs = 20000) => page.evaluate(async ({ id, keys, n, startDelayMs }) => {
    await new Promise((r) => setTimeout(r, startDelayMs));
    const out = [];
    for (let i = 0; i < n; i++) {
      const list = window.OpenHWTelemetry?.getLatestTelemetry?.() || [];
      const st = list.find((x) => x.id === id)?.details?.state || {};
      const rec = {};
      for (const k of keys) rec[k] = st[k];
      out.push(rec);
      await new Promise((r) => setTimeout(r, 1500));
    }
    return out;
  }, { id, keys, n, startDelayMs });

  test('7-segment lights one pin per segment', async ({ page }) => {
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'seg1', type: 'openhw-7segment', attrs: {}, x: 430, y: 120 },
      ],
      wires: [
        { from: 'esp1:GPIO12', to: 'seg1:A' },
        { from: 'esp1:GPIO13', to: 'seg1:B' },
        { from: 'esp1:GPIO14', to: 'seg1:C' },
        { from: 'esp1:GPIO15', to: 'seg1:D' },
        { from: 'esp1:GPIO16', to: 'seg1:E' },
        { from: 'esp1:GPIO17', to: 'seg1:F' },
        { from: 'esp1:GPIO18', to: 'seg1:G' },
        { from: 'esp1:GND', to: 'seg1:COM.1' },
      ],
      code: [
        'void setup(){ Serial.begin(115200);',
        '  for(int p=12;p<=18;p++){ pinMode(p, OUTPUT); digitalWrite(p, HIGH); }',
        '  Serial.println("SEG_RDY"); }',
        'void loop(){ delay(500); }',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['seg1'], serialNeedle: 'SEG_RDY', telemetryMode: 'detail',
    }));
    const rows = await sampleLive(page, 'seg1', ['digitSegments'], 6);
    const verdict = await runP;
    const segs = rows.map((r) => (r.digitSegments || [])[0] || {});
    console.log('ESPSEG segments:', JSON.stringify(segs));
    expect(verdict.ok).toBe(true);
    // Common-cathode digit 0: A..G HIGH, DP low (nothing wired to it).
    expect(segs.length).toBeGreaterThan(2);
    for (const s of segs) {
      for (const seg of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) expect(s[seg]).toBe(true);
      expect(!!s.DP).toBe(false);
    }

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });

  test('TM1637 latches four segment bytes over bit-banged CLK/DIO', async ({ page }) => {
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'tm1', type: 'openhw-tm1637-7segment', attrs: {}, x: 430, y: 120 },
      ],
      wires: [
        { from: 'esp1:GPIO22', to: 'tm1:CLK' },
        { from: 'esp1:GPIO23', to: 'tm1:DIO' },
        { from: 'esp1:3V3', to: 'tm1:VCC' },
        { from: 'esp1:GND', to: 'tm1:GND' },
      ],
      // Same byte sequence as the AVR cell: auto-increment write (0x40),
      // address 0 (0xC0) + '0','1','2','3' (0x3F,0x06,0x5B,0x4F), display
      // on with full brightness (0x8F). 50 µs half-bits.
      code: [
        'void bb(uint8_t b){ for(uint8_t i=0;i<8;i++){ digitalWrite(22,LOW); digitalWrite(23,(b>>i)&1); delayMicroseconds(50); digitalWrite(22,HIGH); delayMicroseconds(50);}',
        '  digitalWrite(22,LOW); pinMode(23,INPUT); digitalWrite(22,HIGH); delayMicroseconds(50); pinMode(23,OUTPUT); digitalWrite(22,LOW); }',
        'void st(){ digitalWrite(22,HIGH); digitalWrite(23,HIGH); delayMicroseconds(50); digitalWrite(23,LOW); delayMicroseconds(50); }',
        'void sp(){ digitalWrite(22,LOW); digitalWrite(23,LOW); delayMicroseconds(50); digitalWrite(22,HIGH); delayMicroseconds(50); digitalWrite(23,HIGH); delayMicroseconds(50); }',
        'void setup(){ Serial.begin(115200); pinMode(22,OUTPUT); pinMode(23,OUTPUT);',
        '  st(); bb(0x40); sp(); st(); bb(0xC0); bb(0x3F); bb(0x06); bb(0x5B); bb(0x4F); sp(); st(); bb(0x8F); sp();',
        '  Serial.println("TM_RDY"); }',
        'void loop(){ delay(500); }',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['tm1'], serialNeedle: 'TM_RDY', telemetryMode: 'detail',
    }));
    const rows = await sampleLive(page, 'tm1', ['digits'], 6);
    const verdict = await runP;
    console.log('ESPTM digits:', JSON.stringify(rows.map((r) => r.digits)));
    expect(verdict.ok).toBe(true);
    expect(rows.length).toBeGreaterThan(2);
    for (const r of rows) expect(r.digits).toEqual([0x3f, 0x06, 0x5b, 0x4f]);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });
});
