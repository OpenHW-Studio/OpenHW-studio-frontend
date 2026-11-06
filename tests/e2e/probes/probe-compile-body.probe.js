import { test, expect } from '@playwright/test';

// PROBE (lane/pico-cov): capture the EXACT source the frontend sends to
// /api/compile for a Pico board (the Serial->Serial1 rewrite is applied
// client-side, so the request body is the truth).
test.describe('PROBE compile source', () => {
  test.setTimeout(180000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('capture pico compile body', async ({ page }) => {
    const bodies = [];
    page.on('request', async (req) => {
      if (req.url().includes('/api/compile')) {
        try { bodies.push(JSON.parse(req.postData() || '{}')); } catch { bodies.push({ raw: req.postData() }); }
      }
    });
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const code = 'void setup(){Serial.begin(9600);Serial.print("PICO_FCPU:");Serial.println(F_CPU);}\nvoid loop(){delay(1000);}\n';
    const setup = await page.evaluate((cd) => window.OpenHWE2E.setupCircuit({
      components: [{ id: 'pico1', type: 'openhw-pico', attrs: {}, x: 100, y: 100 }],
      wires: [],
      code: cd,
    }), code);
    expect(setup.ok).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.run({ forMs: 6000, serialNeedle: 'X' }));
    console.log('PROBE5 fqbn:', bodies.map((b) => b.fqbn));
    console.log('PROBE5 code:', JSON.stringify(bodies.map((b) => b.code)));
    console.log('PROBE5 files:', JSON.stringify(bodies.map((b) => (b.files || []).map((f) => f.content))));
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1000);
  });
});
