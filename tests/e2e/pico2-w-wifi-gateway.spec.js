import { test, expect } from '@playwright/test';

// Pico 2 W WiFi via unified gateway (live): the M33 (RP2350) Arduino
// CYW43 joins the fake AP, DHCP flows through openhw-unified-gateway
// (:5030) — no fake net, no local DHCP server.
//
// Board:      openhw-pico-2-w  →  boards-registry.ts family 'pico_2_w'
//             (engine pico-emu, runner runners/pico-runner.ts).
// Engine:     pico-runner.ts boots the RP2350 arch (isPico2 → arch 2/M33)
//             and enables CYW43 via _wifi_enable(1) + WS uplink + per-tick
//             TX pump (startNetLink/pumpNetLink); engine bytes come from
//             the owner folder (vite alias pico-emu/picoemu.wasm.js).
// Attrs:      none required — the M33 arch default clock (150MHz) paces
//             the guest; tickMHz is NOT needed on the WiFi path (only the
//             W5500 ETH path needs the 125MHz opt-in, see pico2-eth cell).
// Room:       NETWORK_ROOM_CODE=covp2w (own gateway room; the DHCP pool
//             advances across runs, so only the 192.168.4.x prefix is
//             asserted, never a fixed host).
// Gateway:    the only thing that can hand out a 192.168.4.x lease is the
//             gateway's gVisor DHCP server → the IP below IS the
//             gateway-side evidence.
//
// Requires the gateway running (see start-gateway.sh / dev startup).
const CODE = '#include <WiFi.h>\nvoid setup(){Serial1.begin(115200);delay(1000);Serial1.println("P2WIFI-START");int n=WiFi.scanNetworks();Serial1.print("SCAN n=");Serial1.println(n);WiFi.begin("Pico-emuNet","testpassword");delay(8000);Serial1.print("STATUS=");Serial1.println(WiFi.status());Serial1.print("IP=");Serial1.println(WiFi.localIP());Serial1.println("P2WIFI-DONE");}\nvoid loop(){delay(5000);}\n';

test.describe('Pico 2 W (M33) WiFi gateway', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Pico 2 W joins AP + DHCP via gateway', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      // Own gateway room (shared :5030 serves other agents).
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'covp2w');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    // Harness mount guard: a cold vite dev server can need >8s for the
    // first (dependency-optimizing) load — wait for the e2e hook instead
    // of failing on a race.
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'p2w1', type: 'openhw-pico-2-w', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, serialNeedle: 'P2WIFI-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('PICO2W verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('PICO2W serial:', (verdict.serial || '').slice(0, 600));
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
