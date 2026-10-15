import { test, expect } from '@playwright/test';

// micro:bit v2 cells (live, fixed .bin firmware — no backend core):
// hello (UARTE0), blinky (GPIO matrix row + serial), I2C OLED (TWIM0
// DMA pump into the SSD1306 model), SPI (SPIM2 TX + SPIM3 RX loopback).
const CELLS = [
  {
    name: 'UART hello',
    fw: '/firmware/microbit/hello_nrf.bin',
    needle: 'HELLO',
    components: [
      { id: 'mb1', type: 'openhw-microbit-v2', attrs: {}, x: 100, y: 100 },
    ],
    wires: [],
    forMs: 15000,
    extra: null,
  },
  {
    name: 'GPIO blink',
    fw: '/firmware/microbit/blinky_nrf.bin',
    needle: 'BLINK',
    components: [
      { id: 'mb1', type: 'openhw-microbit-v2', attrs: {}, x: 100, y: 100 },
    ],
    wires: [],
    forMs: 20000,
    extra: 'matrix',
  },
  {
    name: 'I2C OLED',
    fw: '/firmware/microbit/oled_nrf.bin',
    needle: 'OLED:OK',
    components: [
      { id: 'mb1', type: 'openhw-microbit-v2', attrs: {}, x: 100, y: 100 },
      { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
    ],
    wires: [
      { from: 'mb1:P19', to: 'oled1:SCL' },
      { from: 'mb1:P20', to: 'oled1:SDA' },
      { from: 'mb1:3V3', to: 'oled1:VCC' },
      { from: 'mb1:GND', to: 'oled1:GND' },
    ],
    forMs: 20000,
    extra: 'oled',
  },
  {
    name: 'SPI loopback',
    fw: '/firmware/microbit/spim23_nrf.bin',
    needle: 'S3RX:OK',
    components: [
      { id: 'mb1', type: 'openhw-microbit-v2', attrs: {}, x: 100, y: 100 },
    ],
    wires: [],
    forMs: 20000,
    extra: null,
  },
  {
    name: 'button A press',
    fw: '/firmware/microbit/button_nrf.bin',
    needle: 'BTN_A_REL',
    components: [
      { id: 'mb1', type: 'openhw-microbit-v2', attrs: {}, x: 100, y: 100 },
    ],
    wires: [],
    forMs: 20000,
    extra: null,
  },
];

test.describe('micro:bit v2 cells', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const cell of CELLS) {
    test(`micro:bit ${cell.name}`, async ({ page }) => {
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ c }) => window.OpenHWE2E.setupCircuit({
        components: c.components.map((x) => x.id === 'mb1'
          ? { ...x, attrs: { ...(x.attrs || {}), firmware: c.fw } }
          : x),
        wires: c.wires,
        code: '',
      }), { c: cell });
      expect(setup.ok).toBe(true);
      const sel = cell.extra === 'oled' ? ['oled1'] : cell.extra === 'matrix' ? ['mb1'] : [];
      const verdict = await page.evaluate(({ ms, needle, s }) => window.OpenHWE2E.run({
        forMs: ms, selectTelemetry: s, serialNeedle: needle, telemetryMode: 'detail',
      }), { ms: cell.forMs, needle: cell.needle, s: sel });
      expect(verdict.ok).toBe(true);
      console.log(`MB ${cell.name}:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`MB ${cell.name} serial:`, (verdict.serial || '').slice(0, 200));
      expect(verdict.pass).toBe(true);
      if (cell.extra === 'oled') {
        // Fixture programs init + status-read (no pixels): proof is the
        // init stream landing (displayOn + updateCount), not vram fill.
        const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
        console.log('MB OLED telemetry:', JSON.stringify(oled || null).slice(0, 300));
        const osum = String((oled && oled.summary) || '') + String(JSON.stringify((oled && oled.details) || {}));
        expect(osum.includes('displayOn')).toBe(true);
        expect(/updateCount["':\s]+[1-9]/.test(osum)).toBe(true);
      }
      if (cell.extra === 'matrix') {
        const mb = (verdict.telemetry || []).find((t) => t.id === 'mb1');
        console.log('MB board telemetry:', JSON.stringify(mb || null).slice(0, 300));
      }
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
