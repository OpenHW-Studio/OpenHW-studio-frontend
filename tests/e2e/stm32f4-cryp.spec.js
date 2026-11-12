import { test, expect } from '@playwright/test';

// F4 CRYP / AES cell — lane/f4-cov2 (2026-10-20).
//
// The matrix's system/crypto table carried "CRYP still NONE (cryp.rs)" for
// the STM32F4 row. The engine really does model the block: the crate's
// `peripherals/cryp.rs` is a real AES/DES implementation (aes + des +
// cbc/ctr/gcm/ccm modes), and the F407/F429 SVDs map it at 0x50060000
// (site/vendor/stm32f407.svd:39739-39745). This cell proves the datapath
// against a PUBLISHED vector instead of trusting the model:
//
//   FIPS-197 (AES-128, ECB, encrypt)
//     key        000102030405060708090a0b0c0d0e0f
//     plaintext  00112233445566778899aabbccddeeff
//     ciphertext 69c4e0d86a7b0430d8cdb78070b4c55a
//
// Register map used (RM0090 §26.4, matches the model's offsets):
//   CR   0x50060000  EN=bit15, ALGOMODE=bits5:3 (+bit19), KEYSIZE=bits9:8,
//                   CHMOD=bit4 (0=encrypt), DATATYPE=bits7:6, RESET=bit14
//   SR   0x50060004  OFNE=bit2 (output FIFO not empty)
//   DIN  0x50060008  input word (big-endian bytes into the FIFO)
//   DOUT 0x5006000C  output word (big-endian bytes out of the FIFO)
//   K0..K7 0x50060020 + 4*i   key words (big-endian)
//   IV0..IV3 0x50060040 + 4*i
//
// The engine's key/DIN/DOUT byte order was read off the model, not guessed:
//   key_bytes()  = key[i].to_be_bytes()  for i < keysize/4   (cryp.rs:93-101)
//   DIN write    = value.to_be_bytes() pushed into the input FIFO (cryp.rs:614-621)
//   DOUT read    = u32::from_be_bytes(next 4 FIFO bytes)      (cryp.rs:545-565)
// so K0..K3 = 0x00010203,0x04050607,0x08090a0b,0x0c0d0e0f reproduce the
// FIPS-197 key byte-for-byte.
//
// CHIP SCOPE: the CRYP block exists only on the dice whose CHIPS flags say
// so (node_modules/stm32f4-emu/site/stm32f4.js:96-115 — cryp:true on
// stm32f407 / stm32f407ve / stm32f429, cryp:false on stm32f401 / stm32f411,
// which also matches silicon: the F401/F411 have no crypto accelerator).
// F401/F411 are therefore ABSENT, not NONE.
const TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
  { tag: 'F429', type: 'openhw-stm32f429', id: 'f429' },
];

const CODE = `#define RCC_AHB2ENR (*(volatile uint32_t*)0x40023834UL)
#define CRYP_CR   (*(volatile uint32_t*)0x50060000UL)
#define CRYP_SR   (*(volatile uint32_t*)0x50060004UL)
#define CRYP_DIN  (*(volatile uint32_t*)0x50060008UL)
#define CRYP_DOUT (*(volatile uint32_t*)0x5006000CUL)
#define CRYP_K(i) (*(volatile uint32_t*)(0x50060020UL + (i)*4UL))
void setup() {
  Serial.begin(9600);
  Serial.println("F4CRYP_READY");
  RCC_AHB2ENR |= (1UL << 4);          // CRYPEN (AHB2) — silicon order
  CRYP_K(0) = 0x00010203UL;          // FIPS-197 AES-128 key
  CRYP_K(1) = 0x04050607UL;
  CRYP_K(2) = 0x08090A0BUL;
  CRYP_K(3) = 0x0C0D0E0FUL;
  // EN=1, ALGOMODE=000 (ECB), KEYSIZE=00 (128-bit), CHMOD=0 (encrypt),
  // DATATYPE=00 (none), RESET=1 (clear the FIFOs before the first block).
  CRYP_CR = 0x0000C000UL;            // EN + RESET
  CRYP_CR = 0x00008000UL;            // EN only
  CRYP_DIN = 0x00112233UL;            // FIPS-197 plaintext
  CRYP_DIN = 0x44556677UL;
  CRYP_DIN = 0x8899AABBUL;
  CRYP_DIN = 0xCCDDEEFFUL;
  unsigned long to = 0;
  while (!(CRYP_SR & 0x4UL) && ++to < 100000UL) {}   // wait OFNE
  uint32_t w[4];
  for (int i = 0; i < 4; i++) w[i] = CRYP_DOUT;
  Serial.print("F4CRYP_W:");
  for (int i = 0; i < 4; i++) { Serial.print(" "); Serial.print(w[i], HEX); }
  Serial.println("");
  bool ok = (w[0] == 0x69C4E0D8UL) && (w[1] == 0x6A7B0430UL)
         && (w[2] == 0xD8CDB780UL) && (w[3] == 0x70B4C55AUL);
  if (ok) Serial.println("F4CRYP_OK");
  else Serial.println("F4CRYP_MISMATCH");
}
void loop() {
  Serial.println("F4CRYP_TICK");
  delay(1000);
}
`;

test.describe('F4 CRYP (AES-128 ECB vs the FIPS-197 vector)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type, id } of TYPES) {
    test(`AES-128 ECB encrypts the FIPS-197 plaintext to the published ciphertext (${type})`, async ({ page }) => {
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
        forMs: 20000, serialNeedle: 'F4CRYP_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      const serial = verdict.serial || '';
      console.log(`${tag}CRYP reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}CRYP serial:`, serial.slice(0, 400));
      expect(verdict.pass).toBe(true);
      expect(serial).toContain('F4CRYP_OK');
      expect(serial).not.toContain('F4CRYP_MISMATCH');
      // The four ciphertext words, exactly as published in FIPS-197 C.1.
      const m = /F4CRYP_W:\s*([0-9A-Fa-f]+)\s+([0-9A-Fa-f]+)\s+([0-9A-Fa-f]+)\s+([0-9A-Fa-f]+)/.exec(serial);
      expect(m).toBeTruthy();
      expect(m[1].toUpperCase()).toBe('69C4E0D8');
      expect(m[2].toUpperCase()).toBe('6A7B0430');
      expect(m[3].toUpperCase()).toBe('D8CDB780');
      expect(m[4].toUpperCase()).toBe('70B4C55A');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(1500);
    });
  }
});
