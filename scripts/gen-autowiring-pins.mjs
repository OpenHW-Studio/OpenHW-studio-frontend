#!/usr/bin/env node
// gen-autowiring-pins.mjs — regenerate the Rust board×protocol pin tables
// used by the OpenHW autowiring engine (wasm) from the emulator manifests.
//
// WHY: `openhw-studio-autowiring/src/pins.rs` used to be a hand-written
// duplicate of the board shells that live in the emulator manifests. Every
// new board variant (pico-w, pico-2-eth, gd32, nucleo, f407ve, …) and every
// shell change had to be copied by hand into Rust — the exact drift class
// that produced "assigned a pin the board does not have".
//
// This generator makes the manifests the single source of truth:
//
//   1. every board manifest contributes its exact shell pin list
//      (ids, types, reserved markers such as LED/RESET/RUN/EN/SWD),
//   2. the protocol roles a manifest *declares* in its pin descriptions
//      ("GPIO / USART2 TX", "GPIO (SPI SCK)", "Console TX (drain)", …)
//      become role → pin assignments,
//   3. the curated per-family defaults (the parts a manifest cannot
//      express: USBART instance preference, PWM/DAC/1-Wire, bus triples)
//      live in scripts/autowiring-pin-overrides.json and are MERGED in,
//      then FILTERED against the board's real shell — so a curated pin
//      that the board does not have can never reach the engine.
//
// Usage:
//   node scripts/gen-autowiring-pins.mjs            # write the Rust table
//   node scripts/gen-autowiring-pins.mjs --check    # CI gate: fail if stale
//   node scripts/gen-autowiring-pins.mjs --crate <path>
//   node scripts/gen-autowiring-pins.mjs --report   # coverage report only
//
// The default crate path is ../openhw-studio-autowiring (sibling of this
// repo), matching scripts/gen-component-pins.mjs which reads the same
// manifests.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(__dirname, '..');
const EMU_COMPONENTS = path.resolve(FRONTEND, '../openhw-studio-emulator/src/components');
const DEFAULT_CRATE = path.resolve(FRONTEND, '../openhw-studio-autowiring');
const OVERRIDES = path.join(__dirname, 'autowiring-pin-overrides.json');

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const REPORT_ONLY = argv.includes('--report');
const crateArg = argv.indexOf('--crate');
const CRATE = crateArg >= 0 && argv[crateArg + 1] ? path.resolve(argv[crateArg + 1]) : DEFAULT_CRATE;
const OUT_REL = path.join('src', 'pins_generated.rs');

// ─────────────────────────────────────────────────────────────────────────────
// Pin flags (mirrored 1:1 in the Rust file)
// ─────────────────────────────────────────────────────────────────────────────
const FLAG = {
  DIGITAL: 1 << 0,
  ANALOG: 1 << 1,
  POWER: 1 << 2,
  RESERVED: 1 << 3,
  LED: 1 << 5,
  RESET: 1 << 6,
  USB: 1 << 7,
  SWD: 1 << 8,
  BUTTON: 1 << 9,
  BOOT: 1 << 10,
  OSC: 1 << 11,
  ALIAS: 1 << 12,
};

// ─────────────────────────────────────────────────────────────────────────────
// Board kind → family
// ─────────────────────────────────────────────────────────────────────────────
// Every board manifest MUST land in a family; `--check` fails otherwise.
// The family only selects the curated defaults — the shell itself always
// comes from the manifest.
const FAMILY_RULES = [
  [/esp32.*cam|cam.*esp32/i, 'esp32cam'],
  [/esp32/i, 'esp32'],
  [/attiny|tiny85/i, 'attiny85'],
  [/arduino-nano|\bnano\b/i, 'nano'],
  [/arduino-mega|\bmega\b/i, 'mega'],
  [/arduino-uno|\buno\b/i, 'uno'],
  [/pico|rp2040|rp2350/i, 'pico'],
  [/microbit|micro:bit|nrf52/i, 'microbit'],
  // F1 family (bluepill / maple / gd32 / nucleo / f103x) BEFORE F4.
  [/stm32.*f1|f103|gd32|maple|nucleo|bluepill/i, 'stm32f1'],
  // Plain "stm32f4" is the Discovery shell (Arduino Serial = USART2);
  // explicit chips (f401/f411/f407/f429) default to USART1.
  [/stm32f4$/i, 'stm32f4disco'],
  [/stm32f4|f401|f411|f407|f429|407vg/i, 'stm32f4'],
  [/8086|8088|8085|8051|mcs51|6502|z80|rv32|risc|retro/i, 'retro'],
];

