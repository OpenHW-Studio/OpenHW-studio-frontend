import { test, expect } from '@playwright/test';
import fs from 'fs';

// DIAGNOSTIC twin of esp32-cam-lan.spec.js: same 2-board scenario, but it
// dumps the FULL (untruncated) serial, the console log (worker + engine
// messages surface as page console events) and the verdict, so a flake can
// be diagnosed without guessing.
const SERVER_CODE = [
  '#include <WiFi.h>',
  'WiFiServer server(41000);',
  'void setup() {',
  '  Serial.begin(115200);',
  '  delay(1000);',
  '  Serial.println("CSRV-START");',
  '  WiFi.config(IPAddress(192, 168, 4, 20), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  Serial.println("CSRV-CONFIG-OK");',
  '  WiFi.begin("ESP-GUEST");',
  '  Serial.println("CSRV-BEGUN");',
  '  delay(8000);',
  '  Serial.print("CSRV-STATUS="); Serial.println(WiFi.status());',
  '  Serial.print("CSRV-IP="); Serial.println(WiFi.localIP());',
  '  Serial.print("CSRV-MAC="); Serial.println(WiFi.macAddress());',
  '  server.begin();',
  '  Serial.println("CSRV-LISTEN");',
  '}',
  'void loop() {',
  '  WiFiClient client = server.available();',
  '  if (client && client.connected()) {',
  '    String line = client.readStringUntil(10);',
  '    line.trim();',
  '    Serial.print("CSRV-RX:"); Serial.println(line);',
  '    client.print("ECHO:" + line + "\\n");',
  '    Serial.println("CSRV-ECHOED");',
  '    delay(500);',
  '    client.stop();',
  '  }',
  '  delay(200);',
  '}',
].join('\n');

const CLIENT_CODE = [
  '#include <WiFi.h>',
  'void setup() {',
  '  Serial.begin(115200);',
  '  delay(1000);',
  '  Serial.println("CCLI-START");',
  '  WiFi.config(IPAddress(192, 168, 4, 21), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  Serial.println("CCLI-CONFIG-OK");',
  '  WiFi.begin("ESP-GUEST");',
  '  Serial.println("CCLI-BEGUN");',
  '  delay(8000);',
  '  Serial.print("CCLI-STATUS="); Serial.println(WiFi.status());',
  '  Serial.print("CCLI-IP="); Serial.println(WiFi.localIP());',
  '  Serial.print("CCLI-MAC="); Serial.println(WiFi.macAddress());',
  '  WiFiClient client;',
  '  int ok = 0;',
  '  Serial.println("CCLI-CONNECTING");',
  '  for (int i = 0; i < 10 && !ok; i++) {',
  '    if (client.connect(IPAddress(192, 168, 4, 20), 41000, 3000)) ok = 1;',
  '    else delay(1000);',
  '  }',
  '  Serial.print("CCLI-CONN:"); Serial.println(ok);',
  '  if (ok) {',
  '    client.print("HELLO-LAN\\n");',
  '    unsigned long t0 = millis();',
  '    String reply = "";',
  '    while (millis() - t0 < 15000 && reply.length() == 0) {',
  '      while (client.available()) reply += (char)client.read();',
  '      delay(100);',
  '    }',
  '    reply.trim();',
  '    Serial.print("CCLI-RX:"); Serial.println(reply);',
  '    if (reply == "ECHO:HELLO-LAN") Serial.println("CCLI-LAN-DONE");',
  '    client.stop();',
  '  }',
  '  Serial.println("SCAN-BEGIN");',
  '  int n = WiFi.scanNetworks();',
  '  Serial.print("SCAN n="); Serial.println(n);',
  '  Serial.println("SCAN-END");',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

test.describe('ESP32-CAM LAN DIAG', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('diag 2-board TCP echo', async ({ page }) => {
    const logs = [];
    page.on('console', (m) => {
      const t = m.text();
      if (t && !/Download the React DevTools|WebSocket connection to|Failed to load resource/i.test(t)) {
        logs.push(`[${m.type()}] ${t}`);
      }
    });
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) logs.push(`[nav] ${f.url()}`); });
    page.on('crash', () => logs.push('[crash] page crashed'));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${String(e?.message || e).slice(0, 200)}`));
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'camdiag1');
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
    let verdict = null;
    try {
      verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 120000, serialNeedle: 'CCLI-LAN-DONE', telemetryMode: 'detail',
      }));
    } catch (err) {
      console.log('DIAG run() threw: ' + String(err?.message || err));
    }
    console.log('DIAG console:\n' + logs.slice(-150).join('\n'));
    try { fs.writeFileSync('/tmp/diag-console.log', logs.join('\n')); } catch { /* ignore */ }
    if (!verdict) {
      throw new Error('DIAG: run() failed; see console dump above');
    }
    console.log('DIAG verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines, 'wall:', verdict.wallMs);
    console.log('DIAG serial(len=' + String(verdict.serial || '').length + '):\n' + (verdict.serial || ''));
    await page.evaluate(() => window.OpenHWE2E.stop()).catch(() => {});
    await page.waitForTimeout(2000);
  });
});
