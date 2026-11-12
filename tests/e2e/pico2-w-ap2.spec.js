import { test, expect } from '@playwright/test';

// Pico 2 W (M33/RP2350) guest SoftAP + TCP (live): board A is the guest
// SoftAP (192.168.4.1) and ALSO the TCP client; board B joins it as STA
// with a STATIC address and serves TCP. A connects to B's address.
//
// Board:      openhw-pico-2-w  ->  boards-registry.ts family 'pico_2_w'
//             (engine pico-emu, runner runners/pico-runner.ts).
// Engine:     pico-runner.ts boots the RP2350 arch (isPico2 -> arch 2/M33)
//             and enables CYW43 via _wifi_enable(1) + WS uplink + per-tick
//             TX pump (startNetLink/pumpNetLink). The CYW43 AP model
//             (BDC flags2=AP + the guest-side DHCP server) is shared with
//             the M0+ path (same engine bytes, owner folder) -> a guest
//             soft AP on the M33 behaves like the M0+ one.
// Attrs:      none required (M33 arch default clock 150MHz paces the guest;
//             tickMHz is NOT needed on the WiFi path).
// Addressing: the guest AP address is engine-fixed at 192.168.4.1
//             (softAPConfig is NOT honored by the engine - recorded in
//             matrix.md for the M0+ cell). The STA therefore takes a STATIC
//             address (WiFi.config before WiFi.begin) so the AP-side client
//             knows where to dial - the guest AP's own DHCP pool position
//             is engine-internal and must not be guessed.
// Direction:  AP -> STA (the AP is the client). The reverse direction is
//             untestable here: the gateway fast-answers ARP for 192.168.4.1
//             and would steal the AP's address from the joining STA (the
//             gateway only yields .1 once a board claims it - room.go
//             apOwner). The AP as SOURCE is immune to that collision.
// Room:       NETWORK_ROOM_CODE=netm33ap1 (own gateway room; the shared
//             :5030 gateway serves other lanes).
// Gateway:    the guest AP + the joining STA are bridged through the room's
//             gVisor VN, so the ARP/TCP frames between them are
//             gateway-side evidence.
//
// Requires the gateway running.
const APCLI_CODE = [
  '#include <WiFi.h>',
  'void setup() {',
  '  Serial1.begin(115200);',
  '  delay(1000);',
  '  Serial1.println("APC-START");',
  '  WiFi.beginAP("OpenHW-AP");',
  '  delay(3000);',
  '  Serial1.print("APC-IP:"); Serial1.println(WiFi.softAPIP());',
  '  Serial1.println("APC-LISTEN");',
  '  delay(15000);',
  '  WiFiClient client;',
  '  int ok = 0;',
  '  for (int i = 0; i < 20 && !ok; i++) {',
  '    if (client.connect(IPAddress(192, 168, 4, 20), 41001)) ok = 1;',
  '    else delay(1000);',
  '  }',
  '  Serial1.print("APC-CONN:"); Serial1.println(ok);',
  '  if (ok) {',
  '    client.print("HELLO-STA\\n");',
  '    unsigned long t0 = millis();',
  '    String reply = "";',
  '    while (millis() - t0 < 15000 && reply.length() == 0) {',
  '      while (client.available()) reply += (char)client.read();',
  '      delay(100);',
  '    }',
  '    reply.trim();',
  '    Serial1.print("APC-RX:"); Serial1.println(reply);',
  '    if (reply == "AP-ECHO2:HELLO-STA") Serial1.println("APC-AP-DONE");',
  '    client.stop();',
  '  }',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

const STASRV_CODE = [
  '#include <WiFi.h>',
  'WiFiServer server(41001);',
  'void setup() {',
  '  Serial1.begin(115200);',
  '  delay(1000);',
  '  Serial1.println("STS-START");',
  '  WiFi.config(IPAddress(192, 168, 4, 20), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  WiFi.begin("OpenHW-AP");',
  '  delay(8000);',
  '  Serial1.print("STS-STATUS="); Serial1.println(WiFi.status());',
  '  Serial1.print("STS-IP="); Serial1.println(WiFi.localIP());',
  '  server.begin();',
  '  Serial1.println("STS-LISTEN");',
  '}',
  'void loop() {',
  '  WiFiClient client = server.available();',
  '  if (client && client.connected()) {',
  '    String line = client.readStringUntil(10);',
  '    line.trim();',
  '    Serial1.print("STS-RX:"); Serial1.println(line);',
  '    client.print("AP-ECHO2:" + line + "\\n");',
  '    Serial1.println("STS-ECHOED");',
  '    delay(500);',
  '    client.stop();',
  '  }',
  '  delay(200);',
  '}',
].join('\n');

test.describe('Pico 2 W (M33) SoftAP (AP client -> STA server)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('AP-side TCP client reaches the STA server', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      // Own gateway room (the shared :5030 gateway serves other lanes).
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'netm33ap1');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'p2w_ap', type: 'openhw-pico-2-w', attrs: {}, x: 100, y: 100 },
        { id: 'p2w_sta', type: 'openhw-pico-2-w', attrs: {}, x: 500, y: 100 },
      ],
      wires: [],
      code,
    }), APCLI_CODE);
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((code) => window.OpenHWE2E.setupCircuitBoards({
      extra: { p2w_sta: code },
    }), STASRV_CODE);
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 300000, serialNeedle: 'APC-AP-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('P2WAP verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('P2WAP serial:', (verdict.serial || '').slice(0, 1200));
    expect(verdict.pass).toBe(true);
    // Guest markers: guest soft AP up, STA joined it on its static
    // address, and the echo crossed the AP<->STA link.
    expect(verdict.serial || '').toContain('APC-IP:192.168.4.1');
    expect(verdict.serial || '').toContain('STS-STATUS=3');
    expect(verdict.serial || '').toContain('STS-IP=192.168.4.20');
    expect(verdict.serial || '').toContain('STS-ECHOED');
    expect(verdict.serial || '').toContain('APC-RX:AP-ECHO2:HELLO-STA');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
