import { test, expect } from '@playwright/test';

// AVR EEPROM cell (Uno/ATmega328P): avr-libc eeprom.h byte write + read
// back through EECR/EEDR/EEAR. Proves on-chip nonvolatile storage live.
const CODE = '#include <Arduino.h>\n#include <avr/eeprom.h>\nvoid setup(){Serial.begin(9600);Serial.println("EE_READY");eeprom_write_byte((uint8_t*)0x10,0xAB);eeprom_write_byte((uint8_t*)0x11,0xCD);uint8_t a=eeprom_read_byte((uint8_t*)0x10);uint8_t b=eeprom_read_byte((uint8_t*)0x11);Serial.print("EE_RB:");Serial.print(a,HEX);Serial.print(b,HEX);Serial.println();}\nvoid loop(){}\n';

test.describe('AVR EEPROM', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Uno writes and reads back EEPROM bytes', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 15000, serialNeedle: 'EE_RB:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('EE verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('EE serial head:', (verdict.serial || '').slice(0, 200));
    expect(verdict.pass).toBe(true);
    const m = /EE_RB:([0-9A-F]+)/.exec(verdict.serial || '');
    console.log('EE bytes:', m ? m[1] : 'NONE');
    expect(m && m[1]).toBe('ABCD');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
