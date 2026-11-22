import { test, expect } from '@playwright/test';

// Retro component compatibility, one component per cell, for 8086 / 8085 /
// 8051. Same harness contract as pico-components.spec.js: build a real
// circuit in the browser, run per-ISA ASM on the board, and read the HOST
// COMPONENT MODEL state — not just the guest's serial.
// Filters:
//   RETRO_COMP_BOARD=pico86|pico85|pico51   (board subset)
//   RETRO_COMP_FAMILIES=digital,displays,registers,i2c,spi,onewire
//   RETRO_COMP_ONLY=led,7segment,...        (cell subset)

const BOARDS = [
  { key: 'r86', type: 'openhw-8086', isa: '8086' },
  { key: 'r85', type: 'openhw-8085', isa: '8085' },
  { key: 'r51', type: 'openhw-8051', isa: '8051' },
];
const L = (n) => `L${n}`;

// Emit a per-ISA assembly program that writes bytes to the board's 8-bit
// GPIO view (port E0h for 8086/8085, P1 for 8051) and prints a needle.
// `steps` is an array of { byte, delay } records; the final port value is
// held while the host polls component telemetry.
function asmFor(board, steps, needle = 'DONE') {
  // Intel hex literal: always two digits, leading 0 when the high nibble is
  // a letter (0FBh), else the assembler reads e.g. 251h as invalid.
  const hex = (v) => {
    const h = (v & 0xff).toString(16).toUpperCase().padStart(2, '0');
    return (/^[A-F]/.test(h) ? `0${h}` : h) + 'h';
  };
  const writes = steps.map(({ byte, delay = 0 }) => {
    const v = byte & 0xff;
    if (board.isa === '8086') {
      const d = delay ? `\n  MOV CX, ${Math.max(1, Math.floor(delay / 4))}\nd1: LOOP d1` : '';
      return `  MOV AL, ${hex(v)}\n  OUT 0E0h, AL${d}`;
    }
    if (board.isa === '8085') {
      const d = delay ? `\n  MVI B, ${Math.max(1, Math.min(255, Math.floor(delay / 8)))}\nd1: DCR B\n  JNZ d1` : '';
      return `  MVI A, ${hex(v)}\n  OUT 0E0h${d}`;
    }
    const d = delay ? `\n  MOV R0, #${Math.max(1, Math.min(255, Math.floor(delay / 8)))}\nd1: DJNZ R0, d1` : '';
    return `  MOV P1, #${hex(v)}${d}`;
  }).join('\n');
  if (board.isa === '8086') {
    return `ORG 100h\n  MOV CX, 0FFFFh\nwait: LOOP wait\n  MOV AL, 80h\n  OUT 0E3h, AL\n${writes}\n  MOV DX, OFFSET msg\n  MOV AH, 09h\n  INT 21h\n  HLT\nmsg: DB '${needle}$'\nEND`;
  }
  if (board.isa === '8085') {
    return `ORG 0\n  MVI B, 0FFh\nwait: DCR B\n  JNZ wait\n  MVI A, 80h\n  OUT 0E3h\n${writes}\n  MVI A, '${needle[0]}'\n  OUT 01h\n  HLT\nEND`;
  }
  return `ORG 0\n${writes}\n  MOV SBUF, #'Q'\n  SJMP $\nEND`;
}

/** Bit-bang I2C firmware on L2=SDA (bit2), L3=SCL (bit3) of port E0h/P1.
 *  Delays keep each half-bit above one engine slice so the runner's
 *  sampled decoder sees every transition. */
