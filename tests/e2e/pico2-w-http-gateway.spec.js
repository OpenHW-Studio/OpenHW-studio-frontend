import { test, expect } from '@playwright/test';

// Pico 2 W (M33/RP2350) HTTP client via gateway NAT (live): Arduino
// HTTPClient GETs a host HTTP server through the gateway NAT map (guest dst
// 10.150.211.85 → host 127.0.0.1:8092). Mirrors the M0+ Pico W HTTP cell
// (pico-http-gateway.spec.js) with the M33 board type.
//
// Board:      openhw-pico-2-w  →  boards-registry.ts family 'pico_2_w'
//             (engine pico-emu, runner runners/pico-runner.ts).
// Engine:     pico-runner.ts boots the RP2350 arch (isPico2 → arch 2/M33)
//             and enables CYW43 via _wifi_enable(1) + WS uplink + per-tick
//             TX pump (startNetLink/pumpNetLink); engine bytes come from the
//             owner folder (vite alias pico-emu/picoemu.wasm.js). The guest
//             lwIP routes the 10.150.211.85 destination to its gateway
//             (192.168.4.1) and the gateway VN applies the NAT map.
// Attrs:      none required (M33 arch default clock 150MHz paces the guest;
//             tickMHz is NOT needed on the WiFi path).
// Room:       NETWORK_ROOM_CODE=netm33http1 (own gateway room).
// Gateway:    the NAT map lives in the gateway (main.go createConfig:
//             NAT {"10.150.211.85": "127.0.0.1"}) → the guest reaching the
//             host server through it IS gateway-side evidence; the guest
//             lease is in the gateway's own 192.168.4.0/24 (gVisor DHCP).
// Host:       a host HTTP server must listen on 127.0.0.1:8092 and answer
//             "hello-openhw" — that is the gateway's NAT target.
//
// Requires the gateway and the host HTTP server on :8092.
const CODE = [
  '#include <WiFi.h>',
  '#include <HTTPClient.h>',
  'void setup() {',
  '  Serial1.begin(115200);',
  '  delay(1000);',
  '  Serial1.println("HTTP-START");',
  '  WiFi.begin("Pico-emuNet", "testpassword");',
  '  delay(8000);',
  '  Serial1.print("HTTP-STATUS="); Serial1.println(WiFi.status());',
  '  Serial1.print("HTTP-IP="); Serial1.println(WiFi.localIP());',
  '  HTTPClient http;',
  '  http.begin("http://10.150.211.85:8092/");',
  '  int code = http.GET();',
  '  Serial1.print("HTTP-CODE:"); Serial1.println(code);',
  '  if (code == 200) {',
  '    String body = http.getString();',
  '    body.trim();',
  '    Serial1.print("HTTP-BODY:"); Serial1.println(body);',
  '    if (body == "hello-openhw") Serial1.println("HTTP-DONE");',
  '  }',
  '  http.end();',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

test.describe('Pico 2 W (M33) HTTP client via gateway NAT', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('HTTP GET host server through NAT', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      // Own gateway room (the shared :5030 gateway serves other lanes).
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'netm33http1');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'p2w_http', type: 'openhw-pico-2-w', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 180000, serialNeedle: 'HTTP-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('P2WHTTP verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('P2WHTTP serial:', (verdict.serial || '').slice(0, 600));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('HTTP-CODE:200');
    expect(verdict.serial || '').toContain('HTTP-BODY:hello-openhw');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
