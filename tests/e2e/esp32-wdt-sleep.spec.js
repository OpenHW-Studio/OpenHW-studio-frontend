import { test, expect } from '@playwright/test';

// ESP32 watchdog + light sleep (DevKit): task-WDT bite reboots the chip
// (setup banner prints twice with a WDT reset reason); light sleep with a
// timer wakeup prints on wake. Both are engine-internal (timer-group WDT
// + RTC sleep in the wasm); no host tap, no runner change.
// UNPROBED RISK: engine wall-vs-sim time scaling may stretch the windows;
// timeouts below are generous. A silent WDT (no reboot) fails loudly.
const CODE_WDT = '#include "esp_task_wdt.h"\nvoid setup(){Serial.begin(115200);delay(200);Serial.print("WDT_BOOT reason=");Serial.println((int)esp_reset_reason());esp_task_wdt_init(1,true);esp_task_wdt_add(NULL);Serial.println("WDT_ARMED");for(;;){delay(100);}}\nvoid loop(){}\n';
const CODE_SLEEP = 'void setup(){Serial.begin(115200);delay(200);Serial.println("SLEEP_READY");esp_sleep_enable_timer_wakeup(2000000);Serial.println("SLEEP_ENTER");esp_light_sleep_start();Serial.println("SLEEP_WOKE");}\nvoid loop(){delay(2000);}\n';

test.describe('ESP32 watchdog + sleep', () => {
  test.setTimeout(400000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('task WDT bite reboots the chip', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE_WDT);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, serialNeedle: 'WDT_ARMED', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPWDT reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPWDT serial:', (verdict.serial || '').slice(0, 400));
    expect(verdict.pass).toBe(true);
    const boots = [...(verdict.serial || '').matchAll(/WDT_BOOT/g)].length;
    console.log('ESPWDT boot count:', boots);
    expect(boots).toBeGreaterThanOrEqual(2);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('light sleep wakes on the timer', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE_SLEEP);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 120000, serialNeedle: 'SLEEP_WOKE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPSLEEP reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('SLEEP_WOKE');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