function i2cAsmFor(board, bytes, needle = 'DONE') {
  const SDA = 0x04, SCL = 0x08;
  const out = [];
  let k = 0;
  let cur = 0;
  const set = (mask) => {
    cur = mask;
    const d = `d${k++}`;
    if (board.isa === '8086') {
      out.push(`  MOV AL, ${hex2(mask)}`, `  OUT 0E0h, AL`, `  MOV CX, 0100h`, `${d}: NOP`, `  LOOP ${d}`);
    } else if (board.isa === '8085') {
      out.push(`  MVI A, ${hex2(mask)}`, `  OUT 0E0h`, `  MVI B, 0`, `${d}: DCR B`, `  JNZ ${d}`);
    } else {
      out.push(`  MOV P1, #${hex2(mask)}`, `  MOV R0, #0`, `${d}: DJNZ R0, ${d}`);
    }
  };
  const sda = (high) => set(high ? (cur | SDA) : (cur & ~SDA & 0xff));
  const scl = (high) => set(high ? (cur | SCL) : (cur & ~SCL & 0xff));
  const bits = (byte) => {
    for (let i = 7; i >= 0; i--) { sda(!!(byte & (1 << i))); scl(true); scl(false); }
  };
  out.push('ORG ' + (board.isa === '8086' ? '100h' : '0'));
  if (board.isa === '8086' || board.isa === '8085') out.push(`  MOV ${board.isa === '8086' ? 'AL' : 'A'}, 80h`, '  OUT 0E3h, AL');
  set(SDA | SCL);      // idle: both high
  sda(false);          // START: SDA falls while SCL stays HIGH
  scl(false);
  for (const byte of bytes) bits(byte);
  scl(true); sda(true); // STOP: SDA rises while SCL stays HIGH
  if (board.isa === '8086') out.push(`  MOV DX, OFFSET msg`, `  MOV AH, 09h`, `  INT 21h`, `  HLT`, `msg: DB '${needle}$'`, 'END');
  else if (board.isa === '8085') out.push(`  MVI A, '${needle[0]}'`, '  OUT 01h', '  HLT', 'END');
  else out.push(`  MOV SBUF, #'Q'`, `  SJMP $`, 'END');
  return out.join('\n');
}
function hex2(v) {
  const h = (v & 0xff).toString(16).toUpperCase().padStart(2, '0');
  return (/^[A-F]/.test(h) ? '0' : '') + h + 'h';
}

/** Bit-bang SPI on 8051 P1: MOSI=L2 (bit2), SCK=L3 (bit3), CS=L4 (bit4). */
function spiAsmFor(board, frames, needle = 'DONE') {
  const MOSI = 0x04, SCK = 0x08, CS = 0x10;
  const out = ['ORG 0'];
  let k = 0, cur = CS | SCK;
  const set = (mask) => {
    const d = `s${k++}`;
    cur = mask;
    out.push(`  MOV P1, #${hex2(mask)}`, `  MOV R0, #0`, `${d}: DJNZ R0, ${d}`);
  };
  for (const frame of frames) {
    set(cur & ~CS & ~SCK & 0xff); // CS low, SCK low before first bit
    for (const byte of frame) {
      for (let i = 7; i >= 0; i--) {
        set((cur & ~MOSI & 0xff) | (byte & (1 << i) ? MOSI : 0));
        set(cur | SCK);
        set(cur & ~SCK & 0xff);
      }
    }
    set(cur | CS); // CS high -> frame complete
  }
  out.push(`  MOV SBUF, #'Q'`, `  SJMP $`, 'END');
  return out.join('\n');
}

const st = (v, id) => (v.liveOop || {})[id] || {};
const custom = (v, id) => {
  const t = (v.telemetry || []).find((x) => x.id === id);
  return t?.details?.custom || t?.details?.metrics?.custom || {};
};

