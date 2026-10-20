import { test, expect } from '@playwright/test';

// ESP32-CAM 2-board LAN TCP echo via unified gateway (live): two
// openhw-esp32-cam boards as STAs in ONE gateway room do a TCP
// client<->server echo over static addresses. Mirrors the M0+ Pico W LAN
// cell (pico-wifi-lan.spec.js) with the ESP32-CAM board type.
//
// Board:      openhw-esp32-cam  ->  boards-registry.ts family 'esp32_cam'
//             (engine esp32-emu, runner runners/esp32-runner.ts).
// Engine:     esp32-runner.ts picks the 'esp32-cam' board preset from the
//             board type (4MB flash + 4MB PSRAM); the engine dials
//             ws://127.0.0.1:5030 at boot and the STA joins the fake AP
//             'ESP-GUEST' (engine default). The guest runs the real
//             ESP-IDF lwIP stack, so TCP/IP is the GUEST's and the gateway
//             VN only bridges L2 between the two boards.
// FQBN:       openhw-esp32-cam -> kind 'esp32' -> esp32:esp32:esp32
//             (the cam SHELL is a UI/preset difference; the firmware
//             target is the core's generic ESP32 build).
// Attrs:      macAddress per board ('24:6F:28:00:00:21' / '...:22') -
//             the engine seeds the WiFi MAC + eFuse from it. WITHOUT it
//             the ESP32 STA MAC is all zeros (00:00:00:00:00:00) and
//             the gateway keys DHCP leases by client MAC, so two boards
//             in one room would be handed the SAME lease. The all-zero
//             MAC also breaks the gateway's unicast ARP replies (the
//             ESP32-CAM HTTP cell: DHCP ok, but the NAT'd connect never
//             left the board).
// Addressing: STATIC addresses 192.168.4.20 (server) / .21 (client) via
//             WiFi.config() BEFORE WiFi.begin() - verified live on this
//             preset (WiFi.config -> true, localIP 192.168.4.20, gateway
//             192.168.4.1). Static is required here: the gateway's DHCP
//             pool is global and advances across rooms/runs, so the peer
//             address must not be discovered at run time.
// Room:       NETWORK_ROOM_CODE=netcamlan1 (own gateway room; the shared
//             :5030 gateway serves other lanes).
// Gateway:    both boards are bridged into ONE gVisor VN by the room -> the
//             ARP + TCP frames between the two guest MACs are gateway-side
//             evidence.
// Scan:       the sketch scans AFTER the proof markers on purpose -
//             scanNetworks() is a blocking call and stalled once on this
//             preset under a loaded box (guest hung inside the scan), so
//             the scan stays off the proof path.
//
// Requires the gateway running.
const SERVER_CODE = [
  '#include <WiFi.h>',
  'WiFiServer server(41000);',
  'void setup() {',
  '  Serial.begin(115200);',
  '  delay(1000);',
  '  Serial.println("CSRV-START");',
  '  WiFi.config(IPAddress(192, 168, 4, 20), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  Serial.println("CSRV-CONFIG-OK");',
  '  WiFi.begin("ESP-GUEST");',
  '  Serial.println("CSRV-BEGUN");',
  '  delay(8000);',
  '  Serial.print("CSRV-STATUS="); Serial.println(WiFi.status());',
  '  Serial.print("CSRV-IP="); Serial.println(WiFi.localIP());',
  '  Serial.print("CSRV-MAC="); Serial.println(WiFi.macAddress());',
  '  server.begin();',
  '  Serial.println("CSRV-LISTEN");',
  '}',
  'void loop() {',
  '  WiFiClient client = server.available();',
  '  if (client && client.connected()) {',
  '    String line = client.readStringUntil(10);',
  '    line.trim();',
  '    Serial.print("CSRV-RX:"); Serial.println(line);',
  '    client.print("ECHO:" + line + "\\n");',
  '    Serial.println("CSRV-ECHOED");',
  '    delay(500);',
  '    client.stop();',
  '  }',
  '  delay(200);',
  '}',
].join('\n');

const CLIENT_CODE = [
  '#include <WiFi.h>',
  'void setup() {',
  '  Serial.begin(115200);',
  '  delay(1000);',
  '  Serial.println("CCLI-START");',
  '  WiFi.config(IPAddress(192, 168, 4, 21), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  Serial.println("CCLI-CONFIG-OK");',
  '  WiFi.begin("ESP-GUEST");',
  '  Serial.println("CCLI-BEGUN");',
  '  delay(8000);',
  '  Serial.print("CCLI-STATUS="); Serial.println(WiFi.status());',
  '  Serial.print("CCLI-IP="); Serial.println(WiFi.localIP());',
  '  Serial.print("CCLI-MAC="); Serial.println(WiFi.macAddress());',
  '  WiFiClient client;',
  '  int ok = 0;',
  '  Serial.println("CCLI-CONNECTING");',
  '  for (int i = 0; i < 10 && !ok; i++) {',
  '    if (client.connect(IPAddress(192, 168, 4, 20), 41000, 3000)) ok = 1;',
  '    else delay(1000);',
  '  }',
  '  Serial.print("CCLI-CONN:"); Serial.println(ok);',
  '  if (ok) {',
  '    client.print("HELLO-LAN\\n");',
  '    unsigned long t0 = millis();',
  '    String reply = "";',
  '    while (millis() - t0 < 15000 && reply.length() == 0) {',
  '      while (client.available()) reply += (char)client.read();',
  '      delay(100);',
  '    }',
  '    reply.trim();',
  '    Serial.print("CCLI-RX:"); Serial.println(reply);',
  '    if (reply == "ECHO:HELLO-LAN") Serial.println("CCLI-LAN-DONE");',
  '    client.stop();',
  '  }',
  '  Serial.println("SCAN-BEGIN");',
  '  int n = WiFi.scanNetworks();',
  '  Serial.print("SCAN n="); Serial.println(n);',
  '  Serial.println("SCAN-END");',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

test.describe('ESP32-CAM LAN (2-board TCP via gateway)', () => {
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
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'netcamlan1');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'cam_srv', type: 'openhw-esp32-cam', attrs: { macAddress: '24:6F:28:00:00:21' }, x: 100, y: 100 },
        { id: 'cam_cli', type: 'openhw-esp32-cam', attrs: { macAddress: '24:6F:28:00:00:22' }, x: 500, y: 100 },
      ],
      wires: [],
      code,
    }), SERVER_CODE);
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((code) => window.OpenHWE2E.setupCircuitBoards({
      extra: { cam_cli: code },
    }), CLIENT_CODE);
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 300000, serialNeedle: 'CCLI-LAN-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAMLAN verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('CAMLAN serial:', (verdict.serial || '').slice(0, 1500));
    expect(verdict.pass).toBe(true);
    // Guest markers: both boards joined the AP on their static addresses
    // and the echo crossed the room.
    expect(verdict.serial || '').toContain('CSRV-STATUS=3');
    expect(verdict.serial || '').toContain('CSRV-IP=192.168.4.20');
    expect(verdict.serial || '').toContain('CCLI-STATUS=3');
    expect(verdict.serial || '').toContain('CCLI-IP=192.168.4.21');
    expect(verdict.serial || '').toContain('CSRV-ECHOED');
    expect(verdict.serial || '').toContain('CCLI-RX:ECHO:HELLO-LAN');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
