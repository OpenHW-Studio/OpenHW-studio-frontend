import { test, expect } from '@playwright/test';

// Pico W WiFi via unified gateway (live): Arduino CYW43 joins the fake
// AP, DHCP flows through openhw-unified-gateway (:5030) — no fake net.
// Proves the owner path: _wifi_enable(1) + WS uplink + per-tick TX pump.
// Requires the gateway running (see start-gateway.sh / dev startup).
const CODE = '#include <WiFi.h>\nvoid setup(){Serial1.begin(115200);delay(1000);Serial1.println("WIFI-START");int n=WiFi.scanNetworks();Serial1.print("SCAN n=");Serial1.println(n);WiFi.begin("Pico-emuNet","testpassword");delay(8000);Serial1.print("STATUS=");Serial1.println(WiFi.status());Serial1.print("IP=");Serial1.println(WiFi.localIP());Serial1.println("WIFI-DONE");}\nvoid loop(){delay(5000);}\n';

test.describe('Pico W WiFi gateway', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Pico W joins AP + DHCP via gateway', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'pico1', type: 'openhw-pico-w', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, serialNeedle: 'WIFI-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('PICOWIFI verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('PICOWIFI serial:', (verdict.serial || '').slice(0, 400));
    expect(verdict.pass).toBe(true);
    // Gateway DHCP pool starts at .2 (presence-based, never count-based).
    expect(verdict.serial || '').toContain('STATUS=3');
    expect(verdict.serial || '').toContain('IP=192.168.4.2');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
