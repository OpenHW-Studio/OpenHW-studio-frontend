import { test, expect } from '@playwright/test';

// F4 system blocks — lane/f4-cov2 (2026-10-20).
//
// The matrix "System, crypto & connectivity" table listed the STM32F4
// row as NONE for CRC / Clocks / Debug and NONE for PWR/Sleep, and PARTIAL
// for the watchdog ("WWDG still NONE"). Every cell below is a live e2e
// proof against the DEPLOYED engine bytes, guest-side only — no runner
// change for the facts themselves, no engine change.
//
// ENGINE BYTES THAT ACTUALLY RUN (verified, not assumed):
//   The facade is the npm pair `stm32f4-emu@1.6.0` (site/stm32f4.js +
//   site/emulator.js) and the wasm-bindgen glue is
//   node_modules/stm32f4-emu/site/vendor/stm32_periph_wasm.js —
//   md5 19a9630175082fab610c8685e8aad7cb (byte-identical to
//   public/vendor/board-engines/stm32f4-emu/site/vendor/stm32_periph_wasm.js).
//   The WASM that is actually executed is NOT the one inside the npm
//   package: the runner fetches it and passes it as `wasmInit`
//   (src/worker/runners/stm32f4-runner.ts:949-961 -> 994), and
//   createEmulator() then does `bindings.default({module_or_path: wasmInit})`
//   (site/emulator.js:359). So the running wasm is
//   public/wasm/stm32_periph_wasm_bg.wasm — md5 9455e31cdbb2295697db81e49ec4119e
//   (the npm package's own wasm, md5 7ef32e3f38cc56a19a12581d91d21618,
//   is only a fallback). The SVD that builds the peripheral map is fetched
//   the same way from
//   public/vendor/board-engines/stm32f4-emu/site/vendor/stm32f4{01,07,11,29}.svd
//   (runner:947-960) — so HASH/CRYP/DCMI/... exist because the SVD says so.
//
// ── CRC ────────────────────────────────────────────────────────────────────
// The same 3 words + the same expected silicon value as the proven F1 cell:
//   CRC_DR of {0xDEADBEEF, 0x12345678, 0x00FF00FF} = 0xFB5C7298
//   = 4217139864 decimal (re-derived offline from the engine's CRC-32
//   poly 0x04C11DB7, MSB-first per byte).
// Clock gate: RCC_AHB1ENR bit 12 (0x40023830). The engine CHIPS table
// (node_modules/stm32f4-emu/site/stm32f4.js:69-115) claims crc:true on
// stm32f401 / stm32f411 / stm32f407 / stm32f407ve / stm32f429 — this cell
// covers the four crc:true dice that are NOT f429 (f429 has its own cell
// in stm32f4-rng-crc.spec.js).
//
// ── WWDG ───────────────────────────────────────────────────────────────────
// The engine models WWDG as a free-running counter (peripherals/wwdg.rs):
//   tick  = 256 * prescaler instructions
//   CR    = WDGA(bit7) | counter(bits 6:0)   @0x40002C00
//   CFR   = prescaler(bits 8:7) | window(bits 6:0) | EWIT(bit9) @0x40002C04
//   SR    = EWIF(bit0)                          @0x40002C08
// Three facts are proven, and none is vacuous:
//   (1) the counter really counts down (the live CR readback shrinks),
//   (2) the early-wakeup flag EWIF latches when the counter crosses 0x3F,
//   (3) with WDGA set, the underflow RESETS the core — proven by the
//       reboot (the firmware re-announces itself), by the backup-domain
//       magic surviving the reset, and by RCC_CSR bit 30 (WWDGRSTF) being
//       set in the next boot with NO other reset-cause bit set. The runner
//       also emits the host-side marker F4WDOG_RST:2 (facade onWdogReset,
//       which=2).
// NOTE on the reset-cause proof: RCC_CSR powers up with the RESERVED
// pattern set (the model initialises csr = 0x0C000000, rcc.rs:39; the
// F407 SVD's CSR resetValue is 0x0E000000), so bit 30 reads 1 even before
// any watchdog fired. The sketch therefore clears the flags with RMVF
// (CSR bit 24) BEFORE arming the watchdog and proves afterwards that the
// bit was clear after the clear and set (alone) after the reset. See the
// WWDG_CODE comment for the full protocol.
//
// CELL BUG FIXED HERE (the previous draft hung on the F407/F407VE):
// the WWDG counter is only re-evaluated on the engine's peripheral tick,
// and the F4 runner's step size is derived from the guest's live SysTick
// reload (src/worker/runners/stm32f4-runner.ts:560-600, stepCoarseChunked:
//   slice = min(262144, max(8192, min(SysTick_LOAD + 64, total/7)))).
// With the F407's stock LOAD = 167999 the slice is ~168k instructions = 82
// WWDG /8 ticks, i.e. MORE than the whole 127-step countdown — the counter
// therefore jumps straight past zero and the model wraps it back to 0x7F
// (wwdg.rs:54-64), so a guest polling CR never sees it fall and a
// `while (c1 > 0x40)` poll loop spins until the run window expires.
// The fix is guest-side and silicon-legal: the sketch reprograms
// SysTick->LOAD to 4095, which makes the runner's slice 8192 instructions
// (4 WWDG ticks) — fine enough that the counter is observed on its way
// down. Measured: the F407 counter readback falls 127 -> 64 and the EWIF
// latches, on all five dice.
//
// ── PWR / sleep ────────────────────────────────────────────────────────────
// PWR_CR @0x40007000, PWR_CSR @0x40007004.
// The engine's sleep path (site/emulator.js step()) puts the core to sleep on
// WFI, advances virtual time, and on wake calls pwr_wakeup() → PWR_CSR.WUF
// (bit 0). The runner additionally observes the power mode through the
// facade (pwrMode()) and emits F4PWR_MODE:<n> (2 = STOP via LPDS) — a
// HOST-side observation of the guest's PWR_CR write.
// ENGINE NOTE (documented, not hidden): the engine gates its wake-flag
// update on SCB->SCR bit 2 (`(wread32(0xE000ED10) >>> 2) & 1`,
// site/emulator.js:1460). SCR bit 2 is RESERVED on silicon (SLEEPONEXIT is
// bit 1), and the engine's SCR write mask (0x1E) lets the guest set it. So
// the guest sets SCR bit 2 to arm the engine's wake path — the sleep/wake
// fact itself (the core really slept, virtual time advanced, the guest
// resumed, WUF latched) is engine-wide, but the exact WUF trigger is
// engine-specific. The cell therefore asserts the guest-visible facts (CR
// readback, host-side mode marker, WFI resume, WUF) and not a
// silicon-exact SCR encoding.
//
// ── Clocks (RCC) ───────────────────────────────────────────────────────────
// RCC_CR @0x40023800, RCC_CFGR @0x40023808, RCC_AHB1ENR @0x40023830.
// Facts proven: (1) a clock source LOCKS — HSEON set, then HSERDY (CR
// bit 17) goes 1 after the engine's settle window; (2) the SYSCLK switch
// takes effect — CFGR.SW written to HSE (1) and CFGR.SWS (bits 3:2) reads
// back 1 (the engine mirrors SW into SWS, with the CSS fallback to HSI when
// a source fails); (3) the bus prescalers are writable (PPRE1 readback) and
// the peripheral clock gates latch (AHB1ENR readback). Guest-time facts
// only — no wall-clock counts.
//
// ── Debug (DBGMCU / ITM / DWT) ─────────────────────────────────────────────
// DBGMCU @0xE0042000 (IDCODE) / @0xE0042004 (CR), ITM @0xE0000000 (STIM0-31)
// with TER @0xE0000E00 and TCR @0xE0000E80, DEMCR @0xE000EDFC, DWT_CTRL
// @0xE0001000 and DWT_CYCCNT @0xE0001004.
// Facts proven: (1) DBGMCU is a live register block (the IDCODE reads back
// the chip's own DEV_ID word, CR round-trips through the engine's 0x1FE0F7
// mask); (2) the DWT cycle counter obeys the SILICON gating rule — with
// CTRL.CYCCNTENA clear the counter is FROZEN (two reads far apart are
// exactly equal), and with DEMCR.TRCENA + CTRL.CYCCNTENA set it advances;
// (3) the ITM stimulus console is live — TCR.ITMENA + TER[1] make STIM1 read
// "ready" (1) and bytes written to STIM1 leave the chip through the
// runner's ITM drain (stm32f4-runner.ts onItmByte → emitTxByte) and show
// up in the serial stream as the marker token "QX7#".
// NOTE (measured, deployed bytes): DWT_CTRL reads 1 at reset (CYCCNTENA
// already set), so the cell must CLEAR CYCCNTENA to observe the gating
// rule — a "counter is frozen from reset" assertion would be false.
//
// All cells assert GUEST facts, never wall-clock counts, and use the
// waitForFunction harness gate (the plain waitForTimeout(8000) variant
// loses the race on a loaded box and dies with "Cannot read properties of
// undefined (reading 'setupCircuit')").
const ALL_TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'F401', type: 'openhw-stm32f401', id: 'f401' },
  { tag: 'F411', type: 'openhw-stm32f411', id: 'f411' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
  { tag: 'F429', type: 'openhw-stm32f429', id: 'f429' },
];

