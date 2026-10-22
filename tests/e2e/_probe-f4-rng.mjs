// Lane/f4-cov2 — OFFLINE engine probe (node, no browser).
// Answers: what does the DEPLOYED F4 engine actually report in RNG_SR, and
// which bit is the model's DRDY?  The e2e cells poll bit 0 (the silicon
// F4 RNG_SR has DRDY at bit 4), so a stuck "DRDY never sets" verdict can
// be either an engine gap or a cell bug.  This probe reads the model
// directly: it loads the SAME bytes the runner loads (npm glue
// node_modules/stm32f4-emu/site/vendor/stm32_periph_wasm.js + the served
// public/wasm/stm32_periph_wasm_bg.wasm + the vendored F407 SVD) and pokes
// the RNG block from JS.
//
// It boots a prebuilt F4 image (public/firmware/f4/usb_cdc_test.bin) only
// to have a valid vector table — the guest code is irrelevant, the probe
// drives the peripheral through periphWrite/periphRead.
//
// Run:  node tests/e2e/_probe-f4-rng.mjs
import { readFileSync } from 'fs';
import { STM32F4 } from 'stm32f4-emu/stm32f4';
import * as bindings from 'stm32f4-emu/vendor';

const ROOT = new URL('../../', import.meta.url);
const wasmInit = new Uint8Array(readFileSync(new URL('public/wasm/stm32_periph_wasm_bg.wasm', ROOT)));
const svdXml = readFileSync(new URL('public/vendor/board-engines/stm32f4-emu/site/vendor/stm32f407.svd', ROOT), 'utf8');
const firmware = new Uint8Array(readFileSync(new URL('public/firmware/f4/usb_cdc_test.bin', ROOT)));

const emu = await STM32F4._create({
  chip: 'stm32f407',
  bindings,
  svdXml,
  wasmInit,
  firmware,
  uart_addr: 0x40004400,
  enable_irqs: true,
});

const RNG_CR = 0x50060800;
const RNG_SR = 0x50060804;
const RNG_DR = 0x50060808;
const RCC_AHB2ENR = 0x40023834;

const rd = (a) => emu.periphRead(a, 4) >>> 0;
const wr = (a, v) => emu.periphWrite(a, 4, v >>> 0);

console.log('AHB2ENR before =', rd(RCC_AHB2ENR).toString(16));
wr(RCC_AHB2ENR, rd(RCC_AHB2ENR) | (1 << 6));   // RNGEN clock gate
console.log('AHB2ENR after  =', rd(RCC_AHB2ENR).toString(16));

console.log('SR before CR write =', rd(RNG_SR).toString(16));
wr(RNG_CR, 0x04);   // RNGEN only (bit 2), no IE
console.log('CR after write     =', rd(RNG_CR).toString(16));
console.log('SR right after CR  =', rd(RNG_SR).toString(16));

for (let i = 0; i < 6; i++) {
  emu.step(20000);
  const sr = rd(RNG_SR);
  console.log(`after step ${i}: SR=${sr.toString(16)} (bits ${[...Array(8).keys()].filter((b) => (sr >> b) & 1).join(',')})`);
}

console.log('--- now read DR and re-read SR ---');
for (let i = 0; i < 4; i++) {
  const sr0 = rd(RNG_SR);
  const dr = rd(RNG_DR);
  const sr1 = rd(RNG_SR);
  console.log(`i=${i} SR0=${sr0.toString(16)} DR=${dr.toString(16)} SR1=${sr1.toString(16)}`);
}

// Which bit behaves like DRDY?  Poll a fresh sequence and report the bits
// that appear/disappear around a DR read.
console.log('--- bit survey: read SR, read DR, read SR, 8 rounds ---');
const seen = new Set();
for (let i = 0; i < 8; i++) {
  emu.step(5000);
  const a = rd(RNG_SR);
  const dr = rd(RNG_DR);
  const b = rd(RNG_SR);
  for (let bit = 0; bit < 8; bit++) {
    if ((a >> bit) & 1) seen.add(`bit${bit}:set-before-DR`);
    if (((a >> bit) & 1) && !((b >> bit) & 1)) seen.add(`bit${bit}:cleared-by-DR-read`);
  }
  console.log(`r${i} SRa=${a.toString(16)} DR=${dr.toString(16)} SRb=${b.toString(16)}`);
}
console.log('observed bit behaviour:', [...seen].join(' | '));
