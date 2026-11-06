import { test, expect } from '@playwright/test';

// F4 HTTP client via gateway NAT (live): the owner's eth_http.bin does
// DHCP then TCP to 10.150.211.85:8092 (gateway NAT → host :8092) and
// prints the byte count. Polling firmware — no ethIrq attr (default
// off is correct here). Requires the gateway + host HTTP on :8092.
const CODE = 'void setup() {}\nvoid loop() {}\n';

test.describe('F4 HTTP client via gateway NAT', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('F407 HTTP GET host server through NAT', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f41', type: 'openhw-stm32f4', attrs: { firmware: '/firmware/f4/eth_http.bin' }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 480000, serialNeedle: 'hello-openhw', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F4HTTP verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F4HTTP serial:', (verdict.serial || '').slice(0, 900));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('TCP connected');
    expect(verdict.serial || '').toContain('HTTP/1.1 200 OK');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
