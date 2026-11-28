import { test, expect } from '@playwright/test';

// F4 system blocks (Disco F407 / 407VE / 429) — guest-side proof, zero
// runner changes. Five narrow cells, one board loop:
//   IWDG (2 cells): the IWDG arms, the pet reloads the counter, and the
//     watchdog resets the core once the petting stops.
//   EXTI: attachInterrupt(PB0, RISING) + EXTI_SWIER trigger. NOTE the F4
//     EXTI base is 0x40013C00 (not the F1 0x40010400).
//   BKP: backup-domain write/readback of RTC_BKP0R @0x40002850 (PWR DBP +
//     PWREN on the F4 RCC_APB1ENR @0x40023840).
//   HASH: the HASH engine computes standard SHA-256 / SHA-1 digests.
// CRYP/AES is NOT covered here (follow-up cell, same file pattern).
//
// ---------------------------------------------------------------------------
// IWDG — MEASURED ENGINE FACTS (lane/net-pace, 2026-10-20)
// ---------------------------------------------------------------------------
// The engine's IWDG counts RETIRED INSTRUCTIONS, not wall time
// (stm32-periph-wasm/src/peripherals/iwdg.rs):
//     tick = 128 * prescaler_div(PR)      PR 0 -> /4
//     timeout = RLR * tick instructions   RLR is 12 bits (0..4095)
// so with the maximal reload (RLR=0xFFF) and PR=0 the window is
//     4095 * 128 * 4 = 2,096,640 instructions = ~13 GUEST ms
// (measured: the never-peted sketch reached millis()==12/13 before the
// reset). The old cell used RLR=20000 with delay(300): 20000 truncates to
// 3616 -> an ~11 guest-ms window, while delay(300) is ~300 guest-ms of
// instructions — so the watchdog ALWAYS fired before the first pet and the
// board rebooted every ~11 guest-ms. That is why WDG_ARMED never printed.
// It was not slowness and not a double-boot: the window is simply ~13
// guest-ms, ~23x shorter than one delay(300).
//
// The two cells below therefore split the fact in two, so that neither can
// pass vacuously:
//   (1) "IWDG stays alive while it is petted" (control): the firmware pets
//       every 6 guest-ms for the whole run. The engine's window is ~13
//       guest-ms, so a broken reload would reset the board every ~13 guest
//       ms; the cell asserts the board NEVER reboots across a guest span of
//       >= 60 guest-ms (>= 4.6 windows) — proof that the pet really reloads
//       the counter.
//   (2) "IWDG fires after petting stops" (the fact): the firmware pets 3
//       times, then STOPS petting and spins. The cell asserts the board
//       reboots (millis() jumps back / the firmware re-runs) and that the
//       reboot comes AFTER the petting stopped, within ~13 guest-ms
//       (the measured IWDG window) of spin iterations.
// The arming protocol is proven too: IWDG_SR (0x4000300C) is read after the
// PR/RLR writes — the RLR write is only accepted while the unlock key
// (KR=0x5555) is latched, so the update flag proves the write landed.
//
// NOTE the guest-ms span, not the wall time, is what the cells assert: the
// guest clock is driven by the retired instruction count, so 1 guest-ms is
// a fixed number of instructions on every host. The WALL window only has
// to be long enough to buy the guest span, which is why the cells use
// guest-time units throughout.
// ---------------------------------------------------------------------------
// HASH — MEASURED ENGINE FACTS (lane/net-pace, 2026-10-20)
// ---------------------------------------------------------------------------
// Register map (engine SVD site/vendor/stm32f407.svd, same for 407/429):
//   HASH_CR   0x50060400  ALGO0 = bit 7, ALGO1 = bit 18 (ALGO=01 SHA-1,
//              ALGO=10 SHA-256, ALGO=11 unimplemented), INIT = bit 2
//   HASH_DIN  0x50060404  the word is taken BIG-ENDIAN
//   HASH_STR  0x50060408  DCAL = bit 8, NBLW = bits 0..4
//   HASH_SR   0x50060424  DCIS = bit 1 (digest complete)
//   HASH_HR0..4  0x5006040C..0x5006041C  (main bank: HR0..HR4 only —
//              HASH_IMR/SR sit at 0x420/0x424, so HR5/HR6 alias them)
//   HASH_HR0..7  0x50060710..0x5006072C  (SVD alias bank, base+0x310:
//              the only place the FULL 8-word SHA-256 digest is readable)
// The OLD cell was broken in four ways: it polled HASH_SR at 0x50060430
// (unmapped -> always 0 -> "HASH_TIMEOUT"), it never wrote STR.DCAL (no
// digest was ever started), it asked for ALGO=MD5 (CR bit 7 only, not
// ALGO1), and it read HR5..HR7 out of the main bank, where silicon (and
// this engine) alias IMR/SR and return 0.
// The engine hashes the pushed bytes as a MESSAGE with standard padding
// (sha1/sha2 crates), so the digests asserted below are the standard ones:
//   SHA-256("")    = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
//   SHA-256("abcd")= 88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589
//   SHA-1("abcd")  = 81fe8bfe87576c3ecb22426f8e57847382917acf
// Reproduce with:  printf '' | sha256sum ; printf abcd | sha256sum ;
//                  printf abcd | sha1sum
// Two of them are the published FIPS 180-4 / RFC 3174 vectors for the empty
// message, and the third tracks a real message, so the digest provably
// follows the input.
//
// ENGINE GAPS found while proving this (patch delivered to the engine owner
// in patches/f4-hash-silicon-fixes.patch, NOT applied here):
//   (a) HASH_CR.INIT is modelled at bit 0; RM0090 puts it at bit 2, so
//       silicon firmware doing `HASH_CR |= HASH_INIT` never restarts the
//       digest calculation (the buffer is not cleared).
//   (b) HASH_SR writes SET DINIS/DCIS; on silicon they are rc_w1 (write 1
//       clears), so firmware can never acknowledge the flag.
//   (c) The SHA-256 digest is mirrored into HR0..HR3 only, so the main
//       bank's HR4 reads 0 instead of digest word 4 (the alias bank has all
//       8). The cell reads the full digest from the alias bank, so it is
//       unaffected by (c).
const TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
  { tag: 'F429', type: 'openhw-stm32f429', id: 'f429' },
];

