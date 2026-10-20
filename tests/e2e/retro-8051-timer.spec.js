import { test, expect } from '@playwright/test';

// 8051 Timer0 IRQ (mode-1 16-bit -> vector 000Bh, asm-first, zero runner
// changes). LJMP main at 0, ISR fixed at 000Bh (DB 0 pad = NOPs), ISR
// reloads TH0/TL0 + RETI; main polls R6 vs R5 and prints M via SBUF/TI.
// Forward labels are fine on this assembler (see retro-boards.spec.js).
test.describe('Retro 8051 Timer0 IRQ', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Timer0 overflows increment the tick counter', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const lines = [
      'ORG 0',
      'LJMP main',
      ...Array(8).fill('DB 0'),
      'isr:',
      'INC R6',
      'MOV TH0, #04Ch',
      'MOV TL0, #00h',
      'RETI',
      'main:',
      'MOV TMOD, #01h',
      'MOV TH0, #04Ch',
      'MOV TL0, #00h',
      'MOV R6, #00h',
      'MOV R5, #00h',
      'SETB TR0',
      'MOV IE, #82h',
      'loop:',
      'MOV A, R6',
      'CJNE A, R5, changed',
      'SJMP loop',
      'changed:',
      'MOV R5, A',
      'MOV A, #04Dh',
      'MOV SBUF, A',
      'wt:',
      'JNB TI, wt',
      'CLR TI',
      'SJMP loop',
      'END',
    ];
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [{ id: 'r51', type: 'openhw-8051', attrs: {}, x: 100, y: 100 }],
      wires: [],
      code,
    }), lines.join('\n'));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, serialNeedle: 'MMMMMMMM', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    const ticks = ((verdict.serial || '').match(/M/g) || []).length;
    console.log('T0 ticks:', ticks, 'serial:', JSON.stringify((verdict.serial || '').slice(0, 120)));
    expect(verdict.pass).toBe(true);
    expect(ticks).toBeGreaterThanOrEqual(8);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
