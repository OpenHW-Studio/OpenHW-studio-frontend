import { test, expect } from '@playwright/test';

// Pico-W SoftAP-hosted server reachable by a JOINING STA (live).
//
// Board A runs a guest SoftAP (WiFi.beginAP) and hosts a TCP echo
// server on it. Board B joins that AP as a STA and opens a TCP
// connection to the AP's own address (192.168.4.1 — the address the
// arduino-pico WiFi library hardcodes for the AP netif).
//
// The proof asserts REAL BYTES on the wire: the STA prints what the
// AP-hosted server sent back ("AP-ECHO:<payload>"), never a firmware
// self-report of "it worked".
//
// Why this needs the gateway fix: 192.168.4.1 is ALSO the unified
// gateway's address. The gateway used to answer every ARP request for
// .1 with its own MAC, so the STA's ARP for the AP was stolen and the
// connection went to the gateway instead of the AP. The gateway now
// yields .1 to a room member that claims it (a guest soft AP).
const AP_CODE = [
  '#include <WiFi.h>',
  'WiFiServer server(41010);',
  'void setup() {',
  '  Serial1.begin(115200);',
  '  delay(1000);',
  '  Serial1.println("APS-START");',
  '  WiFi.beginAP("OpenHW-AP-SERVE");',
  '  delay(3000);',
  '  Serial1.print("APS-IP:"); Serial1.println(WiFi.softAPIP());',
  '  Serial1.print("APS-MODE="); Serial1.println((int)WiFi.getMode());',
  '  server.begin();',
  '  Serial1.println("APS-LISTEN");',
  '}',
  'void loop() {',
  '  WiFiClient client = server.available();',
  '  if (client && client.connected()) {',
  '    String line = client.readStringUntil(10);',
  '    line.trim();',
  '    Serial1.print("APS-RX:"); Serial1.println(line);',
  '    client.print("AP-ECHO:" + line + "\\n");',
  '    client.flush();',
  '    Serial1.println("APS-ECHOED");',
  '    delay(500);',
  '    client.stop();',
  '  }',
  '  delay(150);',
  '}',
].join('\n');

const STA_CODE = [
  '#include <WiFi.h>',
  'void setup() {',
  '  Serial1.begin(115200);',
  '  delay(1000);',
  '  Serial1.println("APS-STA-START");',
  '  WiFi.begin("OpenHW-AP-SERVE");',
  '  delay(12000);',
  '  Serial1.print("APS-STA-STATUS="); Serial1.println(WiFi.status());',
  '  Serial1.print("APS-STA-IP="); Serial1.println(WiFi.localIP());',
  // The guest SoftAP always lands on 192.168.4.1 (arduino-pico WiFi
  // library hardcodes the AP netif address). Connect to it.
  '  IPAddress ap(192, 168, 4, 1);',
  '  WiFiClient client;',
  '  int ok = 0;',
  '  for (int i = 0; i < 20 && !ok; i++) {',
  '    if (client.connect(ap, 41010)) ok = 1;',
  '    else delay(1000);',
  '  }',
  '  Serial1.print("APS-STA-CONN="); Serial1.println(ok);',
  '  if (ok) {',
  '    client.print("HELLO-AP-SERVE\\n");',
  '    client.flush();',
  '    unsigned long t0 = millis();',
  '    String reply = "";',
  '    while (millis() - t0 < 20000 && reply.length() == 0) {',
  '      while (client.available()) reply += (char)client.read();',
  '      delay(100);',
  '    }',
  '    reply.trim();',
  '    Serial1.print("APS-STA-RX:"); Serial1.println(reply);',
  '    if (reply == "AP-ECHO:HELLO-AP-SERVE") Serial1.println("APS-STA-DONE");',
  '    client.stop();',
  '  }',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

test.describe('Pico-W SoftAP-hosted server reached by a joining STA', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('STA joins the guest AP and gets the AP-hosted TCP echo', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'aproom3');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Wait for the e2e harness to mount (a cold dev-server transform of
    // the whole app can take longer than a fixed sleep).
    await page.waitForFunction(
      () => typeof window.OpenHWE2E === 'object' && typeof window.OpenHWE2E?.setupCircuit === 'function',
      { timeout: 90000 },
    );
    await page.waitForTimeout(2000);
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
      forMs: 300000, serialNeedle: 'APS-STA-DONE', telemetryMode: 'detail',
    }));
    console.log('APS verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('APS serial:\n' + (verdict.serial || ''));
    expect(verdict.ok).toBe(true);
    // Real observed bytes, not a firmware claim: the AP-hosted server
    // echoed the STA's payload and the STA read those bytes back.
    expect(verdict.serial || '').toContain('APS-ECHOED');
    expect(verdict.serial || '').toContain('APS-RX:HELLO-AP-SERVE');
    expect(verdict.serial || '').toContain('APS-STA-RX:AP-ECHO:HELLO-AP-SERVE');
    expect(verdict.pass).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