// IWDG arming sequence (shared by both IWDG cells):
//   KR=0xCCCC start, KR=0x5555 unlock PR/RLR, PR=0 (/4), RLR=0xFFF (max),
//   read SR (update flags prove the writes landed), KR=0xAAAA load.
const IWDG_ARM = (tag) =>
  '  IWDG_KR = 0xCCCCUL;\n' +
  '  IWDG_KR = 0x5555UL;\n' +
  '  IWDG_PR = 0UL;\n' +
  '  IWDG_RLR = 0xFFFUL;\n' +
  '  IWDG_SRVAL = IWDG_SR;\n' +
  '  IWDG_KR = 0xAAAAUL;\n';

const IWDG_DEFS =
  '#define IWDG_KR (*(volatile uint32_t*)0x40003000UL)\n' +
  '#define IWDG_PR (*(volatile uint32_t*)0x40003004UL)\n' +
  '#define IWDG_RLR (*(volatile uint32_t*)0x40003008UL)\n' +
  '#define IWDG_SR (*(volatile uint32_t*)0x4000300CUL)\n';

// Control arm: pet forever. delay(4) keeps the pet interval well inside
// the ~13 guest-ms window (3.2x margin) while still crossing it many
// times. The SR value rides on every line so the arming proof survives a
// serial-history trim.
const WDG_PET_ALWAYS = (tag) =>
  IWDG_DEFS +
  'static uint32_t IWDG_SRVAL = 0;\n' +
  'void setup() {\n' +
  '  Serial.begin(9600);\n' +
  '  Serial.println("' + tag + 'WDG_READY");\n' +
  IWDG_ARM(tag) +
  '}\n' +
  'void loop() {\n' +
  '  IWDG_KR = 0xAAAAUL;\n' +
  '  Serial.print("' + tag + 'WDG_PET:"); Serial.print(millis()); Serial.print(":"); Serial.println(IWDG_SRVAL, HEX);\n' +
  '  delay(4);\n' +
  '}\n';

// Test arm: pet 3 times, then stop petting and spin until the watchdog
// resets the core.
const WDG_PET_THEN_STOP = (tag) =>
  IWDG_DEFS +
  'static uint32_t IWDG_SRVAL = 0;\n' +
  'void setup() {\n' +
  '  Serial.begin(9600);\n' +
  '  Serial.println("' + tag + 'WDG_READY");\n' +
  IWDG_ARM(tag) +
  '}\n' +
  'void loop() {\n' +
  '  static int n = 0;\n' +
  '  static bool armed = false;\n' +
  '  if (n < 3) {\n' +
  '    IWDG_KR = 0xAAAAUL;\n' +
  '    Serial.print("' + tag + 'WDG_PET:"); Serial.println(millis());\n' +
  '    n++;\n' +
  '    delay(2);\n' +
  '  } else {\n' +
  '    if (!armed) { armed = true; Serial.println("' + tag + 'WDG_ARMED"); }\n' +
  '    Serial.print("' + tag + 'WDG_SPIN:"); Serial.println(millis());\n' +
  '    delay(1);\n' +
  '  }\n' +
  '}\n';

