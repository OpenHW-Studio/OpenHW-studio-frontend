import { test, expect } from '@playwright/test';

// 6502 VIA T1 timer IRQ (continuous mode -> IRQ, asm-first, zero runner
// changes). ISR rides at origin+3 (JMP main is 3 bytes); vectors written
// at runtime via STA $FFFE/F (load cannot reach them). T1 latch 0010h,
// ACR bit6 continuous, IER C0h (set + T1). Ends in JMP loop, NOT BRK
// (BRK vectors into runaway execution — see retro-gpio.spec.js NOTE).
test.describe('Retro 6502 VIA timer IRQ', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('VIA T1 IRQs increment the tick counter', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const asm = [
      'ORG 0',
      'JMP main',
      'isr:',
      'PHA',
      'LDA $6004',
      'INC $10',
      'PLA',
      'RTI',
      'main:',
      'SEI',
      'LDA #$40',
      'STA $600B',
      'LDA #$10',
      'STA $6006',
      'LDA #$00',
      'STA $6007',
      'LDA #$10',
      'STA $6004',
      'LDA #$00',
      'STA $6005',
      'LDA #$C0',
      'STA $600E',
      'LDA #3',
      'STA $FFFE',
      'LDA #0',
      'STA $FFFF',
      'STA $10',
      'STA $11',
      'CLI',
      'loop:',
      'LDA $10',
      'CMP $11',
      'BEQ loop',
      'STA $11',
      'LDA #\'V\'',
      'STA $01',
      'JMP loop',
      'END',
    ].join('\n');
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [{ id: 'r65', type: 'openhw-6502', attrs: {}, x: 100, y: 100 }],
      wires: [],
      code,
    }), asm);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, serialNeedle: 'VVVVVVVV', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    const ticks = ((verdict.serial || '').match(/V/g) || []).length;
    console.log('VIA ticks:', ticks, 'serial:', JSON.stringify((verdict.serial || '').slice(0, 120)));
    expect(verdict.pass).toBe(true);
    expect(ticks).toBeGreaterThanOrEqual(8);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
