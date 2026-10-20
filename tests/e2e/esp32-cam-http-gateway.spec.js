import { test, expect } from '@playwright/test';

// ESP32-CAM HTTP client via gateway NAT (live): the engine dials the gateway
// itself at boot (worker-proxy connectGateway); the runner only passes
// config.wifi {ssid, channel, room}. The guest takes a DHCP lease from the
// gateway, then the Arduino HTTPClient GETs a host HTTP server through the
// gateway NAT map (guest dst 10.150.211.85 -> host 127.0.0.1:8092).
//
// Board:      openhw-esp32-cam  ->  boards-registry.ts family 'esp32_cam'
//             (engine esp32-emu, runner runners/esp32-runner.ts).
// Engine:     esp32-runner.ts picks the 'esp32-cam' board preset from the
//             board type (4MB flash + 4MB PSRAM) instead of the DevKit
//             preset; the engine dials ws://127.0.0.1:5030 at boot and
//             the STA joins the fake AP 'ESP-GUEST' (engine default).
// FQBN:       the frontend resolves openhw-esp32-cam -> kind 'esp32' ->
//             esp32:esp32:esp32 (backend registry: boardRegistry.js id
//             'esp32'; the core also ships esp32:esp32:esp32cam, but the
//             frontend has no per-shell FQBN override - the cam SHELL is
//             a UI/preset difference, the firmware target is the core's
//             generic ESP32 build).
// Attrs:      macAddress '24:6F:28:00:00:11' - the engine seeds the WiFi
//             MAC + eFuse from it. WITHOUT it the ESP32 STA MAC is all
//             zeros (00:00:00:00:00:00): DHCP still completes, but the
//             gateway's ARP reply for the default gateway (192.168.4.1) is
//             unicast to that all-zero MAC and never resolves, so the
//             NAT'd HTTP connect never leaves the board (observed:
//             STATUS=3, IP=192.168.4.5, HTTP-CODE:-1).
// Room:       NETWORK_ROOM_CODE=camhttp1 (own gateway room; the DHCP pool
//             advances across runs -> assert the 192.168.4.x prefix only).
// Gateway:    the 192.168.4.x lease can only come from the gateway's gVisor
//             DHCP server, and only the gateway can translate the
//             10.150.211.85 destination -> the HTTP 200 + body below IS
//             gateway-side evidence.
// Host:       a host HTTP server must listen on 127.0.0.1:8092 and answer
//             "hello-openhw" - that is the gateway's NAT target.
// Scan:       the sketch scans AFTER the proof markers on purpose -
//             scanNetworks() is a blocking call and stalled once on this
//             preset under a loaded box (guest hung inside the scan). The
//             scan stays in the cell (visible in the serial as
//             SCAN-BEGIN/SCAN n=) but off the proof path.
//
// Requires the gateway and the host HTTP server on :8092.
const CODE = [
  '#include <WiFi.h>',
  '#include <HTTPClient.h>',
  'void setup() {',
  '  Serial.begin(115200);',
  '  delay(1000);',
  '  Serial.println("ESPCAMHTTP-START");',
  '  WiFi.begin("ESP-GUEST");',
  '  delay(8000);',
  '  Serial.print("STATUS="); Serial.println(WiFi.status());',
  '  Serial.print("IP="); Serial.println(WiFi.localIP());',
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
  '  Serial.println("SCAN-BEGIN");',
  '  int n = WiFi.scanNetworks();',
  '  Serial.print("SCAN n="); Serial.println(n);',
  '  Serial.println("SCAN-END");',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

test.describe('ESP32-CAM HTTP client via gateway NAT', () => {
  test.setTimeout(420000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('ESP32-CAM HTTP GET host server through NAT', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      // Own gateway room (shared :5030 serves other agents).
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'camhttp1');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    // Harness mount guard: a cold vite dev server can need >8s for the
    // first (dependency-optimizing) load - wait for the e2e hook instead
    // of failing on a race.
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'cam_http', type: 'openhw-esp32-cam', attrs: { macAddress: '24:6F:28:00:00:11' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 240000, serialNeedle: 'HTTP-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPCAMHTTP verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPCAMHTTP serial:', (verdict.serial || '').slice(0, 800));
    expect(verdict.pass).toBe(true);
    // Guest marker: the STA joined the AP and holds a gateway lease.
    expect(verdict.serial || '').toContain('STATUS=3');
    expect(verdict.serial || '').toContain('IP=192.168.4.');
    // Gateway-side evidence: the NAT map only exists in the gateway VN, so
    // a 200 + the host body means the request crossed the NAT.
    expect(verdict.serial || '').toContain('HTTP-CODE:200');
    expect(verdict.serial || '').toContain('HTTP-BODY:hello-openhw');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