// CRC — every crc:true die except the f429 (own cell in stm32f4-rng-crc).
const CRC_TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'F401', type: 'openhw-stm32f401', id: 'f401' },
  { tag: 'F411', type: 'openhw-stm32f411', id: 'f411' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
];

// DBGMCU IDCODE per die (engine dbgmcu.rs set_idcode: the DEV_ID field is
// pinned to the silicon word, REV_ID 0x1001 for F407 and 0x1000 for the
// rest). Asserted per board so the cell also proves the right SVD/map.
const IDCODE = {
  F407: 0x10016413,
  F401: 0x10006423,
  F411: 0x10006431,
  V407: 0x10016413,
  F429: 0x10006419,
};

const CRC_CODE = `#define RCC_AHB1ENR (*(volatile uint32_t*)0x40023830UL)
#define CRC_DR (*(volatile uint32_t*)0x40023000UL)
#define CRC_CR (*(volatile uint32_t*)0x40023008UL)
void setup() {
  Serial.begin(9600);
  Serial.println("F4CRC_READY");
  RCC_AHB1ENR |= (1UL << 12);
  CRC_CR = 1UL;
  CRC_DR = 0xDEADBEEFUL;
  CRC_DR = 0x12345678UL;
  CRC_DR = 0x00FF00FFUL;
  uint32_t r = CRC_DR;
  Serial.print("F4CRC_HEX:");
  Serial.println(r, HEX);
  Serial.print("F4CRC_DEC:");
  Serial.println(r);
  if (r == 0xFB5C7298UL) Serial.println("F4CRC_OK");
  else Serial.println("F4CRC_MISMATCH");
}
void loop() {
  Serial.println("F4CRC_TICK");
  delay(1000);
}
`;

