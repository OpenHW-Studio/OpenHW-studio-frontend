#!/usr/bin/env node
// SD-card CS probe (pico-emu WASM) — runtime proof for
// patches/pico-sd-cs-watch.patch.
//
//   node patches/probe-pico-sd-cs.mjs                 # MODE=sd    (card attached)
//   MODE=mirror node patches/probe-pico-sd-cs.mjs     # MODE=mirror (tap attached)
//   ENGINE=<patched engine glue> node patches/probe-pico-sd-cs.mjs
//
// Boots the engine and runs the raw-SPI SD bring-up firmware
// (probe-pico-sd-cs.ino), printing the card's R0 / R7 / R1 / OCR.
//
// The two modes answer two different questions and BOTH are needed:
//
//   MODE=sd      the SD MODEL is attached on SPI0. The card answers only
//                while `sd->cs_active` is set (engine src/sdcard.c:379),
//                and that flag is raised by spi_device_cs() — which the
//                ARM path never calls. Unpatched: every response is 0xFF.
//                Patched: real card responses.
//   MODE=mirror  the SPI TAP is attached on SPI0 instead of the card. It
//                records every MOSI byte AND every CS assert/deassert the
//                engine's SPI device actually saw (engine
//                src/sdd_spimirror.c:34-35). Unpatched: the MOSI bytes
//                arrive but the CS event count is 0 — the engine never
//                tells the device that the chip-select moved.
//
// (The SPI bus carries ONE device, so the card and the tap cannot both
// sit on SPI0 — hence two modes instead of one.)
//
// Firmware build:
//   arduino-cli compile --fqbn rp2040:rp2040:rpipico \
//     --build-path <build> --output-dir <out> \
//     patches/probe-pico-sd-cs.ino
// (arduino-cli needs the .ino in a directory of the same name.)
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '..');
const ENGINE = process.env.ENGINE || path.join(REPO, 'src/engines/pico-emu/picoemu.wasm.js');
const IMG = process.env.IMG || path.join(REPO, 'public/firmware/sd/fat16.img');
const UF2 = process.env.UF2 || '/tmp/opencode/sdprobe2/out/probe-pico-sd-cs.ino.uf2';
const CS_PIN = Number(process.env.CS_PIN || 5);
const MODE = process.env.MODE || 'sd';

const PicoemuModule = (await import(ENGINE)).default;
const mod = await PicoemuModule({ print: () => {}, printErr: () => {} });

let _uartBuf = 0;
function drainUart() {
  if (!_uartBuf) _uartBuf = mod._malloc(4096);
  const n = mod._picoemu_read_uart_bulk(_uartBuf, 4096);
  if (n <= 0) return '';
  return Buffer.from(mod.HEAPU8.subarray(_uartBuf, _uartBuf + n)).toString('latin1');
}

mod._picoemu_init(0);
mod._picoemu_set_clock(125);

console.log('MODE=' + MODE + '  engine=' + ENGINE);

if (MODE === 'mirror') {
  // SPI tap on SPI0: observes the MOSI bytes and the CS edges.
  const arg = 'spimirror:spi=0';
  const ap = mod._malloc(arg.length + 1);
  mod.HEAPU8.set(new TextEncoder().encode(arg + '\0'), ap);
  console.log('spimirror rc=' + mod._picoemu_sdd_add(ap));
  mod._free(ap);
} else {
  const img = new Uint8Array(fs.readFileSync(IMG));
  const p = mod._malloc(img.length);
  mod.HEAPU8.set(img, p);
  console.log('sdcard_load rc=' + mod._picoemu_sdcard_load(p, img.length, 0) + ' bytes=' + img.length);
  mod._free(p);
}
if (typeof mod._picoemu_sdcard_cs_pin === 'function') {
  console.log('sdcard_cs_pin(' + CS_PIN + ') rc=' + mod._picoemu_sdcard_cs_pin(CS_PIN));
} else {
  console.log('sdcard_cs_pin export MISSING (unpatched engine)');
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
const csSeq = [];
for (let i = 0; i < 400; i++) {
  mod._picoemu_step(2000);
  serial += drainUart();
  const out = (mod._picoemu_get_gpio_out() >>> 0);
  const cs = (out >>> CS_PIN) & 1;
  const last = csSeq.length ? csSeq[csSeq.length - 1] : -1;
  if (cs !== last) csSeq.push(cs);
  if (serial.includes('SDPROBE:END')) break;
}
console.log('--- guest serial ---');
console.log(serial.trim());
console.log('--- end serial ---');
console.log('GP' + CS_PIN + ' (guest CS pin) OUT-latch transitions: ' +
  csSeq.map(v => (v ? 'HIGH' : 'LOW')).join(' -> '));

// SPI0 register state (RP2040 SPI0 = 0x4003C000). The peripheral itself
// must be alive: if CR0/SR/RIS are zero the guest never talked to SPI.
const SPI0 = 0x4003C000;
const R = (a) => (mod._picoemu_mem_read32(a) >>> 0).toString(16);
console.log('SPI0 CR0=' + R(SPI0 + 0x00) + ' CR1=' + R(SPI0 + 0x04) +
  ' SR=' + R(SPI0 + 0x0c) + ' CPSR=' + R(SPI0 + 0x10) + ' RIS=' + R(SPI0 + 0x18));

// SPI mirror observation: every byte the guest shifted out plus the CS
// assert/deassert events the engine's SPI device actually saw.
// Engine: src/sdd_spimirror.c:34-35 — 0x0100|spi = CS assert,
// 0x0200|spi = CS deassert. The SD model only answers while cs_active
// is set (src/sdcard.c:379), so "CS events (0)" == "the device never saw
// the chip-select move".
if (MODE === 'mirror') {
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
      mosi.map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('CS events (' + cs.length + '): ' + (cs.join(', ') || '(NONE)'));
  } else {
    console.log('mirror entries=0');
  }
  mod._free(p);
} else {
  console.log('(spimirror tap not attached in MODE=sd — the SPI bus carries '
    + 'ONE device; run MODE=mirror for the byte-level observation)');
}
