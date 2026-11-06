import { test, expect } from '@playwright/test';

// F1 system blocks, part 2: PWR (sleep/stop) + Clocks (RCC clock tree).
// The IWDG / EXTI / BKP cells live in stm32f1-sys.spec.js and the CRC cell
// in stm32f1-crc.spec.js.
//
// PWR (engine src/peripherals/pwr.rs):
//   The PWR block models the POWER-VOLTAGE-DETECTOR (PVD): the guest
//   enables PVDE + a PLS threshold and the engine computes PVDO (the
//   PWR->CSR bit 2) from its MODELED SUPPLY VOLTAGE. The host sets that
//   supply (board attr `supplyMv` -> the engine's pwr_set_supply_mv), so
//   the guest's PVDO level is a host-side environment change observed
//   through the guest's own register read.
//
//   SLEEP/STOP is NOT reachable on the F1 today: the engine's WFI arm
//   only parks the core when `deliver_irqs` is on and the product path
//   leaves it off (engine src/cpu/mod.rs:122 `deliver_irqs: false`;
//   src/cpu/thumb.rs:2136-2148 "without delivery this is a plain nop
//   (polling path)"), so the power-mode mirror stays RUN and the
//   guest's WFI returns immediately. The cell asserts the PVD path, not
//   a sleep state (see HANDOVER-LANE-f1.md).
//
// CLOCKS (engine src/peripherals/rcc.rs):
//   The engine decodes SYSCLK from CFGR (SWS/PLLSRC/PLLMUL) and the runner
//   reports the decoded value as F1RCC_HZ:<hz> whenever it changes. The
//   guest therefore reconfigures the clock tree twice (PLL x4 = 32 MHz,
//   then PLL x9 = 72 MHz) and the host asserts BOTH decoded frequencies
//   appear: the number is the engine's answer to the guest's RCC writes,
//   not the guest's own claim. The guest additionally reads CFGR back:
//   the engine mirrors SW into SWS (CFGR[3:2]), a value the guest never
//   wrote, so the readback proves the RCC model decoded the write.

const PWR_CODE = `#include <Arduino.h>
#define PWR_CR  (*(volatile uint32_t*)0x40007000UL)
#define PWR_CSR (*(volatile uint32_t*)0x40007004UL)
void setup() {
  Serial.begin(9600);
  Serial.println("PWR_READY");
  // PVD on, PLS = 0 -> 2200 mV threshold (RM0008).
  PWR_CR = (1UL << 4);
  uint32_t cr = PWR_CR;
  uint32_t csr = PWR_CSR;
  Serial.print("CR:"); Serial.println(cr, HEX);
  Serial.print("CSR:"); Serial.println(csr, HEX);
  Serial.print("PVDO:"); Serial.println((csr >> 2) & 1);
  Serial.println("PWR_DONE");
}
void loop() { delay(500); }
`;

const CLK_CODE = `#include <Arduino.h>
#define RCC_CFGR (*(volatile uint32_t*)0x40021004UL)
void setup() {
  Serial.begin(9600);
  Serial.println("CLK_READY");
  // Boot configuration written by the Arduino core (PLL x9 = 72 MHz).
  uint32_t boot = RCC_CFGR;
  Serial.print("BOOTCFGR:"); Serial.println(boot, HEX);
  // Reconfigure: PLL (HSE 8 MHz) x4 = 32 MHz.
  RCC_CFGR = (2UL) | (1UL << 16) | (2UL << 18);
  uint32_t c1 = RCC_CFGR;
  Serial.print("CFGR32:"); Serial.println(c1, HEX);
  Serial.print("SWS32:"); Serial.println((c1 >> 2) & 3);
  delay(300);
  // Back to PLL x9 = 72 MHz.
  RCC_CFGR = (2UL) | (1UL << 16) | (7UL << 18);
  uint32_t c2 = RCC_CFGR;
  Serial.print("CFGR72:"); Serial.println(c2, HEX);
  unsigned long m0 = millis();
  delay(2000);
  unsigned long m1 = millis();
  Serial.print("MILLIS0:"); Serial.println(m0);
  Serial.print("MILLIS1:"); Serial.println(m1);
  Serial.println("CLK_DONE");
}
void loop() { delay(500); }
`;

test.describe('F1 PWR + Clocks (guest MMIO + engine-side observation)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const pvd of [
    { tag: 'LOW', supplyMv: 2000, want: 1 },
    { tag: 'NOM', supplyMv: 0, want: 0 },
  ]) {
    test(`PWR: PVDO follows the modeled supply (${pvd.tag} ${pvd.supplyMv || 'default 3300'} mV)`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ code, mv }) => window.OpenHWE2E.setupCircuit({
        components: [
          // supplyMv: the engine's modeled supply voltage (mV). 0 = the
          // engine default (3300 mV).
          { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: mv ? { supplyMv: mv } : {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { code: PWR_CODE, mv: pvd.supplyMv });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'PWR_DONE', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`F1PWR-${pvd.tag} reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`F1PWR-${pvd.tag} serial:`, (verdict.serial || '').slice(0, 500));
      expect(verdict.pass).toBe(true);
      const serial = verdict.serial || '';
      // The engine's PWR model stored the guest's PVDE write (CR = 0x10).
      expect(serial).toMatch(/CR:10\r?\n/i);
      // PVDO (CSR bit 2) is the ENGINE's computation over the modeled
      // supply: below the 2200 mV PLS threshold -> 1, above -> 0.
      expect(serial).toMatch(new RegExp(`PVDO:${pvd.want}\\r?\\n`));
    });
  }

  test('Clocks: RCC model decodes the guest clock-tree writes (32 MHz / 72 MHz)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CLK_CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, serialNeedle: 'CLK_DONE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1CLK reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F1CLK serial:', (verdict.serial || '').slice(0, 700));
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    // The engine decoded SYSCLK from the guest's CFGR writes: 32 MHz
    // (PLL x4) and 72 MHz (PLL x9).
    expect(serial).toMatch(/F1RCC_HZ:32000000\b/);
    expect(serial).toMatch(/F1RCC_HZ:72000000\b/);
    // The guest's CFGR readback carries the engine's SW->SWS mirror
    // (CFGR[3:2] = 2, a value the guest never wrote) and the PLLMUL
    // field the guest programmed.
    expect(serial).toMatch(/SWS32:2\r?\n/);
    expect(serial).toMatch(/CFGR72:[0-9A-F]*A\r?\n/i);
    // Guest time advances in exact delay(2000) quanta (guest-time fact).
    const ms = [...serial.matchAll(/MILLIS(\d):(\d+)/g)].map((m) => Number(m[2]));
    console.log('F1CLK millis samples:', JSON.stringify(ms));
    expect(ms.length).toBeGreaterThanOrEqual(2);
    expect(ms[ms.length - 1] - ms[0]).toBeGreaterThanOrEqual(2000);
  });
});