// WWDG — reprograms SysTick->LOAD (see the header note: the runner's step
// size follows the guest's SysTick reload, and with the F407's stock
// 167999 the WWDG countdown is skipped entirely), then counts the WWDG
// down, latches EWIF, and finally arms WDGA so the underflow resets the
// core.
//
// RESET-CAUSE PROTOCOL (this is what makes the cell non-vacuous):
// the engine's RCC_CSR powers up with the RESERVED pattern set — the model
// initialises csr = 0x0C000000 (stm32-periph-wasm/src/peripherals/rcc.rs:39)
// and the F407 SVD's CSR resetValue is 0x0E000000 (site/vendor/
// stm32f407.svd, RCC_CSR), i.e. bit 30 (WWDGRSTF) already reads 1 before
// any watchdog ever fired. So "CSR bit 30 is set" proves NOTHING on its own.
// The sketch therefore:
//   1. writes a magic into the BACKUP domain (RTC_BKP0R, PWR DBP + PWREN
//      clock). The backup domain is NOT reset by a watchdog reset
//      (RM0090 §7.3.8: only a power-on/backup reset clears it), so the magic
//      tells the NEXT boot that it is the post-watchdog boot. The engine
//      keeps the peripheral models across a CPU reset (the reset is
//      cpu.reset_cpu inside the engine's step loop, site/emulator.js:1482),
//      and the BKP readback itself is already proven by stm32f4-sys.spec.js.
//   2. clears the reset-cause flags with RMVF (CSR bit 24, write-1-to-clear:
//      rcc.rs:254-257 sets csr = value & 0x0C00003F, so the reserved bits go
//      to 0 as well). After that, ANY bit 30 that shows up in a later boot
//      can only have been set by a real watchdog underflow.
//   3. prints CSR before and after the clear, so the cell can show that the
//      clear worked (bit 30 clear) and that the later boot has bit 30 set
//      with NO other reset-cause bit (25..29 clear => not POR/SFTR/IWDG).
const WWDG_CODE = `#define WWDG_CR (*(volatile uint32_t*)0x40002C00UL)
#define WWDG_CFR (*(volatile uint32_t*)0x40002C04UL)
#define WWDG_SR (*(volatile uint32_t*)0x40002C08UL)
#define RCC_CSR (*(volatile uint32_t*)0x40023874UL)
#define RCC_APB1ENR (*(volatile uint32_t*)0x40023840UL)
#define PWR_CR (*(volatile uint32_t*)0x40007000UL)
#define RTC_BKP0R (*(volatile uint32_t*)0x40002850UL)
#define SYST_LOAD (*(volatile uint32_t*)0xE000E014UL)
#define BKP_MAGIC 0x57474447UL
void setup() {
  Serial.begin(9600);
  Serial.println("F4WWDG_READY");
  RCC_APB1ENR |= (1UL << 28);   // PWREN
  PWR_CR |= (1UL << 8);         // DBP: backup-domain write access
  uint32_t bkp = RTC_BKP0R;
  Serial.print("F4WWDG_BKP:");
  Serial.println(bkp, HEX);
  if (bkp == BKP_MAGIC) {
    // The post-watchdog boot: the backup magic survived the reset.
    uint32_t csr = RCC_CSR;
    Serial.print("F4WWDG_CSR:");
    Serial.println(csr, HEX);
    Serial.println("F4WWDG_RSTF");
    return;
  }
  RTC_BKP0R = BKP_MAGIC;
  // Clear every reset-cause flag (RMVF). After this the next boot's
  // WWDGRSTF bit is unambiguous.
  RCC_CSR = (1UL << 24);
  uint32_t csr1 = RCC_CSR;
  Serial.print("F4WWDG_CSRCLR:");
  Serial.println(csr1, HEX);
  if (csr1 & (1UL << 30)) { Serial.println("F4WWDG_CLRFAIL"); return; }
  // Fine-grained engine ticks (see the header note).
  SYST_LOAD = 4095UL;
  // prescaler /8 (CFR bits 8:7 = 3), window W = 0x7F (max -> a refresh is
  // never a window violation), EWIT enabled (bit 9).
  WWDG_CFR = 0x017FUL;
  uint32_t c0 = WWDG_CR;
  // Start the counter WITHOUT WDGA so the underflow cannot reset the core:
  // the countdown and the early-wakeup edge are observed first.
  WWDG_CR = 0x7FUL;
  uint32_t cmin = 0x7FUL;
  uint32_t sr = 0;
  unsigned long guard = 0;
  while (guard < 200000UL) {
    uint32_t c = WWDG_CR;
    if (c < cmin) cmin = c;
    sr = WWDG_SR;
    if (sr & 1UL) break;          // EWIF latched at the 0x3F crossing
    guard++;
  }
  Serial.print("F4WWDG_DEC:");
  Serial.print(c0);
  Serial.print(",");
  Serial.println(cmin);
  Serial.print("F4WWDG_SR:");
  Serial.println(sr, HEX);
  Serial.println("F4WWDG_ARMED");
  // Now arm with WDGA: the counter reloads to 0x7F and the underflow
  // (127 ticks x 2048 instructions) requests the watchdog reset.
  WWDG_CR = 0x80UL | 0x7FUL;
}
void loop() {
  delay(5);
}
`;

