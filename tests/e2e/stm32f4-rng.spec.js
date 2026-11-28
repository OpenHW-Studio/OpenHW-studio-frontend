import { test, expect } from '@playwright/test';

// F4 RNG (TRNG) — lane/f4-cov2 (2026-10-20).
//
// WHY THIS CELL EXISTS: the F4 matrix row used to say "TRNG/RNG NONE
// (rng.rs)" and the handover recorded the reason as an engine NO-GO:
// "RNG_SR sticks at 0x60 (SECS|CECS) and DRDY never sets". That reason
// is WRONG — it was a CELL bug, the same class as the DMA LISR bit-5 and
// the I2S I2SMOD findings of lane/f4-cov.
//
// WHAT THE DEPLOYED BYTES ACTUALLY DO (measured offline on the running
// bytes — npm glue + public/wasm/stm32_periph_wasm_bg.wasm — with the
// same periphRead/periphWrite path the runner uses):
//   RNG_CR = 0x04 (RNGEN)   -> RNG_SR reads 0x01  (bit 0 = "RNG enabled"
//                               echo, set by the CR write)
//   after a few thousand instructions -> RNG_SR = 0x60
//   RNG_DR  -> a fresh pseudo-random word EVERY read (never zero)
//   the DR read CLEARS bit 6 of SR and leaves bit 5 set
//   the model's DRDY is therefore SR BIT 6, not bit 0.
//
// The old cells polled bit 0 — the "RNG enabled" echo — so they read one
// stale word (0) and then spun forever: "F4RNG_STUCK, N:1". Polling the
// model's actual data-ready bit yields distinct nonzero words.
//
// SILICON DEVIATION (engine-side, reported — this cell does NOT hide it):
// RM0090 §22.3.3 (STM32F4 RNG_SR) puts DRDY at bit 4 and SECS at bit 3;
// the engine puts DRDY at bit 6 and SECS at bit 5 (a +2 offset). The cell
// therefore asserts BOTH facts:
//   * the model's DRDY (bit 6) delivers distinct nonzero words  -> works
//   * the silicon DRDY (bit 4) never sets                      -> deviation
// A silicon-faithful driver polling bit 4 still sees nothing, so the
// engine owes the register map (see vendor/emulator-hook-specs/stm32f4-emu.md).
//
// CHIP SCOPE: the block exists only on the dice whose CHIPS flags say so
// (node_modules/stm32f4-emu/site/stm32f4.js:95/104/113 — rng:true on
// stm32f407 / stm32f407ve / stm32f429; rng:false on stm32f401 (:77) and
// stm32f411 (:86), which matches silicon: the F401/F411 have no RNG).
const TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
  { tag: 'F429', type: 'openhw-stm32f429', id: 'f429' },
];

const CODE = `#define RCC_AHB2ENR (*(volatile uint32_t*)0x40023834UL)
#define RNG_CR (*(volatile uint32_t*)0x50060800UL)
#define RNG_SR (*(volatile uint32_t*)0x50060804UL)
#define RNG_DR (*(volatile uint32_t*)0x50060808UL)
void setup() {
  Serial.begin(9600);
  Serial.println("F4RNG_READY");
  RCC_AHB2ENR |= (1UL << 6);      // RNG clock gate (AHB2 bit 6)
  RNG_CR = 0x04;                 // RNGEN
  Serial.print("F4RNG_SR0:");
  Serial.println(RNG_SR, HEX);
  uint32_t s[8]; int n = 0; uint32_t srLast = 0;
  for (long i = 0; i < 400000L && n < 8; i++) {
    uint32_t sr = RNG_SR;
    srLast = sr;
    if (sr & (1UL << 6)) s[n++] = RNG_DR;   // the MODEL's DRDY
  }
  Serial.print("F4RNG_N:"); Serial.println(n);
  Serial.print("F4RNG_SRLAST:"); Serial.println(srLast, HEX);
  for (int i = 0; i < n; i++) { Serial.print("F4RNG_W:"); Serial.println(s[i], HEX); }
  // The SILICON DRDY (RM0090 bit 4) never fires on these bytes.
  uint32_t sr4 = 0; long guard = 0;
  for (; guard < 400000L; guard++) { sr4 = RNG_SR; if (sr4 & (1UL << 4)) break; }
  Serial.print("F4RNG_BIT4:"); Serial.println(sr4, HEX);
  int distinct = 0, nonzero = 0;
  for (int i = 0; i < n; i++) {
    if (s[i]) nonzero++;
    for (int j = i + 1; j < n; j++) if (s[i] != s[j]) distinct++;
  }
  Serial.print("F4RNG_DISTINCT:"); Serial.println(distinct);
  Serial.print("F4RNG_NONZERO:"); Serial.println(nonzero);
  if (n >= 4 && distinct >= 4 && nonzero >= 4) Serial.println("F4RNG_OK");
  else Serial.println("F4RNG_STUCK");
}
void loop() {
  Serial.println("F4RNG_TICK");
  delay(1000);
}
`;

test.describe('F4 RNG (TRNG) data path', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type, id } of TYPES) {
    test(`RNG_DR yields distinct nonzero words (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      // Harness gate: the plain waitForTimeout(8000) variant loses the race
      // on a loaded box and dies with "Cannot read properties of undefined
      // (reading 'setupCircuit')" (seen on the f407ve cell 2026-10-20).
      await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 90000 });
      await page.waitForTimeout(2000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, i: id, code: CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 30000, serialNeedle: 'F4RNG_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      const serial = verdict.serial || '';
      console.log(`${tag}RNG reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}RNG serial:`, serial.slice(0, 600));
      expect(verdict.pass).toBe(true);
      expect(serial).toContain('F4RNG_OK');
      expect(serial).not.toContain('F4RNG_STUCK');
      // The model's SR after the data-ready flag was set: 0x60 (DRDY|SECS).
      const srLast = /F4RNG_SRLAST:([0-9A-Fa-f]+)/.exec(serial);
      expect(srLast).toBeTruthy();
      expect(parseInt(srLast[1], 16) & 0x40).not.toBe(0);
      // Eight words, all nonzero and all distinct.
      const n = /F4RNG_N:(\d+)/.exec(serial);
      expect(n).toBeTruthy();
      expect(Number(n[1])).toBeGreaterThanOrEqual(4);
      const words = [...serial.matchAll(/F4RNG_W:([0-9A-Fa-f]+)/g)].map((m) => parseInt(m[1], 16));
      expect(words.length).toBeGreaterThanOrEqual(4);
      expect(words.every((w) => w !== 0)).toBe(true);
      expect(new Set(words).size).toBe(words.length);
      // SILICON DEVIATION, asserted so it stays visible: the RM0090 DRDY
      // bit (4) never sets on the deployed bytes.
      const bit4 = /F4RNG_BIT4:([0-9A-Fa-f]+)/.exec(serial);
      expect(bit4).toBeTruthy();
      expect(parseInt(bit4[1], 16) & 0x10).toBe(0);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(1500);
    });
  }
});
