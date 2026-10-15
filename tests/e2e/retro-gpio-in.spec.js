import { test, expect } from '@playwright/test';

// Retro GPIO input (8086emu, asm-first): slide-switch preset HIGH wired to
// L2 (PPI PA bit 2, mask 04h) with the 8255 in input mode; firmware polls and prints.
// Proves the host→guest input path (setGpioInput → ppi_set_input latch).
test.describe('Retro GPIO input (8086emu, asm-first)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('switch HIGH on L2 reaches 8086 PPI PA0', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/IN diag|RAIL diag|SW2SET|SW2ZERO|RetroRunner|engine unavailable|Emulator|error|warn/i.test(t)) console.log('CAPTURED-DIAG:', t.slice(0, 300));
      } catch { /* ignore */ }
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'r86', type: 'openhw-8086', attrs: {}, x: 100, y: 100 },
        { id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '1' }, x: 450, y: 120 },
      ],
      wires: [
        { from: 'r86:SWD_3V3', to: 'sw1:3' },
        { from: 'r86:SWD_GND', to: 'sw1:1' },
        { from: 'sw1:2', to: 'r86:L2' },
      ],
      code: `ORG 100h\nMOV AL, 90h\nOUT 0E3h, AL\nwait:\nIN AL, 0E0h\nTEST AL, 04h\nJZ wait\nMOV DX, OFFSET msg\nMOV AH, 09h\nINT 21h\nHLT\nmsg: DB 'SW86$'\nEND`,
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, serialNeedle: 'SW86', telemetryMode: 'detail',
    }));
    console.log('r86-gpio-in verdict:', JSON.stringify({
      pass: verdict.pass, reasons: verdict.reasons,
      serialHead: (verdict.serial || '').slice(0, 60),
    }));
    expect(verdict.ok).toBe(true);
    console.log('r86-pageerrors:', JSON.stringify(errors).slice(0, 400));
    expect(verdict.pass).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