const EXTI_CODE = '#include <Arduino.h>\n#define EXTI_IMR (*(volatile uint32_t*)0x40013C00UL)\n#define EXTI_SWIER (*(volatile uint32_t*)0x40013C10UL)\nvolatile bool fired = false;\nvoid isr() { fired = true; }\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("EXTI_READY");\n  attachInterrupt(PB0, isr, RISING);\n  EXTI_IMR |= 1UL;\n  EXTI_SWIER |= 1UL;\n  Serial.println("EXTI_TRIG");\n}\nvoid loop() {\n  if (fired) { Serial.println("EXTI_FIRED"); fired = false; }\n  delay(500);\n}\n';

const BKP_CODE = '#define RCC_APB1ENR (*(volatile uint32_t*)0x40023840UL)\n#define PWR_CR (*(volatile uint32_t*)0x40007000UL)\n#define RTC_BKP0R (*(volatile uint32_t*)0x40002850UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("BKP_READY");\n  RCC_APB1ENR |= (1UL<<28);\n  PWR_CR |= (1UL<<8);\n  RTC_BKP0R = 0xCAFE1234UL;\n  uint32_t r = RTC_BKP0R;\n  Serial.print("BKP_HEX:"); Serial.println(r, HEX);\n  if (r == 0xCAFE1234UL) Serial.println("BKP_OK");\n  else Serial.println("BKP_MISMATCH");\n}\nvoid loop() { delay(2000); }\n';

const HASH_CODE = '#define RCC_AHB2ENR (*(volatile uint32_t*)0x40023834UL)\n#define HASH_CR (*(volatile uint32_t*)0x50060400UL)\n#define HASH_DIN (*(volatile uint32_t*)0x50060404UL)\n#define HASH_STR (*(volatile uint32_t*)0x50060408UL)\n#define HASH_SR (*(volatile uint32_t*)0x50060424UL)\n#define HASH_HR(i) (*(volatile uint32_t*)(0x5006040CUL + (i)*4UL))\n#define HASH_ALIAS(i) (*(volatile uint32_t*)(0x50060710UL + (i)*4UL))\nstatic const uint32_t EXP_A[8] = {0xE3B0C442UL,0x98FC1C14UL,0x9AFBF4C8UL,0x996FB924UL,0x27AE41E4UL,0x649B934CUL,0xA495991BUL,0x7852B855UL};\nstatic const uint32_t EXP_B[8] = {0x88D4266FUL,0xD4E6338DUL,0x13B845FCUL,0xF289579DUL,0x209C8978UL,0x23B9217DUL,0xA3E16193UL,0x6F031589UL};\nstatic const uint32_t EXP_C[5] = {0x81FE8BFEUL,0x87576C3EUL,0xCB22426FUL,0x8E578473UL,0x82917ACFUL};\nvoid putHex32(uint32_t v) { for (int i = 7; i >= 0; i--) { uint8_t d = (uint8_t)((v >> (i*4)) & 0xF); Serial.print((char)(d < 10 ? (\'0\'+d) : (\'A\'+d-10))); } }\nvoid emit(const char* tag, const uint32_t* w, int n) { Serial.print(tag); for (int i = 0; i < n; i++) { Serial.print(" "); putHex32(w[i]); } Serial.println(""); }\nvoid waitDcis() { unsigned long to = 0; while (!(HASH_SR & 0x2UL) && ++to < 1000000UL) {} }\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("F407HASH_READY");\n  RCC_AHB2ENR |= (1UL<<5);\n  uint32_t a[8]; uint32_t b[8]; uint32_t c[5]; uint32_t am[4]; uint32_t cm[5];\n  int bad = 0;\n  HASH_CR = (1UL<<18);\n  HASH_STR = (1UL<<8);\n  waitDcis();\n  for (int i = 0; i < 8; i++) a[i] = HASH_ALIAS(i);\n  for (int i = 0; i < 4; i++) am[i] = HASH_HR(i);\n  emit("F407HASH_A", a, 8);\n  emit("F407HASH_AM", am, 4);\n  HASH_SR = 0x3;\n  HASH_DIN = 0x61626364UL;\n  HASH_STR = (1UL<<8) | 32UL;\n  waitDcis();\n  for (int i = 0; i < 8; i++) b[i] = HASH_ALIAS(i);\n  emit("F407HASH_B", b, 8);\n  HASH_SR = 0x3;\n  HASH_CR = 0UL;\n  HASH_STR = (1UL<<8) | 32UL;\n  waitDcis();\n  for (int i = 0; i < 5; i++) c[i] = HASH_ALIAS(i);\n  for (int i = 0; i < 5; i++) cm[i] = HASH_HR(i);\n  emit("F407HASH_C", c, 5);\n  emit("F407HASH_CM", cm, 5);\n  for (int i = 0; i < 8; i++) if (a[i] != EXP_A[i]) bad++;\n  for (int i = 0; i < 8; i++) if (b[i] != EXP_B[i]) bad++;\n  for (int i = 0; i < 5; i++) if (c[i] != EXP_C[i]) bad++;\n  for (int i = 0; i < 5; i++) if (cm[i] != EXP_C[i]) bad++;\n  for (int i = 0; i < 4; i++) if (am[i] != EXP_A[i]) bad++;\n  if (bad == 0) Serial.println("F407HASH_OK");\n  else { Serial.print("F407HASH_MISMATCH:"); Serial.println(bad); }\n}\nvoid loop() { delay(2000); }\n';