// PWR — CR readback, host-observed mode, WFI sleep + wake, WUF latch.
const PWR_CODE = `#define PWR_CR (*(volatile uint32_t*)0x40007000UL)
#define PWR_CSR (*(volatile uint32_t*)0x40007004UL)
#define SCR (*(volatile uint32_t*)0xE000ED10UL)
void setup() {
  Serial.begin(9600);
  Serial.println("F4PWR_READY");
  Serial.print("F4PWR_CR0:");
  Serial.println(PWR_CR, HEX);
  Serial.print("F4PWR_CSR0:");
  Serial.println(PWR_CSR, HEX);
  // STOP flavour: LPDS (CR bit 0). The runner's pwrMode() then reports 2.
  PWR_CR = (PWR_CR & ~0x3UL) | 0x1UL;
  Serial.print("F4PWR_CR1:");
  Serial.println(PWR_CR, HEX);
  // Arm the engine's wake path (see the header note: the engine gates its
  // wake-flag update on SCR bit 2).
  SCR |= 0x4UL;
  Serial.println("F4PWR_SLEEP");
  __asm volatile ("wfi");
  Serial.println("F4PWR_WOKE");
  uint32_t csr = PWR_CSR;
  Serial.print("F4PWR_CSR1:");
  Serial.println(csr, HEX);
  if (csr & 0x1UL) Serial.println("F4PWR_WUF");
}
void loop() {
  delay(200);
}
`;