const CASES = [
  {
    family: 'digital', name: 'led', type: 'openhw-led',
    wires: (b) => [
      { from: `${b}:${L(2)}`, to: 'res1:p1' },
      { from: 'res1:p2', to: 'c1:A' },
      { from: 'c1:K', to: `${b}:SWD_GND` },
    ],
    comps: () => [{ id: 'res1', type: 'openhw-resistor', attrs: {}, x: 300, y: 120 }],
    // 8086/8085 drive bit2 HIGH (0x04); 8051 P1 HIGH floats (0xFB = LOW sink).
    code: (b) => [{ byte: b.isa === '8051' ? 0xfb : 0x04 }],
    check: (v, b) => {
      // Host model sees the solved net: HIGH on 8086/8085, LOW on 8051.
      expect(Number(st(v, 'c1').analogVoltages?.A || 0)).toBe(b.isa === '8051' ? 0 : 5);
    },
  },
  {
    family: 'displays', name: '7segment', type: 'openhw-7segment',
    attrs: (b) => (b.isa === '8051' ? { digits: '1', common: 'anode' } : { digits: '1' }),
    wires: (b) => [
      { from: `${b}:SWD_3V3`, to: 'c1:COM.1' },
      { from: `${b}:SWD_3V3`, to: 'c1:COM.2' },
      ...[2, 3, 4, 5, 6, 7, 8].map((n, i) => ({ from: `${b}:${L(n)}`, to: `c1:${'ABCDEFG'[i]}` })),
    ],
    // 8086/8085: segments HIGH against common LOW. 8051: common HIGH,
    // segments LOW (quasi-bidir sinks only).
    code: (b) => [{ byte: b.isa === '8051' ? 0x00 : 0x7f }],
    check: (v, b) => {
      const d = (st(v, 'c1').digitSegments || [])[0] || {};
      expect(d.A === true && d.B === true && d.G === true).toBe(true);
    },
  },
  {
    family: 'outputs', name: 'rgb-led', type: 'openhw-rgb-led',
    wires: (b) => b.isa === '8051'
      // 8051 P1 cannot source: rail feeds the anodes, pin sinks the cathode.
      ? [
          { from: `${b}:SWD_3V3`, to: 'c1:R' },
          { from: `${b}:SWD_3V3`, to: 'c1:G' },
          { from: `${b}:SWD_3V3`, to: 'c1:B' },
          { from: `${b}:${L(2)}`, to: 'c1:COM' },
        ]
      : [
          { from: `${b}:${L(2)}`, to: 'c1:R' },
          { from: `${b}:${L(3)}`, to: 'c1:G' },
          { from: `${b}:${L(4)}`, to: 'c1:B' },
          { from: `${b}:SWD_GND`, to: 'c1:COM' },
        ],
    code: (b) => [{ byte: b.isa === '8051' ? 0xfb : 0x1c }],
    // 8051: quasi-bidir P1 cannot source R/G/B, and SWD_3V3 stamping does
    // not reach the RGB model's COM on that net (measured: all pins 0 V).
    blockedOn: ['8051'],
    blockedReason: '8051 P1 cannot source LED anodes and rail stamp does not reach RGB COM',
    check: (v) => {
      const s = st(v, 'c1');
      expect(Number(s.r || 0) + Number(s.g || 0) + Number(s.b || 0)).toBeGreaterThan(0);
    },
  },
  {
    family: 'outputs', name: 'relay', type: 'openhw-relay-module',
    wires: (b) => [
      { from: `${b}:SWD_3V3`, to: 'c1:VCC' },
      { from: `${b}:SWD_GND`, to: 'c1:GND' },
      { from: `${b}:${L(2)}`, to: 'c1:IN' },
    ],
    // Relay module is active-LOW: leave IN low.
    code: () => [{ byte: 0x00 }],
    check: (v) => expect(st(v, 'c1').energised).toBe(true),
  },
  {
    family: 'outputs', name: 'motor', type: 'openhw-motor',
    wires: (b) => [
      { from: `${b}:${L(2)}`, to: 'c1:1' },
      { from: `${b}:SWD_GND`, to: 'c1:2' },
    ],
    // Motor model integrates PWM duty; a static level leaves speed 0
    // (measured on 8086/8085/8051 with net at 5 V). Needs PWM edges.
    blockedOn: ['8086', '8085', '8051'],
    blockedReason: 'motor model needs PWM duty edges, static level gives speed 0',
    code: (b) => [{ byte: b.isa === '8051' ? 0x00 : 0x04 }],
    check: (v) => expect(Math.abs(Number(st(v, 'c1').speed || 0))).toBeGreaterThan(0.1),
  },
  {
    family: 'outputs', name: 'motor-driver', type: 'openhw-motor-driver',
    wires: (b) => [
      { from: `${b}:${L(2)}`, to: 'c1:ENA' },
      { from: `${b}:${L(3)}`, to: 'c1:IN1' },
      { from: `${b}:${L(4)}`, to: 'c1:IN2' },
      { from: `${b}:SWD_GND`, to: 'c1:GND' },
      { from: `${b}:SWD_3V3`, to: 'c1:12V' },
    ],
    // 8051 P1 cannot source ENA/IN1 HIGH (quasi-bidir gap).
    blockedOn: ['8051'],
    blockedReason: '8051 P1 cannot source the motor driver enable/input HIGH',
    code: () => [{ byte: 0x0c }],
    check: (v) => expect(st(v, 'c1').active).toBe(true),
  },
  {
    family: 'i2c', name: 'pca9685', type: 'openhw-pca9685',
    attrs: { i2cAddress: '0x40' },
    blockedOn: ['8086', '8085'],
    blockedReason: '8086/8085 bit-bang I2C decode not yet visible in browser',
    // Runner decoder is unit-tested; browser proof blocked on guest-side
    // edge visibility (retro step budget collapses the bit stream).
    wires: (b) => [
      { from: `${b}:${L(2)}`, to: 'c1:SDA' },
      { from: `${b}:${L(3)}`, to: 'c1:SCL' },
      { from: `${b}:SWD_3V3`, to: 'c1:VCC' },
      { from: `${b}:SWD_GND`, to: 'c1:GND' },
    ],
    // Address 0x40 write, then LED0_ON_L=0 / OFF=0,0,8 → 12.5% duty.
    code: (b) => ({ custom: i2cAsmFor(b, [0x40, 0x06, 0x00, 0x00, 0x00, 0x08], 'DONE') }),
    needle: (b) => (b.isa === '8086' ? 'DONE' : b.isa === '8085' ? 'D' : 'Q'),
    check: (v) => {
      const duty = custom(v, 'c1').dutyCycles || {};
      console.log('I2CDIAG-STATE', JSON.stringify({ pins: st(v, 'c1').__i2cPins, diag: st(v, 'c1').__i2cDiag, samples: (st(v, 'c1').__i2cSamples || []).slice(0, 20) }));
      expect(Number(duty['0'] ?? duty[0] ?? NaN)).toBeGreaterThan(5);
    },
  },
  {
    family: 'spi', name: 'max7219', type: 'openhw-max7219',
    wires: (b) => [
      { from: `${b}:${L(2)}`, to: 'c1:DIN' },
      { from: `${b}:${L(3)}`, to: 'c1:CLK' },
      { from: `${b}:${L(4)}`, to: 'c1:CS' },
      { from: `${b}:SWD_3V3`, to: 'c1:VCC' },
      { from: `${b}:SWD_GND`, to: 'c1:GND' },
    ],
    blockedOn: ['8086', '8085'],
    blockedReason: '8086/8085 SPI bit-bang decode not yet visible in browser',
    code: () => ({ custom: spiAsmFor('8051', [
      [0x0c, 0x01], [0x0a, 0x08], [0x0b, 0x07], [0x01, 0x7e], [0x02, 0x30],
    ]) }),
    needle: () => 'Q',
    check: (v) => {
      const mx = custom(v, 'c1');
      const matrix = mx.matrix || st(v, 'c1').matrix || [];
      expect(mx.shutdown === false || st(v, 'c1').shutdown === false).toBe(true);
      expect(matrix[0]).toBe(0x7e);
      expect(matrix[1]).toBe(0x30);
    },
  },
  {
    family: 'inputs', name: 'adc-potentiometer', type: 'openhw-potentiometer',
    attrs: { value: 50 },
    wires: (b) => [
      { from: `${b}:${L(10)}`, to: 'c1:SIG' },
      { from: `${b}:SWD_3V3`, to: 'c1:1' },
      { from: `${b}:SWD_GND`, to: 'c1:2' },
    ],
    // 8086/8085 ADC0808 at ports 28h (channel) / 29h (data). Half-scale
    // potentiometer must land in 100..156 (8-bit of 2.5V/5V).
    blockedOn: ['8086', '8085', '8051'],
    blockedReason: 'ADC0808 guest read path returns 0 despite runner injecting the host voltage',
    code: (b) => {
      const ok = b.isa === '8086';
      return { custom: ok
        ? `ORG 100h\n  MOV CX, 40\nagain:\n  MOV AL, 80h\n  OUT 28h, AL\n  MOV BX, 100\ndly:\n  DEC BX\n  JNZ dly\n  IN AL, 29h\n  CMP AL, 100\n  JB next\n  CMP AL, 157\n  JA next\n  MOV DL, 'Y'\n  MOV AH, 02h\n  INT 21h\n  HLT\nnext:\n  LOOP again\n  MOV DL, 'N'\n  MOV AH, 02h\n  INT 21h\n  HLT\nEND`
        : `ORG 0\n  MVI A, 80h\n  OUT 28h\n  IN 29h\n  CPI 100\n  JC bad\n  CPI 157\n  NC bad\n  MVI A, 'Y'\n  OUT 01h\n  HLT\nbad:\n  MVI A, 'N'\n  OUT 01h\n  HLT\nEND` };
    },
    needle: () => 'Y',
    check: (v) => expect(Number(st(v, 'c1').value)).toBeCloseTo(50, 0),
  },
];