function familyOfKind(kind) {
  for (const [re, fam] of FAMILY_RULES) {
    if (re.test(kind)) return fam;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manifest loading
// ─────────────────────────────────────────────────────────────────────────────
function loadManifests() {
  const boards = [];
  const others = [];
  for (const dir of fs.readdirSync(EMU_COMPONENTS).sort()) {
    const mp = path.join(EMU_COMPONENTS, dir, 'manifest.json');
    if (!fs.existsSync(mp)) continue;
    let m;
    try {
      m = JSON.parse(fs.readFileSync(mp, 'utf8'));
    } catch {
      continue;
    }
    if (!m.type) continue;
    const isBoard = m.board === true || /board/i.test(m.group || '');
    const rec = { dir, manifest: m };
    if (isBoard) boards.push(rec);
    else others.push(rec);
  }
  return { boards, others };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pin classification
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_TOKENS = [
  // [regex over the pin description, proto, role]
  [/USART\d*\s+TX|UART\d*\s+TX|\bTX\d*\b/, 'uart', 'tx'],
  [/USART\d*\s+RX|UART\d*\s+RX|\bRX\d*\b/, 'uart', 'rx'],
  [/I2C\d*\s+SDA|\bSDA\b/, 'i2c', 'sda'],
  [/I2C\d*\s+SCL|\bSCL\b/, 'i2c', 'scl'],
  [/SPI\d*\s+SCK|\bSCK\b|\bSCLK\b/, 'spi', 'sck'],
  [/SPI\d*\s+MOSI|\bMOSI\b/, 'spi', 'mosi'],
  [/SPI\d*\s+MISO|\bMISO\b/, 'spi', 'miso'],
  [/SPI\d*\s+NSS|\bNSS\b/, 'spi', 'cs'],
  [/USB\s*DP|\bD\+\b/, 'usb', 'dp'],
  [/USB\s*DM|\bD-\b/, 'usb', 'dm'],
  [/I2S.*\bBCK|\bBCLK\b/, 'i2s', 'bclk'],
  [/I2S.*\bWS\b|\bLRCLK\b/, 'i2s', 'ws'],
  [/I2S.*\bSD\b|\bDIN\b/, 'i2s', 'din'],
  [/I2S.*\bDATA\b|\bDOUT\b/, 'i2s', 'dout'],
  [/CAN.*\bTX\b/, 'can', 'cantx'],
  [/CAN.*\bRX\b/, 'can', 'canrx'],
  [/\bDAC\b/, 'dac', 'dac'],
  [/Analog\s*In|\bADC\b/i, 'adc', 'adc'],
];

function rolesForDescription(desc) {
  const out = [];
  if (!desc) return out;
  const d = String(desc);
  for (const [re, proto, role] of ROLE_TOKENS) {
    if (re.test(d)) out.push([proto, role]);
  }
  return out;
}

function flagsForPin(id, desc, type) {
  const d = String(desc || '');
  const i = String(id || '');
  const di = d.toLowerCase();
  const ii = i.toLowerCase();
  let f = 0;
  if (type === 'power') f |= FLAG.POWER;
  else if (type === 'analog') f |= FLAG.ANALOG;
  else f |= FLAG.DIGITAL;

  if (/\bled\b/.test(di) || /\bonboard led|built-in led/.test(di)) f |= FLAG.LED | FLAG.RESERVED;
  if (/reset/.test(di) || /^rst([._]|$)/.test(ii) || ii === 'rst') f |= FLAG.RESET | FLAG.RESERVED;
  if (/^swd|swd_|_swd/.test(ii) || /\bswd\b/.test(di)) f |= FLAG.SWD | FLAG.RESERVED;
  if (/\bbutton\b/.test(di)) f |= FLAG.BUTTON | FLAG.RESERVED;
  if (ii === 'en' || ii === 'run' || ii === '3v3_en' || /\bboot0?\b/.test(di)) f |= FLAG.BOOT | FLAG.RESERVED;
  if (/\busb\b/.test(di)) f |= FLAG.USB | FLAG.RESERVED;
  if (/\bosc|\bxtal|oscillator/.test(di)) f |= FLAG.OSC | FLAG.RESERVED;
  // "Alias for GP18 (SPI SCK)" — an alias pin names a REAL pin, it is not
  // one: it must never be auto-assigned.
  if (ALIAS_RE.test(String(desc || ''))) f |= FLAG.ALIAS;
  return f;
}

// "Alias for GP18 (SPI SCK)" → alias id "SCK" → canonical "GP18"
const ALIAS_RE = /^alias for\s+([A-Za-z0-9_]+)\s*(.*)$/i;

function parseAliases(pins) {
  const out = [];
  for (const p of pins) {
    const m = ALIAS_RE.exec(String(p.description || ''));
    if (m) out.push([String(p.id), m[1]]);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell building
// ─────────────────────────────────────────────────────────────────────────────
function buildShell(board) {
  const m = board.manifest;
  const pins = (m.pins || []).map((p) => (typeof p === 'string' ? { id: p } : p));
  const shellPins = pins.map((p) => ({
    id: String(p.id),
    desc: p.description == null ? '' : String(p.description),
    type: p.type == null ? '' : String(p.type),
    flags: flagsForPin(p.id, p.description, p.type),
    roles: rolesForDescription(p.description),
  }));
  return {
    kind: m.type,
    family: familyOfKind(m.type),
    label: m.label || m.type,
    pins: shellPins,
    aliases: parseAliases(pins),
  };
}

function shellSignature(shell) {
  // The family is part of the key: two board kinds can share the exact same
  // pin set yet differ in the peripheral instance their Arduino `Serial`
  // maps to (e.g. the STM32F4 Discovery runs Serial on USART2 while an
  // explicit F407 chip runs it on USART1). The curated family table is what
  // expresses that, so the profile must stay per-family.
  return `${shell.family}#${JSON.stringify(shell.pins.map((p) => [p.id, p.flags, p.roles]))}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overrides (curated per-family defaults)
// ─────────────────────────────────────────────────────────────────────────────
function loadOverrides() {
  if (!fs.existsSync(OVERRIDES)) {
    throw new Error(`missing overrides file: ${OVERRIDES}`);
  }
  const raw = JSON.parse(fs.readFileSync(OVERRIDES, 'utf8'));
  const families = {};
  // Resolve `inherit` chains (a family may inherit missing entries).
  const resolve = (name, seen = new Set()) => {
    if (families[name]) return families[name];
    if (seen.has(name)) throw new Error(`inherit cycle at family ${name}`);
    seen.add(name);
    const rawFam = raw.families[name];
    if (!rawFam) throw new Error(`unknown family in overrides: ${name}`);
    const parent = rawFam.inherit ? resolve(rawFam.inherit, seen) : { roles: {}, buses: {} };
    const roles = { ...parent.roles };
    for (const [proto, rr] of Object.entries(rawFam.roles || {})) {
      roles[proto] = { ...(roles[proto] || {}), ...rr };
    }
    const buses = { ...parent.buses };
    for (const [bus, list] of Object.entries(rawFam.buses || {})) {
      buses[bus] = list;
    }
    families[name] = { roles, buses };
    return families[name];
  };
  for (const name of Object.keys(raw.families)) resolve(name);
  return { families, raw };
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge + filter
// ─────────────────────────────────────────────────────────────────────────────
// Roles that describe a *specific peripheral function* may legitimately land
// on a pin the manifest also marks as LED/RESERVED (e.g. the Uno's SPI SCK
// is D13, which is also the board LED). Generic signal roles (PWM, ADC,
// 1-Wire) must never auto-grab a reserved pin.
const GENERIC_ROLES = new Set(['pwm', 'adc', 'onewire', 'data']);

function shellPinIds(shell) {
  return new Set(shell.pins.map((p) => p.id));
}

function isReserved(shell, id) {
  const p = shell.pins.find((x) => x.id === id);
  return !!(p && (p.flags & FLAG.RESERVED));
}

function filterList(shell, ids, role) {
  const have = shellPinIds(shell);
  const out = [];
  for (const id of ids) {
    if (!have.has(id)) continue; // the board does not have this pin
    if (GENERIC_ROLES.has(role) && isReserved(shell, id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function buildShellRoles(shell, overrides) {
  const fam = overrides.families[shell.family];
  const roles = [];
  const seen = new Set();

  const addRole = (proto, role, list) => {
    const filtered = filterList(shell, list, role);
    if (!filtered.length) return;
    const key = `${proto}:${role}`;
    if (seen.has(key)) return;
    seen.add(key);
    roles.push([proto, role, filtered]);
  };

  // 1. curated family defaults (already ordered by priority)
  if (fam) {
    for (const [proto, rr] of Object.entries(fam.roles)) {
      for (const [role, list] of Object.entries(rr)) {
        if (Array.isArray(list)) addRole(proto, role, list);
      }
    }
  }

  // 2. roles the manifest itself declares (appended after the curated
  //    defaults so curated priority ordering wins).
  const manifestRoles = new Map();
  for (const p of shell.pins) {
    for (const [proto, role] of p.roles) {
      const key = `${proto}:${role}`;
      if (!manifestRoles.has(key)) manifestRoles.set(key, []);
      manifestRoles.get(key).push(p.id);
    }
  }
  for (const [key, ids] of manifestRoles) {
    const [proto, role] = key.split(':');
    const existing = roles.find((r) => r[0] === proto && r[1] === role);
    const extra = ids.filter((id) => !existing || !existing[2].includes(id));
    if (!extra.length) continue;
    const merged = existing ? [...existing[2], ...extra] : extra;
    if (existing) existing[2] = merged;
    else {
      roles.push([proto, role, merged]);
      seen.add(key);
    }
  }
  return roles;
}

function buildShellBuses(shell, overrides) {
  const fam = overrides.families[shell.family];
  const buses = [];
  if (!fam) return buses;
  const have = shellPinIds(shell);
  for (const [bus, list] of Object.entries(fam.buses)) {
    const triples = [];
    for (const t of list) {
      const [a, b, c, idx] = t;
      if (!have.has(a) || !have.has(b)) continue;
      if (c && !have.has(c)) continue;
      triples.push([a, b, c || '', idx | 0]);
    }
    if (triples.length) buses.push([bus, triples]);
  }
  return buses;
}

// ─────────────────────────────────────────────────────────────────────────────
// Power rails (manifest-declared)
// ─────────────────────────────────────────────────────────────────────────────
// A board can expose several ground / 5V pins. The engine must be able to
// pick the first one the RUNTIME shell actually has, so the generator emits
// every candidate, most-preferred first.
const RAIL_TESTS = {
  gnd: [/^GND$/, /^GND[._]/, /^gnd$/, /^gnd[._]/, /^SWD_GND$/i],
  v5: [/^VBUS$/, /^5V$/, /^5V[._]/, /^VCC$/, /^VIN$/],
  v33: [/^3V3$/, /^3V3[._]/, /^3\.3V$/, /^3v3$/, /^SWD_3V3$/i],
};

function railCandidates(shell, rail) {
  const tests = RAIL_TESTS[rail];
  const hits = [];
  shell.pins.forEach((p, idx) => {
    const rank = tests.findIndex((re) => re.test(p.id));
    if (rank >= 0) hits.push({ id: p.id, rank, idx });
  });
  hits.sort((a, b) => (a.rank - b.rank) || (a.idx - b.idx));
  return hits.map((h) => h.id);
}

function buildRails(shell) {
  return {
    gnd: railCandidates(shell, 'gnd'),
    v5: railCandidates(shell, 'v5'),
    v33: railCandidates(shell, 'v33'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rust emission
// ─────────────────────────────────────────────────────────────────────────────
const PROTO_VARIANTS = {
  uart: 'Proto::Uart', i2c: 'Proto::I2c', spi: 'Proto::Spi', pwm: 'Proto::Pwm',
  adc: 'Proto::Adc', dac: 'Proto::Dac', can: 'Proto::Can', i2s: 'Proto::I2s',
  onewire: 'Proto::OneWire', usb: 'Proto::Usb', sdio: 'Proto::Sdio',
  qspi: 'Proto::Qspi', fsmc: 'Proto::Fsmc',
};
const ROLE_VARIANTS = {
  tx: 'Role::Tx', rx: 'Role::Rx', sda: 'Role::Sda', scl: 'Role::Scl',
  mosi: 'Role::Mosi', miso: 'Role::Miso', sck: 'Role::Sck', cs: 'Role::Cs',
  pwm: 'Role::Pwm', adc: 'Role::Adc', dac: 'Role::Dac', cantx: 'Role::CanTx',
  canrx: 'Role::CanRx', bclk: 'Role::Bclk', ws: 'Role::Ws', din: 'Role::Din',
  dout: 'Role::Dout', data: 'Role::Data', dp: 'Role::Dp', dm: 'Role::Dm',
};

function rustStr(s) {
  return JSON.stringify(String(s));
}

function emitRust(ctx) {
  const { shells, boards, overrides, meta } = ctx;
  const L = [];
  L.push('//! GENERATED FILE — DO NOT EDIT BY HAND.');
  L.push('//!');
  L.push('//! Source of truth: openhw-studio-emulator/src/components/*/manifest.json');
  L.push('//! Generator:    OpenHW-studio-frontend/scripts/gen-autowiring-pins.mjs');
  L.push('//! Curated part: OpenHW-studio-frontend/scripts/autowiring-pin-overrides.json');
  L.push('//!');
  L.push('//! Regenerate:  node scripts/gen-autowiring-pins.mjs');
  L.push('//! Verify:      node scripts/gen-autowiring-pins.mjs --check');
  L.push('//!');
  L.push(`//! ${meta.boardCount} board manifests → ${shells.length} distinct shells.`);
  L.push('');
  L.push('use crate::pins::{BusTriple, Proto, Role};');
  L.push('');
  L.push('/// Pin classification flags (bitmask).');
  L.push('pub const PIN_DIGITAL: u16   = 1 << 0;');
  L.push('pub const PIN_ANALOG: u16    = 1 << 1;');
  L.push('pub const PIN_POWER: u16     = 1 << 2;');
  L.push('pub const PIN_RESERVED: u16  = 1 << 3;');
  L.push('pub const PIN_LED: u16       = 1 << 5;');
  L.push('pub const PIN_RESET: u16     = 1 << 6;');
  L.push('pub const PIN_USB: u16       = 1 << 7;');
  L.push('pub const PIN_SWD: u16       = 1 << 8;');
  L.push('pub const PIN_BUTTON: u16    = 1 << 9;');
  L.push('pub const PIN_BOOT: u16      = 1 << 10;');
  L.push('pub const PIN_OSC: u16       = 1 << 11;');
  L.push('pub const PIN_ALIAS: u16     = 1 << 12;');
  L.push('');
  L.push('/// One physical pin as declared by a board manifest.');
  L.push('pub struct ShellPin {');
  L.push('    pub id:    &\'static str,');
  L.push('    pub flags: u16,');
  L.push('    pub roles: &\'static [Role],');
  L.push('}');
  L.push('');
  L.push('/// One distinct board shell (a manifest pin set), with the merged');
  L.push('/// protocol tables filtered against that shell.');
  L.push('pub struct BoardShell {');
  L.push('    pub pins:    &\'static [ShellPin],');
  L.push('    /// manifest alias id → canonical pin id (e.g. "SCK" → "GP18")');
  L.push('    pub aliases: &\'static [(&\'static str, &\'static str)],');
  L.push('    /// (proto, role, pins) — priority ordered, default first');
  L.push('    pub roles:   &\'static [(&\'static str, Proto, Role, &\'static [&\'static str])],');
  L.push('    /// (bus, triples) — (tx/scl/sck, rx/sda/mosi, miso, peripheral index)');
  L.push('    pub buses:   &\'static [(&\'static str, &\'static [BusTriple])],');
  L.push('    /// manifest-declared power rails: (grounds, 5V pins, 3V3 pins),');
  L.push('    /// most preferred first');
  L.push('    pub rails:   (&\'static [&\'static str], &\'static [&\'static str], &\'static [&\'static str]),');
  L.push('}');
  L.push('');
  L.push('/// board kind → (family, shell index)');
  L.push('pub static BOARDS: &[(&str, &str, u16)] = &[');
  for (const b of boards) {
    L.push(`    (${rustStr(b.kind)}, ${rustStr(b.family)}, ${b.shellIndex}),`);
  }
  L.push('];');
  L.push('');
  L.push('/// Distinct board shells.');
  L.push('pub static SHELLS: &[BoardShell] = &[');
  shells.forEach((sh) => {
    L.push('    BoardShell {');
    L.push('        pins: &[');
    for (const p of sh.pins) {
      const roleList = p.roles.length ? `roles: &[${p.roles.map(([, role]) => ROLE_VARIANTS[role]).join(', ')}]` : 'roles: &[]';
      L.push(`            ShellPin { id: ${rustStr(p.id)}, flags: ${p.flags}, ${roleList} },`);
    }
    L.push('        ],');
    L.push('        aliases: &[');
    for (const [alias, target] of sh.aliases) {
      L.push(`            (${rustStr(alias)}, ${rustStr(target)}),`);
    }
    L.push('        ],');
    L.push('        roles: &[');
    for (const [proto, role, list] of sh.roles) {
      const pins = list.map((p) => rustStr(p)).join(', ');
      L.push(`            (${rustStr(proto)}, ${PROTO_VARIANTS[proto]}, ${ROLE_VARIANTS[role]}, &[${pins}]),`);
    }
    L.push('        ],');
    L.push('        buses: &[');
    for (const [bus, triples] of sh.buses) {
      const items = triples
        .map((t) => `BusTriple { a: ${rustStr(t[0])}, b: ${rustStr(t[1])}, c: ${rustStr(t[2])}, idx: ${t[3]} }`)
        .join(', ');
      L.push(`            (${rustStr(bus)}, &[${items}]),`);
    }
    L.push('        ],');
    L.push(`        rails: (&[${sh.rails.gnd.map(rustStr).join(', ')}], &[${sh.rails.v5.map(rustStr).join(', ')}], &[${sh.rails.v33.map(rustStr).join(', ')}]),`);
    L.push('    },');
  });
  L.push('];');
  L.push('');
  L.push('/// Curated per-family defaults (the part a manifest cannot express:');
  L.push('/// peripheral-instance preference, PWM/DAC/1-Wire, bus triples).');
  L.push('/// Used for board kinds WITHOUT a manifest (e.g. "wokwi-*").');
  L.push('pub static FAMILY_ROLE_PINS: &[(&str, Proto, Role, &[&str])] = &[');
  for (const [fam, data] of Object.entries(overrides.families)) {
    for (const [proto, rr] of Object.entries(data.roles)) {
      for (const [role, list] of Object.entries(rr)) {
        if (!Array.isArray(list)) continue;
        const pins = list.map((p) => rustStr(p)).join(', ');
        L.push(`    (${rustStr(fam)}, ${PROTO_VARIANTS[proto]}, ${ROLE_VARIANTS[role]}, &[${pins}]),`);
      }
    }
  }
  L.push('];');
  L.push('');
  L.push('/// Curated per-family bus instances (fallback for kinds without a manifest).');
  L.push('pub static FAMILY_BUSES: &[(&str, &str, &[BusTriple])] = &[');
  for (const [fam, data] of Object.entries(overrides.families)) {
    for (const [bus, list] of Object.entries(data.buses)) {
      const items = list
        .map((t) => `BusTriple { a: ${rustStr(t[0])}, b: ${rustStr(t[1])}, c: ${rustStr(t[2] || '')}, idx: ${t[3] | 0} }`)
        .join(', ');
      L.push(`    (${rustStr(fam)}, ${rustStr(bus)}, &[${items}]),`);
    }
  }
  L.push('];');
  L.push('');
  return L.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
function main() {
  const { boards: boardRecs, others } = loadManifests();
  const overrides = loadOverrides();

  const built = boardRecs.map(buildShell);
  const missingFamily = built.filter((b) => !b.family);
  if (missingFamily.length) {
    console.error('ERROR: board manifests without a family rule:');
    for (const b of missingFamily) console.error(`  - ${b.kind}`);
    process.exit(1);
  }

  // Deduplicate shells by pin signature.
  const shells = [];
  const sigToIndex = new Map();
  const boards = [];
  for (const b of built) {
    const sig = shellSignature(b);
    let idx = sigToIndex.get(sig);
    if (idx === undefined) {
      idx = shells.length;
      sigToIndex.set(sig, idx);
      shells.push({
        ...b,
        roles: buildShellRoles(b, overrides),
        buses: buildShellBuses(b, overrides),
        rails: buildRails(b),
      });
    }
    boards.push({ kind: b.kind, family: b.family, shellIndex: idx });
  }

  const meta = { boardCount: built.length };
  const rust = emitRust({ shells, boards, overrides, meta });

  if (REPORT_ONLY) {
    printReport(built, shells, boards, overrides);
    return;
  }

  const outPath = path.join(CRATE, OUT_REL);
  if (CHECK) {
    if (!fs.existsSync(outPath)) {
      console.error(`autowiring pin table is missing: ${outPath}`);
      console.error('Regenerate: node scripts/gen-autowiring-pins.mjs');
      process.exit(1);
    }
    const current = fs.readFileSync(outPath, 'utf8');
    if (current !== rust) {
      console.error('autowiring pin table is STALE (src/pins_generated.rs).');
      console.error('Regenerate: node scripts/gen-autowiring-pins.mjs');
      console.error(`  crate: ${CRATE}`);
      process.exit(1);
    }
    console.log(`autowiring pin table fresh (${built.length} boards, ${shells.length} shells).`);
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, rust);
  console.log(`Wrote ${outPath} (${built.length} boards, ${shells.length} shells).`);
}

function printReport(built, shells, boards, overrides) {
  console.log(`Board manifests: ${built.length}`);
  console.log(`Shell profiles: ${shells.length}`);
  console.log('');
  const byFamily = new Map();
  for (const b of boards) {
    if (!byFamily.has(b.family)) byFamily.set(b.family, []);
    byFamily.get(b.family).push(b.kind);
  }
  for (const [fam, kinds] of [...byFamily.entries()].sort()) {
    const shell = shells[kinds.length ? boards.find((b) => b.kind === kinds[0]).shellIndex : 0];
    const roleCount = shell ? shell.roles.length : 0;
    const busCount = shell ? shell.buses.length : 0;
    console.log(`  ${fam.padEnd(14)} ${String(kinds.length).padStart(2)} board(s), ${roleCount} role table(s), ${busCount} bus table(s)`);
    for (const k of kinds) console.log(`      ${k}`);
  }
}

main();