// Clocks — source lock, SYSCLK switch, prescalers, peripheral gate.
const CLK_CODE = `#define RCC_CR (*(volatile uint32_t*)0x40023800UL)
#define RCC_PLLCFGR (*(volatile uint32_t*)0x40023804UL)
#define RCC_CFGR (*(volatile uint32_t*)0x40023808UL)
#define RCC_AHB1ENR (*(volatile uint32_t*)0x40023830UL)
void setup() {
  Serial.begin(9600);
  Serial.println("F4CLK_READY");
  uint32_t cr0 = RCC_CR;
  RCC_CR |= (1UL << 16);
  unsigned long to = 0;
  while (!(RCC_CR & (1UL << 17)) && ++to < 2000000UL) {}
  uint32_t cr1 = RCC_CR;
  // SYSCLK <- HSE: SW = 1 (bits 1:0), SWS mirrors it (bits 3:2).
  RCC_CFGR = (RCC_CFGR & ~0x3UL) | 0x1UL;
  uint32_t cfgr = RCC_CFGR;
  // APB1 prescaler (PPRE1, bits 12:10) = /4 -> 5, and the AHB1 gate.
  RCC_CFGR = (cfgr & ~0x1C00UL) | (0x5UL << 10);
  uint32_t cfgr2 = RCC_CFGR;
  RCC_AHB1ENR |= (1UL << 0);
  uint32_t a1 = RCC_AHB1ENR;
  Serial.print("F4CLK_CR0:");
  Serial.println(cr0, HEX);
  Serial.print("F4CLK_CR1:");
  Serial.println(cr1, HEX);
  Serial.print("F4CLK_CFGR:");
  Serial.println(cfgr, HEX);
  Serial.print("F4CLK_CFGR2:");
  Serial.println(cfgr2, HEX);
  Serial.print("F4CLK_AHB1:");
  Serial.println(a1, HEX);
  bool ok = (cr1 & (1UL << 17)) != 0
         && (cfgr & 0x3UL) == 0x1UL
         && ((cfgr >> 2) & 0x3UL) == 0x1UL
         && ((cfgr2 >> 10) & 0x7UL) == 0x5UL
         && (a1 & 0x1UL) != 0;
  if (ok) Serial.println("F4CLK_OK");
  else Serial.println("F4CLK_BAD");
}
void loop() {
  delay(200);
}
`;

