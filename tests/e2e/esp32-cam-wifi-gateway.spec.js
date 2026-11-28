import { test, expect } from '@playwright/test';

// ESP32-CAM WiFi via unified gateway (live): the engine dials the gateway
// itself at boot (worker-proxy connectGateway); the runner only passes
// config.wifi {ssid, channel, room}. Arduino STA joins + DHCP via
// gateway (:5030).
//
// Board:      openhw-esp32-cam  →  boards-registry.ts family 'esp32_cam'
//             (engine esp32-emu, runner runners/esp32-runner.ts).
// Engine:     esp32-runner.ts picks the 'esp32-cam' board preset from the
//             board type (4MB flash + 4MB PSRAM) instead of the DevKit
//             preset; the engine dials ws://127.0.0.1:5030 at boot and
//             the STA joins the fake AP 'ESP-GUEST' (engine default).
// FQBN:       the frontend resolves openhw-esp32-cam → kind 'esp32' →
//             esp32:esp32:esp32 (backend registry: boardRegistry.js id
//             'esp32'; the core also ships esp32:esp32:esp32cam, but the
//             frontend has no per-shell FQBN override — the cam SHELL is
//             a UI/preset difference, the firmware target is the core's
//             generic ESP32 build).
// Attrs:      none required (the cam preset rides the board type, not an
//             attr; tickMHz is not needed on the WiFi path).
// Room:       NETWORK_ROOM_CODE=covcam (own gateway room; the DHCP pool
//             advances across runs → assert the 192.168.4.x prefix only).
// Gateway:    the 192.168.4.x lease can only come from the gateway's gVisor
//             DHCP server → the IP below IS the gateway-side evidence.
// Scan:       the sketch scans AFTER the proof markers on purpose —
//             scanNetworks() is a blocking call and stalled once on this
//             preset under a loaded box (guest hung inside the scan and
//             the join+DHCP evidence was lost with it). The scan stays in
//             the cell (visible in the serial as SCAN-BEGIN/SCAN n=) but
//             off the proof path — post-join it reports n=-2 (no AP
//             record) on this preset, which is why it is not asserted.
//
// Requires the gateway running.
const CODE = '#include <WiFi.h>\nvoid setup(){Serial.begin(115200);delay(1000);Serial.println("ESPCAM-START");WiFi.begin("ESP-GUEST");delay(8000);Serial.print("STATUS=");Serial.println(WiFi.status());Serial.print("IP=");Serial.println(WiFi.localIP());Serial.println("ESPCAM-DONE");Serial.println("SCAN-BEGIN");int n=WiFi.scanNetworks();Serial.print("SCAN n=");Serial.println(n);Serial.println("SCAN-END");}\nvoid loop(){delay(5000);}\n';

test.describe('ESP32-CAM WiFi gateway', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('ESP32-CAM joins AP + DHCP via gateway', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      // Own gateway room (shared :5030 serves other agents).
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'covcam');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    // Harness mount guard: a cold vite dev server can need >8s for the
    // first (dependency-optimizing) load — wait for the e2e hook instead
    // of failing on a race.
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'cam1', type: 'openhw-esp32-cam', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, serialNeedle: 'ESPCAM-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPCAMWIFI verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPCAMWIFI serial:', (verdict.serial || '').slice(0, 600));
    expect(verdict.pass).toBe(true);
    // Guest markers: AP join (STATUS=3 = WL_CONNECTED) + a DHCP lease.
    expect(verdict.serial || '').toContain('STATUS=3');
    // Gateway-side evidence: the lease lives in the gateway's own
    // 192.168.4.0/24 subnet (gVisor DHCP). Pool starts at .2 but advances
    // across runs/boards in the room → assert the prefix, not a host.
    expect(verdict.serial || '').toContain('IP=192.168.4.');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