// SHA-256("") / SHA-256("abcd") / SHA-1("abcd") — hex words, big-endian.
const HASH_EXPECT = {
  F407HASH_A: ['E3B0C442', '98FC1C14', '9AFBF4C8', '996FB924', '27AE41E4', '649B934C', 'A495991B', '7852B855'],
  F407HASH_AM: ['E3B0C442', '98FC1C14', '9AFBF4C8', '996FB924'],
  F407HASH_B: ['88D4266F', 'D4E6338D', '13B845FC', 'F289579D', '209C8978', '23B9217D', 'A3E16193', '6F031589'],
  F407HASH_C: ['81FE8BFE', '87576C3E', 'CB22426F', '8E578473', '82917ACF'],
  F407HASH_CM: ['81FE8BFE', '87576C3E', 'CB22426F', '8E578473', '82917ACF'],
};

// The hex words a tag printed, tolerating a marker interleaved on the
// same line by the runner's synthetic serial sources.
function digestWords(serial, tag) {
  for (const raw of String(serial || '').split(/\r?\n/)) {
    const i = raw.indexOf(tag);
    if (i < 0) continue;
    const words = raw.slice(i + tag.length).trim().split(/\s+/).filter(Boolean);
    if (words.length) return words.map((w) => w.toUpperCase());
  }
  return null;
}

