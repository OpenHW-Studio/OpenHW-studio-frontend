import { test, expect } from '@playwright/test';

// Pico-W LAN via unified gateway (live): two Pico W boards as STAs in ONE
// gateway room (shared L2 hub) do TCP client↔server with static IPs.
// Server echoes; client asserts the echo. Also reports DNS resolution
// (informational on first pass). Requires the gateway.
const SERVER_CODE = [
  '#include <WiFi.h>',
  'WiFiServer server(41000);',
  'void setup() {',
  '  Serial1.begin(115200);',
  '  delay(1000);',
  '  Serial1.println("SRV-START");',
  '  WiFi.config(IPAddress(192, 168, 4, 20), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  WiFi.begin("Pico-emuNet", "testpassword");',
  '  delay(5000);',
  '  Serial1.print("SRV-STATUS="); Serial1.println(WiFi.status());',
  '  server.begin();',
  '  Serial1.println("SRV-LISTEN");',
  '}',
  'void loop() {',
  '  WiFiClient client = server.available();',
  '  if (client && client.connected()) {',
  '    String line = client.readStringUntil(10);',
  '    line.trim();',
  '    Serial1.print("SRV-RX:"); Serial1.println(line);',
  '    client.print("ECHO:" + line + "\\n");',
  '    Serial1.println("SRV-ECHOED");',
  '    delay(500);',
  '    client.stop();',
  '  }',
  '  delay(200);',
  '}',
].join('\n');

const CLIENT_CODE = [
  '#include <WiFi.h>',
  'void setup() {',
  '  Serial1.begin(115200);',
  '  delay(1000);',
  '  Serial1.println("CLI-START");',
  '  WiFi.config(IPAddress(192, 168, 4, 21), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  WiFi.begin("Pico-emuNet", "testpassword");',
  '  delay(8000);',
  '  Serial1.print("CLI-STATUS="); Serial1.println(WiFi.status());',
  '  IPAddress dns;',
  '  int dnsOk = WiFi.hostByName("example.com", dns);',
  '  Serial1.print("CLI-DNS:"); Serial1.print(dnsOk); Serial1.print(":"); Serial1.println(dns);',
  '  WiFiClient client;',
  '  int ok = 0;',
  '  for (int i = 0; i < 20 && !ok; i++) {',
  '    if (client.connect(IPAddress(192, 168, 4, 20), 41000)) ok = 1;',
  '    else delay(1000);',
  '  }',
  '  Serial1.print("CLI-CONN:"); Serial1.println(ok);',
  '  if (ok) {',
  '    client.print("HELLO-LAN\\n");',
  '    unsigned long t0 = millis();',
  '    String reply = "";',
  '    while (millis() - t0 < 15000 && reply.length() == 0) {',
  '      while (client.available()) reply += (char)client.read();',
  '      delay(100);',
  '    }',
  '    reply.trim();',
  '    Serial1.print("CLI-RX:"); Serial1.println(reply);',
  '    if (reply == "ECHO:HELLO-LAN") Serial1.println("CLI-LAN-DONE");',
  '    client.stop();',
  '  }',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

test.describe('Pico-W LAN (2-board TCP via gateway)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('STA+STA TCP echo in one gateway room', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'lanroom1');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'ap1', type: 'openhw-pico-w', attrs: {}, x: 100, y: 100 },
        { id: 'st1', type: 'openhw-pico-w', attrs: {}, x: 500, y: 100 },
      ],
      wires: [],
      code,
    }), SERVER_CODE);
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((code) => window.OpenHWE2E.setupCircuitBoards({
      extra: { st1: code },
    }), CLIENT_CODE);
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 300000, serialNeedle: 'CLI-LAN-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('LAN verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('LAN serial:', (verdict.serial || '').slice(0, 1200));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('SRV-ECHOED');
    expect(verdict.serial || '').toContain('CLI-RX:ECHO:HELLO-LAN');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
