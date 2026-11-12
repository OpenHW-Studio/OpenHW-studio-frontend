import { test, expect } from '@playwright/test';

// Pico-ETH W5500 via unified gateway (live): Arduino Wiznet5500lwIP does
// full DHCP (DISCOVER→OFFER→REQUEST→ACK) through the gateway's MACRAW path
// (_board_eth + _w5500_gw_enable + per-tick TX pump). Mirrors the owner's
// test-firmware/arduino/ethdhcp/ethdhcp.ino prove-out (busy-pump keeps
// guest time at wall pace for the async lwIP pump). Requires the gateway.
// NOTE: loop body uses real newlines — single-line `(){static ...}`
// confuses the arduino prototype generator (extern/static mismatch).
const CODE = [
  '#include <W5500lwIP.h>',
  '// Polled mode (no IRQ pin): the W5500 INTn/GPIO21 attach path is',
  '// separately suspect; DHCP proof does not need interrupts.',
  'Wiznet5500lwIP eth(17, SPI);',
  'static unsigned long spin_until(unsigned long ms) {',
  '  unsigned long t0 = millis();',
  '  while (millis() - t0 < ms) { }',
  '  return millis();',
  '}',
  'void setup() {',
  '  Serial.begin(115200);',
  '  spin_until(2000);',
  '  Serial.println("ETHDHCP-START");',
  '  bool ok = eth.begin();',
  '  Serial.println(ok ? "ETH-BEGIN-OK" : "ETH-BEGIN-FAIL");',
  '}',
  'static unsigned long last = 0;',
  'static int phase = 0;',
  'void loop() {',
  '  unsigned long now = millis();',
  '  if (now - last > 2000) {',
  '    last = now;',
  '    phase++;',
  '    Serial.print("ETH-TICK conn=");',
  '    Serial.print(eth.connected() ? 1 : 0);',
  '    Serial.print(" ip=");',
  '    Serial.println(eth.localIP());',
  '    spin_until(1500);',
  '    if (phase >= 10) Serial.println("ETHDHCP-DONE");',
  '  }',
  '}',
].join('\n');

test.describe('Pico-ETH W5500 gateway', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Pico-ETH DHCP via gateway MACRAW', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      // tickMHz 125 (owner demo default): at the 200MHz arch default the
      // guest outruns wall DHCP timers and begin() never returns; at 125
      // the full DORA completes. Engine-side quirk, flagged upstream.
      components: [
        { id: 'eth1', type: 'openhw-pico-eth', attrs: { tickMHz: '125' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 180000, serialNeedle: 'ETHDHCP-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('PICOETH verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('PICOETH serial:', (verdict.serial || '').slice(0, 2000));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('ETH-BEGIN-OK');
    // Pool starts at .2 but advances across runs/boards in the room.
    expect(verdict.serial || '').toContain('ip=192.168.4.');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
