import { test, expect } from '@playwright/test';

// F1 SoftwareSerial loopback (TX D10 wired to RX D11): whatever the soft
// UART transmits is received back. Real SoftwareSerial firmware.
test.describe('STM32F1 SoftwareSerial loopback (bluepill)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('echoes bytes through a TX-RX wire', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
      ],
      wires: [
        { from: 'bp1:PB7', to: 'bp1:PB6' },
      ],
      code: '#include <SoftwareSerial.h>\nSoftwareSerial soft(PB6,PB7);\nvoid setup(){Serial.begin(9600);Serial.println("SS_READY");soft.begin(9600);}\nvoid loop(){soft.write(83);delay(50);if(soft.available()){Serial.print("SS_RX:");Serial.println((char)soft.read());}delay(500);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, serialNeedle: 'SS_RX:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('SS reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('SS serial head:', JSON.stringify((verdict.serial || '').slice(0, 300)));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('SS_RX:S');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
