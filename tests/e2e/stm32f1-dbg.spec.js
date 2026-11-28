import { test, expect } from '@playwright/test';

// F1 Debug identity (DBGMCU) cell.
//
// The engine models the SWD debug port (src/peripherals/swd.rs: DP/AP
// access, halt/resume/step, watchpoints) and the bootloader
// (src/peripherals/bootloader.rs), but the F1 runner exposes NEITHER to
// the host — no swd_*/bootloader_* call exists in
// src/worker/runners/stm32f1-runner.ts, so there is no host-visible
// debug surface (that part of the matrix cell stays open, see
// HANDOVER-LANE-f1.md).
//
// What IS guest-visible is the debug IDENTITY block, and it is not a
// constant: the engine routes DBGMCU_IDCODE (0xE0042000) and the 96-bit
// device UID (0x1FFFF7E8) per selected chip (engine
// src/peripherals/mod.rs:289-299, read arm at mod.rs:744). The guest
// reads both and the host asserts the ENGINE's per-chip values:
//   STM32F103 family -> IDCODE 0x10016410
//   GD32F103  family -> IDCODE 0x2BA01477
// A wrong chip mapping would show up as the wrong IDCODE, so this is a
// real cross-check of the board -> chip -> engine identity chain.

const CASES = [
  { tag: 'BP', type: 'openhw-stm32-bluepill', idcode: '10016410' },
  { tag: 'GD32', type: 'openhw-stm32-gd32f103c8', idcode: '2BA01477' },
];

const CODE = `#include <Arduino.h>
#define DBG_IDCODE (*(volatile uint32_t*)0xE0042000UL)
void setup() {
  Serial.begin(9600);
  Serial.println("DBG_READY");
  uint32_t id = DBG_IDCODE;
  Serial.print("IDCODE:"); Serial.println(id, HEX);
  Serial.println("DBG_DONE");
}
void loop() { delay(500); }
`;

test.describe('F1 Debug identity (DBGMCU IDCODE + device UID)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const c of CASES) {
    test(`guest reads the engine's per-chip debug ID (${c.type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'bp1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: c.type, code: CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'DBG_DONE', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${c.tag}DBG reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${c.tag}DBG serial:`, (verdict.serial || '').slice(0, 400));
      expect(verdict.pass).toBe(true);
      const serial = verdict.serial || '';
      // The ENGINE's per-chip IDCODE (not a guest constant).
      expect(serial).toMatch(new RegExp(`IDCODE:${c.idcode}\\r?\\n`, 'i'));
    });
  }
});
