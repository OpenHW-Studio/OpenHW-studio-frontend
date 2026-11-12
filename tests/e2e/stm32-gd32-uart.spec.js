import { test, expect } from '@playwright/test';

// GD32 bring-up: hardware-UART hello cell for all three GD32 board types.
// Mirrors the multi-board-uart blink row (openhw-stm32-gd32f103cb already
// green there on PA9/PA10); c8/rb share the identical pin shell
// (component-registry pin maps) and the same stm32f1-runner USART1 path,
// so the cell is board-id-only. Real firmware via backend compile;
// serial needle is the proof.
const TYPES = [
  { tag: 'GC8', type: 'openhw-stm32-gd32f103c8' },
  { tag: 'GCB', type: 'openhw-stm32-gd32f103cb' },
  { tag: 'GRB', type: 'openhw-stm32-gd32f103rb' },
];

test.describe('GD32 hardware UART hello (live)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type } of TYPES) {
    test(`UART TX prints hello (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const needle = `HELLO_${tag}`;
      const setup = await page.evaluate(({ t, n }) => window.OpenHWE2E.setupCircuit({
        components: [{ id: 'gd1', type: t, attrs: {}, x: 100, y: 100 }],
        wires: [],
        code: `void setup(){Serial.begin(115200);Serial.println("${n}");}\nvoid loop(){Serial.println("${n}");delay(1000);}\n`,
      }), { t: type, n: needle });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate((n) => window.OpenHWE2E.run({
        forMs: 25000, serialNeedle: n, telemetryMode: 'detail',
      }), needle);
      console.log(`${tag}UART verdict:`, JSON.stringify({
        pass: verdict.pass, reasons: verdict.reasons,
        serialLines: verdict.serialLines, serialHead: (verdict.serial || '').slice(0, 200),
      }));
      expect(verdict.ok).toBe(true);
      expect(verdict.pass).toBe(true);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
