import { test, expect } from '@playwright/test';

// Pico-W SoftAP reversed (live): board A is the guest AP (.1) and ALSO the
// TCP client; board B joins as STA, gets its DHCP lease, and serves TCP.
// A connects to B's lease IP (observed .6 — engine AP DHCP is sequential
// from a fixed start; if this drifts the cell reports B's actual IP).
// Requires the gateway.
const APCLI_CODE = [
  '#include <WiFi.h>',
  'void setup() {',
  '  Serial1.begin(115200);',
  '  delay(1000);',
  '  Serial1.println("APC-START");',
  '  WiFi.beginAP("OpenHW-AP2");',
  '  delay(2000);',
  '  Serial1.print("APC-IP:"); Serial1.println(WiFi.softAPIP());',
  '  Serial1.println("APC-LISTEN");',
  '  delay(15000);',
  '  WiFiClient client;',
  '  int ok = 0;',
  '  for (int i = 0; i < 20 && !ok; i++) {',
  '    if (client.connect(IPAddress(192, 168, 4, 6), 41001)) ok = 1;',
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
  '  WiFi.begin("OpenHW-AP2");',
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

test.describe('Pico-W SoftAP reversed (AP clients to STA server)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('AP-side TCP client reaches STA server', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'aproom2');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'sap1', type: 'openhw-pico-w', attrs: {}, x: 100, y: 100 },
        { id: 'scl1', type: 'openhw-pico-w', attrs: {}, x: 500, y: 100 },
      ],
      wires: [],
      code,
    }), APCLI_CODE);
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((code) => window.OpenHWE2E.setupCircuitBoards({
      extra: { scl1: code },
    }), STASRV_CODE);
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 300000, serialNeedle: 'APC-AP-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('APR verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('APR serial:', (verdict.serial || '').slice(0, 1200));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('STS-ECHOED');
    expect(verdict.serial || '').toContain('APC-RX:AP-ECHO2:HELLO-STA');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