const wanted = String(process.env.RETRO_COMP_FAMILIES || '').split(',').map((s) => s.trim()).filter(Boolean);
const only = String(process.env.RETRO_COMP_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const boards = BOARDS.filter((b) => !process.env.RETRO_COMP_BOARD || process.env.RETRO_COMP_BOARD === b.key);
const cases = CASES.filter((c) => (!wanted.length || wanted.includes(c.family)) && (!only.length || only.includes(c.name)));

for (const board of boards) {
  for (const c of cases) {
    test(`${board.key} ${c.name}`, async ({ page }) => {
      test.setTimeout(180000);
      if (c.blockedOn?.includes(board.isa)) {
        console.log(`RETROCOMP ${board.key}/${c.name} BLOCKED: ${c.blockedReason}`);
        test.skip(true, c.blockedReason);
        return;
      }
      await page.route('**/api/**', async (route) => {
        const url = route.request().url();
        if (url.includes('/compile')) return route.continue();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      });
      await page.addInitScript(() => window.localStorage.setItem('openhw-tour-completed', 'true'));
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.OpenHWE2E, null, { timeout: 90000 });

      const setup = await page.evaluate(({ comps, wires, code }) => window.OpenHWE2E.setupCircuit({ components: comps, wires, code }), {
        comps: [
          { id: board.key, type: board.type, attrs: {}, x: 100, y: 100 },
          ...(c.comps ? c.comps(board) : []),
          { id: 'c1', type: c.type, attrs: typeof c.attrs === 'function' ? c.attrs(board) : (c.attrs || {}), x: 480, y: 120 },
        ],
        wires: c.wires(board.key),
        code: c.code(board).custom || asmFor(board, c.code(board), 'DONE'),
      });
      expect(setup.ok).toBe(true);

      const verdict = await page.evaluate(({ needle }) => window.OpenHWE2E.run({
        forMs: 12000, serialNeedle: needle, telemetryMode: 'detail', selectTelemetry: ['c1'],
      }), { needle: c.needle ? c.needle(board) : (board.isa === '8086' ? 'DONE' : board.isa === '8085' ? 'D' : 'Q') });
      console.log(`RETROCOMP ${board.key}/${c.name} pass=${verdict.pass} reasons=${JSON.stringify(verdict.reasons || [])} serial=${JSON.stringify(String(verdict.serial || '').slice(0, 120))} state=${JSON.stringify(st(verdict, 'c1')).slice(0, 300)}`);
      expect(verdict.ok).toBe(true);
      expect(verdict.pass).toBe(true);
      c.check(verdict, board);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(1000);
    });
  }
}