// Debug — DBGMCU + ITM + DWT (with the DWT gating rule measured, not
// assumed: CTRL.CYCCNTENA is cleared first so the "frozen" half of the
// silicon rule is observable).
const DBG_CODE = `#define DBGMCU_ID (*(volatile uint32_t*)0xE0042000UL)
#define DBGMCU_CR (*(volatile uint32_t*)0xE0042004UL)
#define ITM_STIM1 (*(volatile uint32_t*)0xE0000004UL)
#define ITM_TER (*(volatile uint32_t*)0xE0000E00UL)
#define ITM_TCR (*(volatile uint32_t*)0xE0000E80UL)
#define DEMCR (*(volatile uint32_t*)0xE000EDFCUL)
#define DWT_CTRL (*(volatile uint32_t*)0xE0001000UL)
#define DWT_CYCCNT (*(volatile uint32_t*)0xE0001004UL)
void setup() {
  Serial.begin(9600);
  Serial.println("F4DBG_READY");
  uint32_t id = DBGMCU_ID;
  DBGMCU_CR = 0x00000003UL;
  uint32_t cr = DBGMCU_CR;
  Serial.print("F4DBG_ID:"); Serial.println(id, HEX);
  Serial.print("F4DBG_CR:"); Serial.println(cr, HEX);
  Serial.print("F4DBG_CTRL0:"); Serial.println(DWT_CTRL, HEX);
  // Silicon gating rule: with CTRL.CYCCNTENA clear the counter is FROZEN.
  DWT_CTRL = 0UL;
  uint32_t c0 = DWT_CYCCNT;
  delay(3);
  uint32_t c1 = DWT_CYCCNT;
  // Enable DEMCR.TRCENA + DWT_CTRL.CYCCNTENA -> the counter advances.
  DEMCR |= (1UL << 24);
  DWT_CTRL |= 1UL;
  uint32_t c2 = DWT_CYCCNT;
  delay(3);
  uint32_t c3 = DWT_CYCCNT;
  Serial.print("F4DBG_CNT:");
  Serial.print(c0); Serial.print(",");
  Serial.print(c1); Serial.print(",");
  Serial.print(c2); Serial.print(",");
  Serial.println(c3);
  // ITM stimulus console: TCR.ITMENA + TER[1].
  ITM_TCR = 0x00000001UL;
  ITM_TER = (1UL << 1);
  uint32_t ready = ITM_STIM1;
  Serial.print("F4DBG_ITMREADY:");
  Serial.println(ready);
  ITM_STIM1 = 'Q';
  ITM_STIM1 = 'X';
  ITM_STIM1 = '7';
  ITM_STIM1 = '#';
  Serial.println("F4DBG_ITM_SENT");
}
void loop() {
  delay(500);
}
`;

