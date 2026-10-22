#!/usr/bin/env node
// RP2350 RV32 capability probe (pico-emu WASM) — runtime evidence for
// patches/pico-rp2350-sio-gpio-map.patch.
//
//   node patches/probe-pico2-rv32.mjs                     # repo engine bytes
//   ENGINE=/path/to/patched/picoemu.wasm.js node patches/probe-pico2-rv32.mjs
//
// Boots the engine on the RV32 (Hazard3) arch and runs
// patches/probe-pico2-rv32.ino, printing:
//   * the guest's own readback of a pin it drives (RVPROBE:OUT15)
//   * the engine's GPIO OUT latch (the host-side view)
//   * the SPI mirror: the MOSI bytes that went out + the CS edges the
//     engine's SPI device actually saw.
//
// Set ARCH=2 for the RP2350-M33 arch (same sketch, same assertions) to
// see the M33/RV32 difference side by side.
//
// Firmware build:
//   arduino-cli compile --fqbn rp2040:rp2040:rpipico2:arch=riscv \
//     --build-path <build> --output-dir <out> patches/probe-pico2-rv32.ino
// (arduino-cli needs the .ino in a directory of the same name.)
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '..');
const ENGINE = process.env.ENGINE || path.join(REPO, 'src/engines/pico-emu/picoemu.wasm.js');
const UF2 = process.env.UF2 || '/tmp/opencode/rvprobe/out/rvprobe.ino.uf2';
const ARCH = Number(process.env.ARCH || 1); // 0 = RP2040, 1 = RV32, 2 = RP2350-M33

const PicoemuModule = (await import(ENGINE)).default;
const mod = await PicoemuModule({ print: () => {}, printErr: () => {} });

let _uartBuf = 0;
function drainUart() {
  if (!_uartBuf) _uartBuf = mod._malloc(4096);
  const n = mod._picoemu_read_uart_bulk(_uartBuf, 4096);
  if (n <= 0) return '';
  return Buffer.from(mod.HEAPU8.subarray(_uartBuf, _uartBuf + n)).toString('latin1');
}

mod._picoemu_init(ARCH);
mod._picoemu_set_clock(150);

// ADC inject: the runner pushes the pot wiper voltages into the engine
// as 12-bit codes (pico-runner.ts drivePicoADC: code = volts/3.3*4095).
// 50% of 3V3 -> 2048 (GP26/ADC0), 10% -> 410 (GP27/ADC1).
if (typeof mod._picoemu_adc_set === 'function') {
  mod._picoemu_adc_set(0, 2048);
  mod._picoemu_adc_set(1, 410);
  console.log('adc_set ch0=2048 (50%) ch1=410 (10%)');
}

// SPI tap on SPI0: records the MOSI bytes and the CS edges the engine's
// SPI device actually saw (engine src/sdd_spimirror.c).
{
  const arg = 'spimirror:spi=0';
  const ap = mod._malloc(arg.length + 1);
  mod.HEAPU8.set(new TextEncoder().encode(arg + '\0'), ap);
  console.log('spimirror rc=' + mod._picoemu_sdd_add(ap));
  mod._free(ap);
}

{
  const uf2 = new Uint8Array(fs.readFileSync(UF2));
  const p = mod._malloc(uf2.length);
  mod.HEAPU8.set(uf2, p);
  mod._picoemu_load_uf2(p, uf2.length);
  mod._free(p);
}
mod._picoemu_reset();

let serial = '';
// The RV32 core needs a big instruction budget for a millisecond of
// guest time (the WFI fast-forward of the ARM path is not mirrored in
// src/picoemu_wasm.c's RV32 loop), so step in large chunks.
for (let i = 0; i < 20000; i++) {
  mod._picoemu_step(2000);
  serial += drainUart();
  if (serial.includes('RVPROBE:END')) break;
}
console.log('engine=' + ENGINE + '  arch=' + ARCH);
console.log('--- guest serial ---');
console.log(serial.trim());
console.log('--- end serial ---');

// The engine's OUT latch (the host-side view of what the guest drove).
const out = (mod._picoemu_get_gpio_out() >>> 0);
console.log('GPIO OUT latch = 0x' + out.toString(16) + '  (bit15 GP15 = ' + ((out >> 15) & 1) +
  ', bit17 CS = ' + ((out >> 17) & 1) + ')');

// SPI mirror observation.
{
  const p = mod._malloc(4096 * 2);
  const n = mod._picoemu_spimirror_pop(p, 4096);
  if (n > 0) {
    const v = new Uint16Array(mod.HEAPU8.buffer, p, n);
    const mosi = [];
    const cs = [];
    for (const e of v) {
      if ((e & 0xff00) === 0x0100) cs.push('CS-ASSERT(spi' + (e & 1) + ')');
      else if ((e & 0xff00) === 0x0200) cs.push('CS-DEASSERT(spi' + (e & 1) + ')');
      else mosi.push(e & 0xff);
    }
    console.log('mirror entries=' + n);
    console.log('MOSI bytes (' + mosi.length + '): ' +
      mosi.map((b) => b.toString(16).padStart(2, '0')).join(' '));
    console.log('CS events (' + cs.length + '): ' + (cs.join(', ') || '(NONE)'));
  } else {
    console.log('mirror entries=0');
  }
  mod._free(p);
}
