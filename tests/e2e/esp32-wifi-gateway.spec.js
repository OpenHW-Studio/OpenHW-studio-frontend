import { test, expect } from '@playwright/test';

// ESP32 WiFi via unified gateway (live): the engine dials the gateway
// itself at boot (worker-entry connectGateway); the runner only passes
// config.wifi {ssid, channel, room}. Arduino STA joins + DHCP via
// gateway (:5030). Requires the gateway running.
// NOTE: scanNetworks() works, but ONLY before the station associates.
// Measured 2026-11-03: a fresh STA (mode+disconnect, no begin) returns
// `SCAN n=1` in ~5 s wall; the same scan issued AFTER WiFi.begin() stalls
// the guest for minutes and then yields `SCAN n=-2` (WIFI_SCAN_FAILED).
// The cell therefore scans first (proving the scan path and how many
// networks the engine's internal AP puts on the air) and then joins, so
// neither proof can be swallowed by the other. See the P6 ask in
// vendor/emulator-hook-specs/esp32-emu.md.
const CODE = '#include <WiFi.h>\nvoid setup(){Serial.begin(115200);delay(1000);Serial.println("ESP-WIFI-START");WiFi.mode(WIFI_STA);WiFi.disconnect();delay(200);int n=WiFi.scanNetworks();Serial.print("SCAN n=");Serial.println(n);WiFi.begin("ESP-GUEST");delay(8000);Serial.print("STATUS=");Serial.println(WiFi.status());Serial.print("IP=");Serial.println(WiFi.localIP());Serial.println("ESP-WIFI-DONE");}\nvoid loop(){delay(5000);}\n';

test.describe('ESP32 WiFi gateway', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('ESP32 joins AP + DHCP via gateway', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: { macAddress: '24:6F:28:00:00:31' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 45000, serialNeedle: 'ESP-WIFI-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPWIFI verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPWIFI serial:', (verdict.serial || '').slice(0, 400));
    expect(verdict.pass).toBe(true);
    // Scan (pre-join): the engine's internal AP answers, so >=1 network.
    const scanN = Number((verdict.serial || '').match(/SCAN n=(-?\d+)/)?.[1]);
    expect(Number.isFinite(scanN)).toBe(true);
    expect(scanN).toBeGreaterThanOrEqual(1);
    expect(verdict.serial || '').toContain('STATUS=3');
    expect(verdict.serial || '').toContain('IP=192.168.4.');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
