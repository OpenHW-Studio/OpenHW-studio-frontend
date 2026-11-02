// Lane/f4-cov2 — offline LTDC probe: is the LTDC peripheral ticking on the
// deployed bytes, and does the guest's ISR flag ever fire?
import { readFileSync } from 'fs';
import { STM32F4 } from 'stm32f4-emu/stm32f4';
import * as bindings from 'stm32f4-emu/vendor';

const ROOT = new URL('../../', import.meta.url);
const chip = process.argv[2] || 'stm32f429';
const SVD = { stm32f401: 'stm32f401.svd', stm32f407: 'stm32f407.svd', stm32f407ve: 'stm32f407.svd', stm32f411: 'stm32f411.svd', stm32f429: 'stm32f429.svd' };

const wasmInit = new Uint8Array(readFileSync(new URL('public/wasm/stm32_periph_wasm_bg.wasm', ROOT)));
const svdXml = readFileSync(new URL(`public/vendor/board-engines/stm32f4-emu/site/vendor/${SVD[chip]}`, ROOT), 'utf8');
const firmware = new Uint8Array(readFileSync(new URL('public/firmware/f4/usb_cdc_test.bin', ROOT)));

const emu = await STM32F4._create({ chip, bindings, svdXml, wasmInit, firmware, uart_addr: 0x40011000, enable_irqs: true });
const rd = (a) => emu.periphRead(a, 4) >>> 0;
const wr = (a, v) => emu.periphWrite(a, 4, v >>> 0);

const LTDC = 0x40016800;
console.log('before: GCR=', rd(LTDC + 0x18).toString(16), 'ISR=', rd(LTDC + 0x38).toString(16));
wr(LTDC + 0x08, (7 << 16) | 7);      // SSCR
wr(LTDC + 0x0C, (8 << 16) | 8);      // BPCR
wr(LTDC + 0x10, (31 << 16) | 63);    // AWCR
wr(LTDC + 0x40, 49);                 // LIPCR
wr(LTDC + 0x88, 63 | (31 << 16));    // L1WHPCR
wr(LTDC + 0x8C, 63 | (31 << 16));    // L1WVPCR
wr(LTDC + 0x94, 0);                  // L1PFCR
wr(LTDC + 0xB0, (256 << 16) | 256);  // L1CFBLR
wr(LTDC + 0xB4, 32);                 // L1CFBDL
wr(LTDC + 0x84, 1);                  // L1CR
wr(LTDC + 0x18, rd(LTDC + 0x18) | 1);// GCR LTDCEN
console.log('after config: GCR=', rd(LTDC + 0x18).toString(16), 'ISR=', rd(LTDC + 0x38).toString(16));
for (let i = 0; i < 6; i++) {
  emu.execute(50000);
  console.log(`step ${i}: ISR=${rd(LTDC + 0x38).toString(16)}`);
}
console.log('--- now with the RCC LTDC clock enabled (APB2ENR bit 14) ---');
const RCC_APB2ENR = 0x40023844;
wr(RCC_APB2ENR, rd(RCC_APB2ENR) | (1 << 14));
for (let i = 0; i < 6; i++) {
  emu.execute(50000);
  console.log(`step ${i}: ISR=${rd(LTDC + 0x38).toString(16)}`);
}
