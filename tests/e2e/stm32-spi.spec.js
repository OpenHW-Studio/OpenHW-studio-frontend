import { test, expect } from '@playwright/test';

// STM32F1 SPI matrix cell (live): Blue Pill + MAX7219 8x8 matrix over
// hardware SPI1, raw register writes. Write-only traffic (no MISO reads),
// same assert shape as the AVR MAX7219 row.
// NOTE (documented gap): SPI *reads* (MFRC522 VER:92 style) need prefetch
// semantics — F1 injectMiso serves future transfers, so post-hoc observed
// responses land a transfer late. Pending a prefetch design; AVR row covers
// MFRC522 logic.
test.describe('STM32 SPI (bluepill MAX7219)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/F1 SPI DIAG|F1 GPIO DIAG/i.test(t)) console.log('CAPTURED-DIAG:', t.slice(0, 300));
      } catch { /* ignore */ }
    });
  });

  test('MAX7219 shows digits over SPI1', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
        { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'bp1:PA7', to: 'mx1:DIN' },
        { from: 'bp1:PA5', to: 'mx1:CLK' },
        { from: 'bp1:PA4', to: 'mx1:CS' },
        { from: 'bp1:SWD_3V3', to: 'mx1:VCC' },
        { from: 'bp1:SWD_GND', to: 'mx1:GND' },
      ],
      code: '#include <SPI.h>\nvoid wr(uint8_t r,uint8_t d){digitalWrite(PA4,LOW);SPI.transfer(r);SPI.transfer(d);digitalWrite(PA4,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("MX_READY");delay(300);Serial.println("MX_READY2");SPI.begin();pinMode(PA4,OUTPUT);wr(0x0C,0x01);wr(0x0A,0x08);wr(0x0B,0x07);wr(0x01,0x7E);wr(0x02,0x30);}\nvoid loop(){Serial.println("MX_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['mx1'], serialNeedle: 'MX_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1SPI reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
    expect(mx).toBeTruthy();
    const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
    console.log('MAX7219 custom:', JSON.stringify(custom).slice(0, 250));
    // Digits latched: rows 1-2 hold the written patterns (0x7E/0x30).
    const rows = custom.rows || custom.digits || custom.display || null;
    console.log('MAX7219 rows:', JSON.stringify(rows)?.slice(0, 120));
    // Tightened (proven 2026-10): the frame decodes end to end — shutdown
    // off, matrix rows carry the firmware patterns, CS closes cleanly.
    expect(custom.shutdown).toBe(false);
    expect(custom.csActive).toBe(false);
    expect(custom.matrix?.[0]).toBe(0x7E);
    expect(custom.matrix?.[1]).toBe(0x30);
    expect(Object.keys(custom).length).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
