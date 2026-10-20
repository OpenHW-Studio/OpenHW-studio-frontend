import { test, expect } from '@playwright/test';

// Pico 2 ETH (W5500) via unified gateway (live): the M33 (RP2350) Arduino
// Wiznet5500lwIP does a full DHCP (DISCOVER→OFFER→REQUEST→ACK) through the
// gateway's MACRAW path (_board_eth + _w5500_gw_enable + per-tick TX pump).
//
// Board:      openhw-pico-2-eth  →  boards-registry.ts family 'pico_2_eth'
//             (engine pico-emu, runner runners/pico-runner.ts).
// Engine:     pico-runner.ts boots the RP2350 arch (isPico2 → arch 2/M33),
//             enables the W5500 on SPI (boardSpi attr, 0 default) and
//             pumps raw frames to the gateway (:5030); engine bytes come
//             from the owner folder (vite alias pico-emu/picoemu.wasm.js).
// Attrs:      tickMHz '125' — REQUIRED (same engine-side quirk as the
//             M0+ ETH cell): at the 200MHz arch default the guest
//             outruns the wall DHCP timers and begin() never returns.
//             Engine-side quirk, flagged upstream.
// Room:       NETWORK_ROOM_CODE=covp2e (own gateway room; the DHCP pool
//             advances across runs → assert the 192.168.4.x prefix only).
// Gateway:    the 192.168.4.x lease can only come from the gateway's gVisor
//             DHCP server → the IP below IS the gateway-side evidence.
//
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
  '  Serial.println("P2ETHDHCP-START");',
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
  '    if (phase >= 10) Serial.println("P2ETHDHCP-DONE");',
  '  }',
  '}',
].join('\n');

test.describe('Pico 2 ETH (M33) W5500 gateway', () => {
  test.setTimeout(420000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Pico 2 ETH DHCP via gateway MACRAW', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      // Own gateway room (shared :5030 serves other agents).
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'covp2e');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    // Harness mount guard: a cold vite dev server can need >8s for the
    // first (dependency-optimizing) load — wait for the e2e hook instead
    // of failing on a race.
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      // tickMHz 125 (owner demo default): at the 200MHz arch default the
      // guest outruns wall DHCP timers and begin() never returns; at 125
      // the full DORA completes. Engine-side quirk, flagged upstream.
      components: [
        { id: 'p2e1', type: 'openhw-pico-2-eth', attrs: { tickMHz: '125' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 180000, serialNeedle: 'P2ETHDHCP-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('PICO2ETH verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('PICO2ETH serial:', (verdict.serial || '').slice(0, 2000));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('ETH-BEGIN-OK');
    // Gateway-side evidence: the lease comes from the gateway's own
    // 192.168.4.0/24 DHCP. Pool starts at .2 but advances across
    // runs/boards in the room → assert the prefix, not a fixed host.
    expect(verdict.serial || '').toContain('ip=192.168.4.');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
