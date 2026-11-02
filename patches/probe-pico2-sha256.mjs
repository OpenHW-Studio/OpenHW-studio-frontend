#!/usr/bin/env node
// RP2350/M33 SHA-256 probe (pico-emu WASM) — runtime proof for
// patches/pico-m33-sha256-csr-map.patch.
//
//   node patches/probe-pico2-sha256.mjs                     # repo engine bytes
//   ENGINE=/path/to/patched/picoemu.wasm.js node patches/probe-pico2-sha256.mjs
//
// Boots the engine on the M33 arch (arch=2) and runs the canonical
// pico-sdk SHA-256 flow over "abc".
//
// Expected:
//   repo bytes   -> PICO2_SHA_STARTRC:0 / PICO2_SHA_WRITTEN and NO digest
//                   (sha256_wait_valid_blocking() polls SUM_VLD on the wrong bit)
//   patched      -> PICO2_SHA_DIGEST:BA7816BF...015AD  (FIPS 180-4 vector)
//
// Firmware build:
//   arduino-cli compile --fqbn rp2040:rp2040:rpipico2 --build-path <build> \
//     --output-dir <out> probe-pico2-sha256.ino
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '..');
const ENGINE = process.env.ENGINE || path.join(REPO, 'src/engines/pico-emu/picoemu.wasm.js');
const UF2 = process.env.UF2 || '/tmp/opencode/shaprobe/out/probe-pico2-sha256.ino.uf2';
const ARCH_M33 = 2;

const PicoemuModule = (await import(ENGINE)).default;
const mod = await PicoemuModule({ print: () => {}, printErr: () => {} });

let _uartBuf = 0;
function drainUart() {
  if (!_uartBuf) _uartBuf = mod._malloc(4096);
  const n = mod._picoemu_read_uart_bulk(_uartBuf, 4096);
  if (n <= 0) return '';
  return Buffer.from(mod.HEAPU8.subarray(_uartBuf, _uartBuf + n)).toString('latin1');
}

mod._picoemu_init(ARCH_M33);
mod._picoemu_set_clock(150);

const uf2 = new Uint8Array(fs.readFileSync(UF2));
const p = mod._malloc(uf2.length);
mod.HEAPU8.set(uf2, p);
mod._picoemu_load_uf2(p, uf2.length);
mod._free(p);
mod._picoemu_reset();

let serial = '';
for (let i = 0; i < 600; i++) {
  mod._picoemu_step(2000);
  serial += drainUart();
  // Wait for the digest LINE (32 hex chars) — 'PICO2_SHA_DIGEST:' alone can
  // arrive before the bytes behind it are flushed.
  if (/PICO2_SHA_DIGEST:[0-9A-Fa-f]{64}/.test(serial)) break;
  if (serial.includes('PICO2_SHA_TICK')) break;
}
console.log('engine=' + ENGINE);
console.log('--- guest serial ---');
console.log(serial.trim());
console.log('--- end serial ---');

const m = /PICO2_SHA_DIGEST:([0-9A-Fa-f]+)/.exec(serial);
const FIPS = 'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD';
if (!m) {
  console.log('RESULT: NO DIGEST (sha256_wait_valid_blocking() never returned)');
} else if (m[1].toUpperCase() === FIPS) {
  console.log('RESULT: FIPS 180-4 vector OK -> ' + m[1]);
} else {
  console.log('RESULT: WRONG DIGEST -> ' + m[1] + ' (expected ' + FIPS + ')');
}
