import { test, expect } from '@playwright/test';
import fs from 'fs';
import { SERVER_CODE, CLIENT_CODE } from './esp32-cam-lan-sketches.js';

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
// Room:       NETWORK_ROOM_CODE=netcamcov2 (own gateway room; the shared
//             :5030 gateway serves other lanes).
// Gateway:    both boards are bridged into ONE gVisor VN by the room -> the
//             ARP + TCP frames between the two guest MACs are gateway-side
//             evidence.
// Scan:       DELIBERATELY NOT IN THE SKETCH (2026-10-20, lane/esp32-cov2).
//             scanNetworks() is a blocking call that HANGS on this preset
//             under load (the guest never returns from it), which stalled
//             the run for minutes and added a guest-side stall to the
//             proof path. It was already off the proof path (it runs after
//             the markers) and it never produced a usable value anyway
//             (SCAN n=-2 = the scan itself failed), so it is gone: the
//             cell now measures the LAN echo only.
//
// JOIN WAIT (2026-10-20, lane/esp32-cov2 — the fix for the FLAKY cell):
//   the old sketch slept a FIXED delay(8000) and then read WiFi.status().
//   The 8 s is GUEST time, but the association is completed by the
//   gateway over the host WebSocket, so how much guest time elapses
//   before the association lands depends on how loaded the box is. On a
//   loaded box the 8 s window expired before the STA was associated ->
//   STATUS=0 (not 3) and the cell went red with NO error anywhere
//   (failure signature (b): "the server never joins"). The sketch now
//   WAITS for WL_CONNECTED in a bounded guest-time loop and prints the
//   elapsed GUEST ms on every iteration (CSRV-WAIT / CCLI-WAIT), which
//   also measures the engine's guest-time rate directly from the wire.
//   The proof markers are unchanged: they are printed only AFTER the
//   association, so STATUS=3 is a real observation, never a default.
//
// Requires the gateway running.
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
    // Console capture: on a flake the runner/engine diagnostics are the only
    // way to tell WHICH side stopped draining. Dumped to a file (and the
    // tail to stdout) so a red run is diagnosable without a rerun.
    const logs = [];
    page.on('console', (m) => {
      try {
        const t = m.text();
        if (t && !/Download the React DevTools|WebSocket connection to|Failed to load resource/i.test(t)) logs.push(`[${m.type()}] ${t}`);
      } catch { /* ignore */ }
    });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${String(e?.message || e).slice(0, 200)}`));
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      // Own gateway room (the shared :5030 gateway serves other lanes).
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'netcamcov2');
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
    try { fs.writeFileSync('/tmp/opencode/esp32-cam-lan-console.log', logs.join('\n')); } catch { /* ignore */ }
    try { fs.writeFileSync('/tmp/opencode/esp32-cam-lan-serial.log', (verdict.serial || '')); } catch { /* ignore */ }
    if (!verdict.pass) {
      console.log('CAMLAN console tail:\n' + logs.slice(-120).join('\n'));
    }
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
