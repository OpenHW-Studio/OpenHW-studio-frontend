import { test, expect } from '@playwright/test';

// ESP32 WiFi via unified gateway (live): the engine dials the gateway
// itself at boot (worker-entry connectGateway); the runner only passes
// config.wifi {ssid, channel, room}. Arduino STA joins + DHCP via
// gateway (:5030). Requires the gateway running.
const CODE = '#include <WiFi.h>\nvoid setup(){Serial.begin(115200);delay(1000);Serial.println("ESP-WIFI-START");int n=WiFi.scanNetworks();Serial.print("SCAN n=");Serial.println(n);WiFi.begin("ESP-GUEST");delay(8000);Serial.print("STATUS=");Serial.println(WiFi.status());Serial.print("IP=");Serial.println(WiFi.localIP());Serial.println("ESP-WIFI-DONE");}\nvoid loop(){delay(5000);}\n';

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
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, serialNeedle: 'ESP-WIFI-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPWIFI verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPWIFI serial:', (verdict.serial || '').slice(0, 400));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('STATUS=3');
    expect(verdict.serial || '').toContain('IP=192.168.4.');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
