import { test, expect } from '@playwright/test';

// STM32F4 SD filesystem (live): Arduino SD.h mounts the engine-seeded
// FAT16 image (HELLO.TXT preset) and reads it back byte-exact, then
// writes + reads a new file. FS-level proof atop the green block-RW.
const CODE = '#include <SPI.h>\n#include <SD.h>\nvoid setup(){Serial.begin(9600);Serial.println("FS_READY");if(!SD.begin(PA4)){Serial.println("FS_NOINIT");return;}Serial.println("FS_INIT");File h=SD.open("HELLO.TXT",FILE_READ);if(!h){Serial.println("FS_NOOPEN");return;}while(h.available()){Serial.write(h.read());}h.close();Serial.println("FS_READ");File f=SD.open("t.txt",FILE_WRITE);f.println("hello-f4-sd");f.close();File r=SD.open("t.txt",FILE_READ);while(r.available()){Serial.write(r.read());}r.close();Serial.println("FS_DONE");}\nvoid loop(){delay(1000);}\n';

test.describe('STM32F4 SD filesystem (disco SPI1)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('mounts FAT16 and reads/writes files', async ({ page }) => {
    const clog = [];
    page.on('console', (msg) => {
      const t = msg.text();
      if (/sd|SD|spi|SPI|fault|Fault|error|Error|warn/i.test(t)) clog.push(('[' + msg.type() + '] ' + t).slice(0, 200));
    });
    page.on('pageerror', (e) => clog.push('[pageerror] ' + String(e.message).slice(0, 200)));
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f41', type: 'openhw-stm32f4', attrs: {}, x: 100, y: 100 },
        { id: 'sd1', type: 'openhw-sd-card', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'f41:PA7', to: 'sd1:MOSI' },
        { from: 'f41:PA6', to: 'sd1:MISO' },
        { from: 'f41:PA5', to: 'sd1:SCK' },
        { from: 'f41:PA4', to: 'sd1:CS' },
        { from: 'f41:3V3', to: 'sd1:VCC' },
        { from: 'f41:GND.1', to: 'sd1:GND' },
        { from: 'f41:GND.2', to: 'sd1:CD' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['sd1'], serialNeedle: 'FS_DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('FS verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('FS serial:', (verdict.serial || '').slice(0, 400));
    console.log('FS clog:', JSON.stringify(clog.slice(0, 15)));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('hello sd world');
    expect(verdict.serial || '').toContain('FS_DONE');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
