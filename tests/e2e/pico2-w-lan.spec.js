import { test, expect } from '@playwright/test';

// Pico 2 W (M33/RP2350) LAN via unified gateway (live): two openhw-pico-2-w
// boards as STAs in ONE gateway room (shared L2 hub) do a TCP client↔server
// echo with static IPs. Mirrors the M0+ Pico W LAN cell (pico-wifi-lan.spec.js)
// with the M33 board type.
//
// Board:      openhw-pico-2-w  →  boards-registry.ts family 'pico_2_w'
//             (engine pico-emu, runner runners/pico-runner.ts).
// Engine:     pico-runner.ts boots the RP2350 arch (isPico2 → arch 2/M33),
//             enables CYW43 via _wifi_enable(1), opens the WS uplink and
//             pumps TX frames per tick (startNetLink/pumpNetLink). The CYW43
//             SDPCM model is shared with the M0+ path (same engine bytes from
//             the owner folder, vite alias pico-emu/picoemu.wasm.js), so the
//             guest lwIP does the whole TCP/IP stack and the gateway VN does
//             the L2/L3 between the two boards.
// Attrs:      none required — the M33 arch default clock (150MHz) paces the
//             guest; tickMHz is NOT needed on the WiFi path (only the W5500
//             ETH path needs the 125MHz opt-in).
// Addressing: static 192.168.4.20 (server) / .21 (client) so the peer IP is
//             known to both ends without a discovery step; the AP owner rule
//             in the gateway (room.go apOwner) keeps .1 for a guest soft AP,
//             so .20/.21 stay clear of it.
// Room:       NETWORK_ROOM_CODE=netm33lan1 (own gateway room; the shared
//             :5030 gateway serves other lanes).
// Gateway:    both boards are bridged into ONE gVisor VN by the room → the
//             ARP + TCP frames between the two guest MACs are gateway-side
//             evidence (visible in the gateway log, /tmp/gateway.log).
//
// Requires the gateway running.
const SERVER_CODE = [
  '#include <WiFi.h>',
  'WiFiServer server(41000);',
  'void setup() {',
  '  Serial1.begin(115200);',
  '  delay(1000);',
  '  Serial1.println("SRV-START");',
  '  WiFi.config(IPAddress(192, 168, 4, 20), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  WiFi.begin("Pico-emuNet", "testpassword");',
  '  delay(8000);',
  '  Serial1.print("SRV-STATUS="); Serial1.println(WiFi.status());',
  '  Serial1.print("SRV-IP="); Serial1.println(WiFi.localIP());',
  '  server.begin();',
  '  Serial1.println("SRV-LISTEN");',
  '}',
  'void loop() {',
  '  WiFiClient client = server.available();',
  '  if (client && client.connected()) {',
  '    String line = client.readStringUntil(10);',
  '    line.trim();',
  '    Serial1.print("SRV-RX:"); Serial1.println(line);',
  '    client.print("ECHO:" + line + "\\n");',
  '    Serial1.println("SRV-ECHOED");',
  '    delay(500);',
  '    client.stop();',
  '  }',
  '  delay(200);',
  '}',
].join('\n');

const CLIENT_CODE = [
  '#include <WiFi.h>',
  'void setup() {',
  '  Serial1.begin(115200);',
  '  delay(1000);',
  '  Serial1.println("CLI-START");',
  '  WiFi.config(IPAddress(192, 168, 4, 21), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  WiFi.begin("Pico-emuNet", "testpassword");',
  '  delay(8000);',
  '  Serial1.print("CLI-STATUS="); Serial1.println(WiFi.status());',
  '  Serial1.print("CLI-IP="); Serial1.println(WiFi.localIP());',
  '  WiFiClient client;',
  '  int ok = 0;',
  '  for (int i = 0; i < 20 && !ok; i++) {',
  '    if (client.connect(IPAddress(192, 168, 4, 20), 41000)) ok = 1;',
  '    else delay(1000);',
  '  }',
  '  Serial1.print("CLI-CONN:"); Serial1.println(ok);',
  '  if (ok) {',
  '    client.print("HELLO-LAN\\n");',
  '    unsigned long t0 = millis();',
  '    String reply = "";',
  '    while (millis() - t0 < 15000 && reply.length() == 0) {',
  '      while (client.available()) reply += (char)client.read();',
  '      delay(100);',
  '    }',
  '    reply.trim();',
  '    Serial1.print("CLI-RX:"); Serial1.println(reply);',
  '    if (reply == "ECHO:HELLO-LAN") Serial1.println("CLI-LAN-DONE");',
  '    client.stop();',
  '  }',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

test.describe('Pico 2 W (M33) LAN (2-board TCP via gateway)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('STA+STA TCP echo in one gateway room', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      // Own gateway room (the shared :5030 gateway serves other lanes).
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'netm33lan1');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'p2w_srv', type: 'openhw-pico-2-w', attrs: {}, x: 100, y: 100 },
        { id: 'p2w_cli', type: 'openhw-pico-2-w', attrs: {}, x: 500, y: 100 },
      ],
      wires: [],
      code,
    }), SERVER_CODE);
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((code) => window.OpenHWE2E.setupCircuitBoards({
      extra: { p2w_cli: code },
    }), CLIENT_CODE);
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 300000, serialNeedle: 'CLI-LAN-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('P2WLAN verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('P2WLAN serial:', (verdict.serial || '').slice(0, 1200));
    expect(verdict.pass).toBe(true);
    // Guest markers: both boards joined the AP and the echo crossed the room.
    expect(verdict.serial || '').toContain('SRV-STATUS=3');
    expect(verdict.serial || '').toContain('CLI-STATUS=3');
    expect(verdict.serial || '').toContain('SRV-ECHOED');
    expect(verdict.serial || '').toContain('CLI-RX:ECHO:HELLO-LAN');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
