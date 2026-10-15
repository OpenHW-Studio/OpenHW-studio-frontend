import { test, expect } from '@playwright/test';

// Pico-W HTTP client via gateway NAT (live): Arduino HTTPClient GETs a
// host HTTP server through the gateway NAT map (guest dst 10.150.211.85
// → host 127.0.0.1:8092). Asserts 200 + body. Requires the gateway and
// a host HTTP server on :8092 (see start scripts).
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

test.describe('Pico-W HTTP client via gateway NAT', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('HTTP GET host server through NAT', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'http1', type: 'openhw-pico-w', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 180000, serialNeedle: 'HTTP-DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('HTTP verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('HTTP serial:', (verdict.serial || '').slice(0, 600));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('HTTP-CODE:200');
    expect(verdict.serial || '').toContain('HTTP-BODY:hello-openhw');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
