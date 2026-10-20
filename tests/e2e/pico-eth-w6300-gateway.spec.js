import { test, expect } from '@playwright/test';

// WIZnet W6300 Ethernet carrier on the Pico Ethernet shells.
//
// The board attr `ethChip:'w6300'` switches the ENGINE-side chip attach
// from the W5500 to the W6300 (pico-emu board `pico-w6300`:
// QSPI-single on the PL022 path, CSn=16 / RSTn=22 / INTn=15). W5500 stays
// the default, so the existing eth shells are unchanged.
//
// The W6300's MACRAW socket 0 joins the SAME shared vnet bus as the CYW43
// (Pico W) and the W5500, so the SAME gateway room serves all three and the
// SAME DHCP pool (192.168.4.0/24) hands out the lease.
//
// Guest: Arduino W6300lwIP from the arduino-pico core's bundled
// lwIP_w6300 library (PIO+DMA QSPI transport; the emulator bridges the
// PIO path into the W6300 register model). Mirrors the engine's own
// prove-out test-firmware/arduino/ethdhcp6300/ethdhcp6300.ino.
//
// Asserted evidence (observed DORA, not self-report):
//   ETH-BEGIN-OK  -> the W6300 answered a register read (VERSIONR=0x61)
//   W6300-IP=...  -> the lease came from the GATEWAY's DHCP server
//                     (the emulator itself never speaks IP: src/w6300.c
//                     has no DHCP server; only the gateway does)
//   HTTP-CODE:200 -> TCP/IP offload through the gateway NAT works too
//
// NOTE: loop body uses real newlines — single-line `(){static ...}`
// confuses the arduino prototype generator (extern/static mismatch).
const CODE = [
  '#include <W6300lwIP.h>',
  '#include <HTTPClient.h>',
  '// W6300-EVB-Pico carrier: CSn=16, INTn=15 (RSTn=22 is engine-side).',
  '// The driver talks to the chip over PIO+DMA QSPI (wiznet_pio_qspi).',
  '// INTn is armed as a level-low GPIO interrupt, so RX can only be',
  '// delivered by the interrupt (the polled handler is not registered).',
  'Wiznet6300lwIP eth(16, SPI, 15);',
  'static unsigned long spin_until(unsigned long ms) {',
  '  unsigned long t0 = millis();',
  '  while (millis() - t0 < ms) { }',
  '  return millis();',
  '}',
  'void setup() {',
  '  Serial.begin(115200);',
  '  spin_until(2000);',
  '  Serial.println("W6300DHCP-START");',
  '  bool ok = eth.begin();',
  '  Serial.println(ok ? "ETH-BEGIN-OK" : "ETH-BEGIN-FAIL");',
  '}',
  'static bool reported = false;',
  'void loop() {',
  '  if (!reported && eth.connected()) {',
  '    reported = true;',
  '    Serial.print("W6300-IP=");',
  '    Serial.println(eth.localIP());',
  '    Serial.println("W6300DHCP-DONE");',
  '    // Second proof: real TCP traffic through the gateway NAT map',
  '    // (guest dst 10.150.211.85 -> host 127.0.0.1:8092).',
  '    HTTPClient http;',
  '    http.begin("http://10.150.211.85:8092/");',
  '    int code = http.GET();',
  '    Serial.print("HTTP-CODE:"); Serial.println(code);',
  '    if (code == 200) {',
  '      String body = http.getString();',
  '      body.trim();',
  '      Serial.print("HTTP-BODY:"); Serial.println(body);',
  '    }',
  '    http.end();',
  '    Serial.println("W6300-DONE");',
  '  }',
  '  spin_until(500);',
  '}',
].join('\n');

test.describe('Pico-ETH W6300 (ethChip attr) gateway', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('W6300 DHCP via gateway MACRAW', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      // Own gateway room (the shared :5030 serves other agents).
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'w6300room1');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      // tickMHz 125 (owner demo default): at the 200MHz arch default the
      // guest outruns the wall DHCP timers and begin() never returns.
      // ethChip 'w6300' -> engine board pico-w6300 (CS16/RST22/INT15).
      components: [
        { id: 'w6300a', type: 'openhw-pico-eth', attrs: { tickMHz: '125', ethChip: 'w6300' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 240000, serialNeedle: 'W6300-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('W6300 verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('W6300 serial:', (verdict.serial || '').slice(0, 2000));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('ETH-BEGIN-OK');
    // Gateway-side evidence: the lease comes from the gateway's own
    // 192.168.4.0/24 DHCP server. The pool advances across runs/boards
    // in the room -> assert the prefix, not a fixed host.
    expect(verdict.serial || '').toContain('W6300-IP=192.168.4.');
    // Second proof: real TCP/IP through the gateway NAT to the host HTTP
    // server (guest dst 10.150.211.85 -> host 127.0.0.1:8092).
    expect(verdict.serial || '').toContain('HTTP-CODE:200');
    expect(verdict.serial || '').toContain('HTTP-BODY:hello-openhw');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  // Same carrier on the M33 (RP2350) shell: openhw-pico-2-eth + the
  // ethChip attr -> FQBN wiznet_6300_evb_pico2 (the core's M33 variant)
  // -> the engine boots the RP2350 arch with the same W6300 board
  // attach (CSn=16 / RSTn=22 / INTn=15).
  test('W6300 DHCP via gateway MACRAW (Pico 2 / M33)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'w6300room2');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'w6300p2', type: 'openhw-pico-2-eth', attrs: { tickMHz: '125', ethChip: 'w6300' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 240000, serialNeedle: 'W6300-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('W6300-M33 verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('W6300-M33 serial:', (verdict.serial || '').slice(0, 2000));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('ETH-BEGIN-OK');
    expect(verdict.serial || '').toContain('W6300-IP=192.168.4.');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
