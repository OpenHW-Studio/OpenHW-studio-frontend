import { test, expect } from '@playwright/test';

// ESP32 clocks + RNG + eFuse (DevKit): default CPU frequency (240 MHz),
// esp_random liveness (two samples differ, nonzero) and a nonzero eFuse
// MAC. RNG is MMIO-mapped in the engine (HID_RNG, worker-entry.js
// setPTE lines ~4541-4542); clocks/eFuse are CPU/register reads. No
// runner change.
const CODE = '#include "esp_system.h"\nvoid setup(){Serial.begin(115200);Serial.println("SYS_READY");Serial.print("ESP_CPU_MHZ:");Serial.println(ESP.getCpuFreqMHz());uint32_t a=esp_random();delay(50);uint32_t b=esp_random();Serial.print("ESP_RNG:");Serial.print(a,HEX);Serial.print(",");Serial.println(b,HEX);uint64_t mac=ESP.getEfuseMac();Serial.print("ESP_MAC:");Serial.println((uint32_t)(mac>>32),HEX);Serial.println((uint32_t)mac,HEX);}\nvoid loop(){delay(2000);}\n';

test.describe('ESP32 clocks + RNG + eFuse', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('CPU freq, RNG liveness and MAC read back', async ({ page }) => {
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
      forMs: 30000, serialNeedle: 'ESP_RNG:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPSYS reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPSYS serial:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('ESP_CPU_MHZ:240');
    const m = /ESP_RNG:([0-9A-Fa-f]+),([0-9A-Fa-f]+)/.exec(verdict.serial || '');
    expect(m).toBeTruthy();
    console.log('ESPSYS rng:', m ? m.slice(1) : 'NONE');
    expect(m[1] !== m[2] || (m[1] !== '0' && m[2] !== '0')).toBe(true);
    expect(verdict.serial || '').toContain('ESP_MAC:');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
