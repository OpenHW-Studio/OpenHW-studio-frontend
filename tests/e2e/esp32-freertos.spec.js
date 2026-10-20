import { test, expect } from '@playwright/test';

// ESP32 FreeRTOS (DevKit): a pinned task increments a counter and prints.
// Tasks run on the emulated CPU with no host tap, so no runner change.
const CODE = 'volatile int taskCount=0;\nvoid taskFn(void *p){for(;;){taskCount++;vTaskDelay(pdMS_TO_TICKS(300));}}\nvoid setup(){Serial.begin(115200);Serial.println("RTOS_READY");xTaskCreatePinnedToCore(taskFn,"cell",2048,NULL,1,NULL,1);}\nvoid loop(){Serial.print("RTOS_TASK:");Serial.println(taskCount);delay(1000);}\n';

test.describe('ESP32 FreeRTOS task', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('pinned task counter advances', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, serialNeedle: 'RTOS_TASK:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPRTOS reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPRTOS serial:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const counts = [...(verdict.serial || '').matchAll(/RTOS_TASK:(\d+)/g)].map((m) => Number(m[1]));
    console.log('ESPRTOS counts:', JSON.stringify(counts.slice(0, 8)));
    expect(counts.length).toBeGreaterThan(0);
    expect(counts[counts.length - 1]).toBeGreaterThanOrEqual(2);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
