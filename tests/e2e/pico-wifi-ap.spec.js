import { test, expect } from '@playwright/test';

// Pico-W SoftAP via engine (live): board A runs guest SoftAP
// (WiFi.beginAP), board B joins it as STA, then TCP echo over the AP
// subnet. Same gateway room (harmless if traffic stays engine-local).
// Requires the gateway.
const AP_CODE = [
  '#include <WiFi.h>',
  'WiFiServer server(41000);',
  'void setup() {',
  '  Serial1.begin(115200);',
  '  delay(1000);',
  '  Serial1.println("AP-START");',
  '  WiFi.softAPConfig(IPAddress(192, 168, 5, 1), IPAddress(192, 168, 5, 1), IPAddress(255, 255, 255, 0));',
  '  WiFi.beginAP("OpenHW-AP");',
  '  delay(2000);',
  '  Serial1.print("AP-IP:"); Serial1.println(WiFi.softAPIP());',
  '  server.begin();',
  '  Serial1.println("AP-LISTEN");',
  '}',
  'void loop() {',
  '  WiFiClient client = server.available();',
  '  if (client && client.connected()) {',
  '    String line = client.readStringUntil(10);',
  '    line.trim();',
  '    Serial1.print("AP-RX:"); Serial1.println(line);',
  '    client.print("AP-ECHO:" + line + "\\n");',
  '    Serial1.println("AP-ECHOED");',
  '    delay(500);',
  '    client.stop();',
  '  }',
  '  delay(200);',
  '}',
].join('\n');

const STA_CODE = [
  '#include <WiFi.h>',
  'void setup() {',
  '  Serial1.begin(115200);',
  '  delay(1000);',
  '  Serial1.println("STA-START");',
  '  WiFi.begin("OpenHW-AP");',
  '  delay(8000);',
  '  Serial1.print("STA-STATUS="); Serial1.println(WiFi.status());',
  '  Serial1.print("STA-IP="); Serial1.println(WiFi.localIP());',
  '  WiFiClient client;',
  '  int ok = 0;',
  '  for (int i = 0; i < 20 && !ok; i++) {',
  '    if (client.connect(IPAddress(192, 168, 5, 1), 41000)) ok = 1;',
  '    else delay(1000);',
  '  }',
  '  Serial1.print("STA-CONN:"); Serial1.println(ok);',
  '  if (ok) {',
  '    client.print("HELLO-AP\\n");',
  '    unsigned long t0 = millis();',
  '    String reply = "";',
  '    while (millis() - t0 < 15000 && reply.length() == 0) {',
  '      while (client.available()) reply += (char)client.read();',
  '      delay(100);',
  '    }',
  '    reply.trim();',
  '    Serial1.print("STA-RX:"); Serial1.println(reply);',
  '    if (reply == "AP-ECHO:HELLO-AP") Serial1.println("STA-AP-DONE");',
  '    client.stop();',
  '  }',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

test.describe('Pico-W SoftAP (guest AP + join + TCP)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('SoftAP serve + STA join + TCP echo', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'aproom1');
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
    }), AP_CODE);
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((code) => window.OpenHWE2E.setupCircuitBoards({
      extra: { scl1: code },
    }), STA_CODE);
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 300000, serialNeedle: 'STA-AP-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('AP verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('AP serial:', (verdict.serial || '').slice(0, 1200));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('AP-ECHOED');
    expect(verdict.serial || '').toContain('STA-RX:AP-ECHO:HELLO-AP');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
