import { test, expect } from '@playwright/test';

// Pico 2 ETH (M33/RP2350) HTTP client via gateway NAT (live): the Arduino
// W5500lwIP stack takes a DHCP lease from the unified gateway and the
// guest lwIP routes the 10.150.211.85 destination to its gateway
// (192.168.4.1); the gateway VN applies the NAT map
// (10.150.211.85 -> 127.0.0.1) and the host HTTP server on :8092 answers.
//
// Board:      openhw-pico-2-eth  ->  boards-registry.ts family 'pico_2_eth'
//             (engine pico-emu, runner runners/pico-runner.ts).
// Engine:     pico-runner.ts boots the RP2350 arch (isPico2 -> arch 2/M33),
//             enables the W5500 on SPI (boardSpi attr, 0 default) and pumps
//             raw frames to the gateway (:5030) per tick; engine bytes come
//             from the owner folder (vite alias pico-emu/picoemu.wasm.js).
// Attrs:      tickMHz '125' - REQUIRED (same engine-side quirk as the M0+
//             ETH cell and the M33 ETH DHCP cell): at the 200MHz arch
//             default the guest outruns the wall DHCP timers and
//             begin() never returns. Engine-side quirk, flagged upstream.
// Room:       NETWORK_ROOM_CODE=m33ethhttp (own gateway room; the DHCP
//             pool advances across runs -> assert the 192.168.4.x prefix).
// Gateway:    the 192.168.4.x lease can only come from the gateway's gVisor
//             DHCP server, and only the gateway can translate the
//             10.150.211.85 destination -> the HTTP 200 + body below IS
//             gateway-side evidence.
// Host:       a host HTTP server must listen on 127.0.0.1:8092 and answer
//             "hello-openhw" - that is the gateway's NAT target.
//
// NOTE: loop body uses real newlines - single-line `(){static ...}`
// confuses the arduino prototype generator (extern/static mismatch).
const CODE = [
  '#include <W5500lwIP.h>',
  '#include <HTTPClient.h>',
  'Wiznet5500lwIP eth(17, SPI);',
  'static unsigned long spin_until(unsigned long ms) {',
  '  unsigned long t0 = millis();',
  '  while (millis() - t0 < ms) { }',
  '  return millis();',
  '}',
  'void setup() {',
  '  Serial.begin(115200);',
  '  spin_until(2000);',
  '  Serial.println("P2ETHHTTP-START");',
  '  bool ok = eth.begin();',
  '  Serial.println(ok ? "ETH-BEGIN-OK" : "ETH-BEGIN-FAIL");',
  '  for (int i = 0; i < 40 && !eth.connected(); i++) spin_until(1000);',
  '  Serial.print("ETH-IP="); Serial.println(eth.localIP());',
  '  Serial.print("ETH-GW="); Serial.println(eth.gatewayIP());',
  '  HTTPClient http;',
  '  http.setTimeout(20000);',
  '  http.begin("http://10.150.211.85:8092/");',
  '  int code = http.GET();',
  '  Serial.print("HTTP-CODE:"); Serial.println(code);',
  '  if (code == 200) {',
  '    String body = http.getString();',
  '    body.trim();',
  '    Serial.print("HTTP-BODY:"); Serial.println(body);',
  '    if (body == "hello-openhw") Serial.println("HTTP-DONE");',
  '  }',
  '  http.end();',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

test.describe('Pico 2 ETH (M33) HTTP client via gateway NAT', () => {
  test.setTimeout(420000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('W5500 HTTP GET host server through NAT', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      // Own gateway room (the shared :5030 gateway serves other lanes).
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'm33ethhttp');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    // Harness mount guard: a cold vite dev server can need >8s for the
    // first (dependency-optimizing) load - wait for the e2e hook instead
    // of failing on a race.
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      // tickMHz 125: at the 200MHz arch default the guest outruns the wall
      // DHCP timers and begin() never returns (engine-side quirk).
      components: [
        { id: 'p2e_http', type: 'openhw-pico-2-eth', attrs: { tickMHz: '125' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 240000, serialNeedle: 'HTTP-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('P2ETHHTTP verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('P2ETHHTTP serial:', (verdict.serial || '').slice(0, 1200));
    expect(verdict.pass).toBe(true);
    // Guest marker: the W5500 stack came up and took a lease.
    expect(verdict.serial || '').toContain('ETH-BEGIN-OK');
    expect(verdict.serial || '').toContain('ETH-IP=192.168.4.');
    // Gateway-side evidence: the NAT map only exists in the gateway VN,
    // so a 200 + the host body means the request crossed the NAT.
    expect(verdict.serial || '').toContain('HTTP-CODE:200');
    expect(verdict.serial || '').toContain('HTTP-BODY:hello-openhw');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