test.describe('F4 system blocks (IWDG / EXTI-SWIER / BKP / HASH)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type, id } of TYPES) {
    test(`IWDG stays alive while it is petted (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 60000 });
      await page.waitForTimeout(3000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, i: id, code: WDG_PET_ALWAYS(tag) });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate((needle) => window.OpenHWE2E.run({
        forMs: 15000, serialNeedle: needle, telemetryMode: 'detail',
      }), `${tag}WDG_PET`);
      expect(verdict.ok).toBe(true);
      const serial = verdict.serial || '';
      console.log(`${tag}WDG-pet reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      // The pet lines carry the IWDG_SR value read right after the PR/RLR
      // writes: bit 1 (RLR update flag) can only be set if the write was
      // accepted while the unlock key was latched -> the arming protocol
      // really happened.
      const pets = [...serial.matchAll(new RegExp(`${tag}WDG_PET:(\\d+):([0-9A-Fa-f]+)`, 'g'))];
      expect(pets.length).toBeGreaterThanOrEqual(4);
      for (const p of pets) {
        expect(parseInt(p[2], 16) & 0x2).not.toBe(0);
      }
      // No reboot: millis() never runs backwards and the firmware never
      // re-announces itself.
      const ms = pets.map((p) => Number(p[1]));
      for (let i = 1; i < ms.length; i++) {
        expect(ms[i]).toBeGreaterThan(ms[i - 1]);
      }
      expect((serial.match(new RegExp(`${tag}WDG_READY`, 'g')) || []).length).toBeLessThanOrEqual(1);
      // The loop ran for at least 4.6 IWDG windows (~13 guest-ms each)
      // while being petted: a broken reload would have reset the board
      // every ~13 guest-ms.
      expect(Math.max(...ms) - Math.min(...ms)).toBeGreaterThanOrEqual(60);
      console.log(`${tag}WDG-pet guest span:`, Math.max(...ms) - Math.min(...ms), 'ms, pets:', pets.length);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`IWDG fires after petting stops (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 60000 });
      await page.waitForTimeout(3000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, i: id, code: WDG_PET_THEN_STOP(tag) });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate((needle) => window.OpenHWE2E.run({
        forMs: 15000, serialNeedle: needle, telemetryMode: 'detail',
      }), `${tag}WDG_ARMED`);
      expect(verdict.ok).toBe(true);
      const serial = verdict.serial || '';
      console.log(`${tag}WDG reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}WDG serial head:`, serial.slice(0, 400));
      expect(serial).toContain(`${tag}WDG_ARMED`);
      // Segment the serial into boots (the firmware re-announces itself in
      // setup(), so every READY starts a new boot).
      const lines = serial.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const boots = [];
      for (const line of lines) {
        if (line.includes(`${tag}WDG_READY`)) boots.push([]);
        if (!boots.length) boots.push([]);
        boots[boots.length - 1].push(line);
      }
      // A boot that petted >= 3 times, then stopped petting (ARMED) and
      // spun until the watchdog reset it. The LAST boot may be cut short by
      // the end of the run, so only the closed boots count.
      const closed = boots.slice(0, -1);
      const armed = closed.filter((b) => {
        const pets = b.filter((l) => l.includes(`${tag}WDG_PET:`)).length;
        const spins = b.filter((l) => l.includes(`${tag}WDG_SPIN:`)).length;
        return pets >= 3 && spins >= 1 && b.some((l) => l.includes(`${tag}WDG_ARMED`));
      });
      console.log(`${tag}WDG boots:`, boots.length, 'closed:', closed.length, 'armed:', armed.length);
      expect(armed.length).toBeGreaterThanOrEqual(1);
      // The reset came from the watchdog, not from anything else: the board
      // rebooted after the petting stopped and the spin phase lasted about
      // one IWDG window (~13 guest-ms -> 13 spin iterations of delay(1)).
      const spinCount = armed[0].filter((l) => l.includes(`${tag}WDG_SPIN:`)).length;
      console.log(`${tag}WDG spins before reset:`, spinCount);
      expect(spinCount).toBeGreaterThanOrEqual(3);
      expect(spinCount).toBeLessThanOrEqual(40);
      // The clock restarts on the reset: the last millis of the closed boot
      // is far above the first millis of the next one.
      const msOf = (l) => {
        const m = l.match(/WDG_(?:PET|SPIN):(\d+)/);
        return m ? Number(m[1]) : null;
      };
      const lastMs = msOf(closed[closed.length - 1][closed[closed.length - 1].length - 1]);
      const nextFirst = boots[boots.length - 1].map(msOf).find((v) => v !== null && v !== undefined);
      if (lastMs !== null && nextFirst !== undefined) {
        expect(nextFirst).toBeLessThan(lastMs);
      }
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`EXTI software trigger reaches the ISR (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, i: id, code: EXTI_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'EXTI_FIRED', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}EXTI reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}EXTI serial:`, (verdict.serial || '').slice(0, 300));
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain('EXTI_TRIG');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`RTC_BKP0R keeps its magic (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, i: id, code: BKP_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'BKP_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}BKP reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toMatch(/BKP_HEX:CAFE1234/i);
      expect(verdict.serial || '').not.toContain('BKP_MISMATCH');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`HASH computes standard SHA-256 and SHA-1 digests (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 60000 });
      await page.waitForTimeout(3000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, i: id, code: HASH_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 30000, serialNeedle: 'F407HASH_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}HASH reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}HASH serial:`, (verdict.serial || '').slice(0, 600));
      expect(verdict.pass).toBe(true);
      const serial = verdict.serial || '';
      expect(serial).not.toContain('F407HASH_MISMATCH');
      // The digests themselves (the cell is the authority, not the guest's
      // own comparison): SHA-256 of the empty message (the published FIPS
      // 180-4 vector), SHA-256 of "abcd", SHA-1 of "abcd", and the main
      // bank carrying the same words.
      for (const [tagName, want] of Object.entries(HASH_EXPECT)) {
        const got = digestWords(serial, tagName);
        console.log(`${tag}HASH ${tagName}:`, JSON.stringify(got));
        expect(got, `${tagName} digest not found`).toBeTruthy();
        expect(got.slice(0, want.length)).toEqual(want);
      }
      // The digest follows the input: the empty-message digest and the
      // "abcd" digest are different.
      expect(digestWords(serial, 'F407HASH_A')).not.toEqual(digestWords(serial, 'F407HASH_B'));
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