test.describe('F4 system blocks (CRC / WWDG / PWR / Clocks / Debug)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  const boot = async (page) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 90000 });
    await page.waitForTimeout(2000);
  };

  const runCell = async (page, { type, id, code }, forMs, needle) => {
    const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: i, type: t, attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), { t: type, i: id, code });
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(({ f, n }) => window.OpenHWE2E.run({
      forMs: f, serialNeedle: n, telemetryMode: 'detail',
    }), { f: forMs, n: needle });
    expect(verdict.ok).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
    return verdict;
  };

  for (const { tag, type, id } of CRC_TYPES) {
    test(`CRC_DR of 3 words equals FB5C7298 (${type})`, async ({ page }) => {
      await boot(page);
      const verdict = await runCell(page, { type, id, code: CRC_CODE }, 12000, 'F4CRC_OK');
      console.log(`${tag}CRC reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}CRC serial:`, (verdict.serial || '').slice(0, 300));
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toMatch(/F4CRC_HEX:FB5C7298/i);
      expect(verdict.serial || '').toContain('F4CRC_DEC:4217139864');
      expect(verdict.serial || '').not.toContain('F4CRC_MISMATCH');
    });
  }

  for (const { tag, type, id } of ALL_TYPES) {
    test(`WWDG counts down, latches EWIF and resets the core (${type})`, async ({ page }) => {
      await boot(page);
      const verdict = await runCell(page, { type, id, code: WWDG_CODE }, 20000, 'F4WWDG_ARMED');
      const serial = verdict.serial || '';
      console.log(`${tag}WWDG reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}WWDG serial head:`, serial.slice(0, 800));
      expect(verdict.pass).toBe(true);
      // (1) the counter counts down: the live CR readback shrank.
      const dec = /F4WWDG_DEC:(\d+),(\d+)/.exec(serial);
      expect(dec).toBeTruthy();
      const c0 = Number(dec[1]);
      const c1 = Number(dec[2]);
      console.log(`${tag}WWDG counter:`, c0, '->', c1);
      expect(c1).toBeLessThan(c0);
      // (2) the early-wakeup flag latched at the 0x3F crossing (SR bit 0).
      const sr = /F4WWDG_SR:([0-9A-Fa-f]+)/.exec(serial);
      expect(sr).toBeTruthy();
      expect(parseInt(sr[1], 16) & 0x1).not.toBe(0);
      // (3) the RMVF clear worked: the pre-clear CSR pattern (the engine
      //     powers up with the reserved bits set) is gone, so a later
      //     WWDGRSTF bit can only come from a real watchdog underflow.
      const clr = /F4WWDG_CSRCLR:([0-9A-Fa-f]+)/.exec(serial);
      expect(clr).toBeTruthy();
      console.log(`${tag}WWDG CSR after RMVF:`, clr[1]);
      expect(parseInt(clr[1], 16) & (1 << 30)).toBe(0);
      expect(serial).not.toContain('F4WWDG_CLRFAIL');
      // (4) the underflow with WDGA set RESET the core: the firmware
      //     re-announces itself and the backup-domain magic survived.
      const boots = serial.split(/F4WWDG_READY/).length - 1;
      console.log(`${tag}WWDG boots:`, boots);
      expect(boots).toBeGreaterThanOrEqual(2);
      expect(serial).toContain('F4WWDG_RSTF');
      // The BKP line is printed TWICE (first boot: 0, post-watchdog boot:
      // the magic). Take the LAST one — the first match is the pre-reset
      // read and would make the cell fail on a perfectly good proof.
      const bkpAll = [...serial.matchAll(/F4WWDG_BKP:([0-9A-Fa-f]+)/g)].map((m) => m[1]);
      expect(bkpAll.length).toBeGreaterThanOrEqual(2);
      console.log(`${tag}WWDG BKP words:`, bkpAll.join(' -> '));
      expect(parseInt(bkpAll[bkpAll.length - 1], 16)).toBe(0x57474447);
      // (5) the reset CAUSE was the window watchdog: CSR bit 30 (WWDGRSTF)
      //     set, and no other reset-cause bit (25 BOR .. 29 IWDG) set.
      const csrAll = [...serial.matchAll(/F4WWDG_CSR:([0-9A-Fa-f]+)/g)].map((m) => m[1]);
      expect(csrAll.length).toBeGreaterThanOrEqual(1);
      const csrVal = parseInt(csrAll[csrAll.length - 1], 16);
      console.log(`${tag}WWDG reset-cause CSR:`, csrAll.join(' -> '));
      expect(csrVal & (1 << 30)).not.toBe(0);
      expect(csrVal & 0x1E000000).toBe(0);
    });
  }

  for (const { tag, type, id } of ALL_TYPES) {
    test(`PWR: CR readback, host mode marker, WFI sleep + wake with WUF (${type})`, async ({ page }) => {
      await boot(page);
      const verdict = await runCell(page, { type, id, code: PWR_CODE }, 15000, 'F4PWR_WOKE');
      const serial = verdict.serial || '';
      console.log(`${tag}PWR reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}PWR serial:`, serial.slice(0, 500));
      expect(verdict.pass).toBe(true);
      // The guest's PWR_CR write round-trips (LPDS = bit 0 set).
      const cr1 = /F4PWR_CR1:([0-9A-Fa-f]+)/.exec(serial);
      expect(cr1).toBeTruthy();
      expect(parseInt(cr1[1], 16) & 0x1).not.toBe(0);
      // The core really slept and resumed.
      expect(serial).toContain('F4PWR_SLEEP');
      expect(serial).toContain('F4PWR_WOKE');
      // The engine latched the wakeup flag (PWR_CSR.WUF, bit 0).
      expect(serial).toContain('F4PWR_WUF');
      const csrLine = /F4PWR_CSR1:([0-9A-Fa-f]+)/.exec(serial);
      expect(csrLine).toBeTruthy();
      expect(parseInt(csrLine[1], 16) & 0x1).not.toBe(0);
      // HOST-side observation: the runner's power-mode marker (2 = STOP).
      expect(serial).toContain('F4PWR_MODE:2');
    });
  }

  for (const { tag, type, id } of ALL_TYPES) {
    test(`RCC: source lock, SYSCLK switch, prescaler + bus gate readback (${type})`, async ({ page }) => {
      await boot(page);
      const verdict = await runCell(page, { type, id, code: CLK_CODE }, 15000, 'F4CLK_OK');
      const serial = verdict.serial || '';
      console.log(`${tag}CLK reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}CLK serial:`, serial.slice(0, 500));
      expect(verdict.pass).toBe(true);
      expect(serial).toContain('F4CLK_OK');
      expect(serial).not.toContain('F4CLK_BAD');
      const cr1 = /F4CLK_CR1:([0-9A-Fa-f]+)/.exec(serial);
      expect(cr1).toBeTruthy();
      // HSERDY (CR bit 17) latched after the settle window.
      expect(parseInt(cr1[1], 16) & (1 << 17)).not.toBe(0);
      const cfgr = /F4CLK_CFGR:([0-9A-Fa-f]+)/.exec(serial);
      expect(cfgr).toBeTruthy();
      const c = parseInt(cfgr[1], 16);
      // SW = HSE (bits 1:0 = 1) and SWS mirrors it (bits 3:2 = 1).
      expect(c & 0x3).toBe(1);
      expect((c >> 2) & 0x3).toBe(1);
      const cfgr2 = /F4CLK_CFGR2:([0-9A-Fa-f]+)/.exec(serial);
      expect(cfgr2).toBeTruthy();
      // PPRE1 readback = /4.
      expect((parseInt(cfgr2[1], 16) >> 10) & 0x7).toBe(5);
      const ahb1 = /F4CLK_AHB1:([0-9A-Fa-f]+)/.exec(serial);
      expect(ahb1).toBeTruthy();
      expect(parseInt(ahb1[1], 16) & 0x1).not.toBe(0);
    });
  }

  for (const { tag, type, id } of ALL_TYPES) {
    test(`DBGMCU + ITM + DWT (${type})`, async ({ page }) => {
      await boot(page);
      const verdict = await runCell(page, { type, id, code: DBG_CODE }, 15000, 'F4DBG_ITM_SENT');
      const serial = verdict.serial || '';
      console.log(`${tag}DBG reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}DBG serial:`, serial.slice(0, 600));
      expect(verdict.pass).toBe(true);
      // DBGMCU CR round-trips through the engine's mask.
      const cr = /F4DBG_CR:([0-9A-Fa-f]+)/.exec(serial);
      expect(cr).toBeTruthy();
      expect(parseInt(cr[1], 16) & 0x3).toBe(3);
      // The IDCODE is the chip's own silicon word.
      const idc = /F4DBG_ID:([0-9A-Fa-f]+)/.exec(serial);
      expect(idc).toBeTruthy();
      expect(parseInt(idc[1], 16)).toBe(IDCODE[tag]);
      // DWT: frozen while CYCCNTENA is clear, advancing once enabled.
      const cnt = /F4DBG_CNT:(\d+),(\d+),(\d+),(\d+)/.exec(serial);
      expect(cnt).toBeTruthy();
      const c0 = Number(cnt[1]);
      const c1 = Number(cnt[2]);
      const c2 = Number(cnt[3]);
      const c3 = Number(cnt[4]);
      expect(c1).toBe(c0);           // frozen: no counting while disabled
      expect(c3).toBeGreaterThan(c2); // counting once TRCENA + CYCCNTENA
      // ITM: the stimulus port reads ready and the bytes leave the chip.
      expect(serial).toMatch(/F4DBG_ITMREADY:1\b/);
      expect(serial).toContain('QX7#');
    });
  }
});
