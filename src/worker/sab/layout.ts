/**
 * SAB layout v1 — single source of truth (§12.2/§12.3 T5).
 *
 * One global SharedArrayBuffer per run, transferred once at START.
 * Worker = sole writer of sim state. Main/render/WASM = readers (poll, never block).
 * NEVER Atomics.wait on main. crossOriginIsolated === false → postMessage fallback.
 *
 * Memory map (all offsets in bytes, LE):
 *   HEADER 64 B:
 *     0  u32 magic (0x4F485753 'OHWS')
 *     4  u32 version (SAB_LAYOUT_VERSION)
 *     8  u32 frameSeq (worker bumps per flush via Atomics.store)
 *     12 u32 numComponents
 *     16 f64 simTimeMs
 *     24 u32 telemetryHead (ring write index, monotonic)
 *     28 u32 flags (bit0 running, bit1 telemetryOn, bit2 fault)
 *     32 u32 pinRegionOffset
 *     36 u32 pinRegionLen
 *     40 u32 compRegionOffset
 *     44 u32 compRegionLen
 *     48 u32 telemetryRegionOffset
 *     52 u32 telemetryRegionLen
 *     56 u32 reserved
 *     60 u32 reserved
 *   PIN REGION: digital bitfield (u32 words, board pin order fixed at START)
 *     followed by analog f32 array (same order).
 *     pinCount + wordsPerBoard live in the START handshake (not in SAB).
 *   COMPONENT SLOTS: stride SAB_SLOT_STRIDE_B (64 B) each, index = sabSlot:
 *     +0  u32 version (== BaseComponent.stateVersion at write time)
 *     +4  u32 dirty (1 = changed this frame; main clears after read)
 *     +8  u16 kind (SAB_KIND_* per manifest sab.slotKind)
 *     +10 u16 boardIdx
 *     +12 f32 f0..f7 (brightness/angle/voltageDrop/... per manifest sab.fields)
 *     +44 i32 i0..i3 (illuminated/pressed/enabled/mode/...)
 *     +60 u32 reserved
 *   TELEMETRY RING: SAB_TELEMETRY_CAPACITY × 32 B records:
 *     +0 u16 compSlot | +2 u16 code | +4 f32 v0 | +8 f32 v1
 *     +12 u32 cyclesLo | +16 u32 cyclesHi | +20 u32 wallMs
 *     +24 u32 reserved ×2
 *   Display VRAM stays in its own SABs (routeDisplayFrames) — NEVER packed here.
 */

export const SAB_LAYOUT_VERSION = 1;
export const SAB_MAGIC = 0x4f485753;

export const SAB_HEADER_BYTES = 64;
export const SAB_SLOT_STRIDE_B = 64;
export const SAB_SLOT_F32 = 8; // f0..f7
export const SAB_SLOT_I32 = 4; // i0..i3
export const SAB_TELEMETRY_RECORD_B = 32;
export const SAB_TELEMETRY_CAPACITY = 1024;

// Header u32 word indexes (Uint32Array view over bytes 0..63).
export const SAB_H_MAGIC = 0;
export const SAB_H_VERSION = 1;
export const SAB_H_FRAME_SEQ = 2;
export const SAB_H_NUM_COMPONENTS = 3;
// bytes 16..23 = f64 simTimeMs (Float64Array index 2)
export const SAB_H_TELEMETRY_HEAD = 6;
export const SAB_H_FLAGS = 7;
export const SAB_H_PIN_OFF = 8;
export const SAB_H_PIN_LEN = 9;
export const SAB_H_COMP_OFF = 10;
export const SAB_H_COMP_LEN = 11;
export const SAB_H_TELEMETRY_OFF = 12;
export const SAB_H_TELEMETRY_LEN = 13;

export const SAB_FLAG_RUNNING = 1 << 0;
export const SAB_FLAG_TELEMETRY_ON = 1 << 1;
export const SAB_FLAG_FAULT = 1 << 2;
export const SAB_FLAG_PAUSED = 1 << 3;

// Slot field offsets (bytes from slot base).
export const SAB_SLOT_VERSION_OFF = 0;
export const SAB_SLOT_DIRTY_OFF = 4;
export const SAB_SLOT_KIND_OFF = 8;
export const SAB_SLOT_BOARD_OFF = 10;
export const SAB_SLOT_F_OFF = 12;
export const SAB_SLOT_I_OFF = 44;

// Component slot kinds (manifest sab.slotKind → u16).
export const SAB_KIND_GENERIC = 0;
export const SAB_KIND_LED = 1;
export const SAB_KIND_SERVO = 2;
export const SAB_KIND_DISPLAY = 3;
export const SAB_KIND_SENSOR = 4;
export const SAB_KIND_BUTTON = 5;
export const SAB_KIND_MOTOR = 6;
export const SAB_KIND_BUZZER = 7;

export function sabKindForType(type: string): number {
    const t = String(type || '').toLowerCase();
    if (t.includes('led') || t.includes('neopixel')) return SAB_KIND_LED;
    if (t.includes('servo')) return SAB_KIND_SERVO;
    if (t.includes('ssd1306') || t.includes('ili9341') || t.includes('lcd') || t.includes('oled') || t.includes('display') || t.includes('max7219') || t.includes('tm1637') || t.includes('7segment')) return SAB_KIND_DISPLAY;
    if (t.includes('button') || t.includes('keypad') || t.includes('switch') || t.includes('joystick') || t.includes('encoder') || t.includes('potentiometer')) return SAB_KIND_BUTTON;
    if (t.includes('motor') || t.includes('stepper') || t.includes('relay') || t.includes('driver')) return SAB_KIND_MOTOR;
    if (t.includes('buzzer') || t.includes('speaker')) return SAB_KIND_BUZZER;
    if (t.includes('sensor') || t.includes('mpu') || t.includes('bmp') || t.includes('dht') || t.includes('ds18') || t.includes('ldr') || t.includes('pir') || t.includes('ultrasonic') || t.includes('hc-sr04') || t.includes('max30102') || t.includes('hx711')) return SAB_KIND_SENSOR;
    return SAB_KIND_GENERIC;
}

export interface SabAlloc {
    buffer: SharedArrayBuffer;
    offsets: Record<string, number>; // componentId → slot index
    numComponents: number;
    bufferSize: number;
    cmdBuffer: SharedArrayBuffer;
    evtBuffer: SharedArrayBuffer;
}

// --- Command ring (main→worker, MPSC, §10.4/§12.2) ---
// Fixed 32 B records: op u16 | target u16 | arg0 u32 | arg1 u32 |
// cyclesLo u32 | cyclesHi u32 | strLen u16 + strOff u16 (into str region).
// String payloads (serial bytes, interact event JSON) ride the trailing
// str region as UTF-8; numeric commands use arg0/arg1 only.
export const SAB_CMD_CAPACITY = 256;
export const SAB_CMD_RECORD_B = 32;
export const SAB_CMD_STR_B = 4096;
export const SAB_CMD_OP_INTERACT = 1;
export const SAB_CMD_OP_SERIAL = 2;
export const SAB_CMD_OP_RESET = 3;
export const SAB_CMD_OP_SET_SPEED = 4;
export const SAB_CMD_OP_SET_TELEMETRY = 5;
export const SAB_CMD_OP_HALT = 6;
export const SAB_CMD_OP_RESUME = 7;
export const SAB_CMD_OP_STEP = 8;
export const SAB_CMD_OP_WRITE_PIN = 9;
export const SAB_CMD_OP_READ_MEM = 10;
export const SAB_CMD_OP_WATCH_ADD = 11;

// --- Event ring (worker→main, SPSC, §10.4) ---
// Fixed 32 B records: code u16 | flags u16 | a0 u32 | a1 u32 |
// cyclesLo u32 | cyclesHi u32 | strLen u16 + strOff u16.
// Overflow (ring full or string too big) → full postMessage body instead;
// SAB events are hints, postMessage stays authoritative.
export const SAB_EVT_CAPACITY = 256;
export const SAB_EVT_RECORD_B = 32;
export const SAB_EVT_STR_B = 4096;
export const SAB_EVT_CODE_SERIAL_BYTE = 1;
export const SAB_EVT_CODE_TOAST = 2;
export const SAB_EVT_CODE_ERROR = 3;
export const SAB_EVT_CODE_BREAK_HIT = 4;
export const SAB_EVT_CODE_SYNC_FAULT = 5;
export const SAB_EVT_CODE_WATCH_HIT = 6;
export const SAB_EVT_CODE_RUN_EVENT = 7;

/** Allocate + zero-init the state SAB. Replaces ad-hoc 8 B math in workerStartPostamble. */
export function allocateStateSab(componentIds: string[], telemetryCapacity = SAB_TELEMETRY_CAPACITY): SabAlloc {
    const numComponents = componentIds.length;
    const pinRegionLen = 0; // pin bitfield mapped in phase 2 (T5); slots first
    const compRegionLen = numComponents * SAB_SLOT_STRIDE_B;
    const telemetryRegionLen = telemetryCapacity * SAB_TELEMETRY_RECORD_B;
    const total = SAB_HEADER_BYTES + pinRegionLen + compRegionLen + telemetryRegionLen;
    const bufferSize = Math.max(4096, Math.ceil(total / 4096) * 4096);
    const buffer = new SharedArrayBuffer(bufferSize);
    const u32 = new Uint32Array(buffer);
    const f64 = new Float64Array(buffer);
    u32[SAB_H_MAGIC] = SAB_MAGIC;
    u32[SAB_H_VERSION] = SAB_LAYOUT_VERSION;
    u32[SAB_H_FRAME_SEQ] = 0;
    u32[SAB_H_NUM_COMPONENTS] = numComponents;
    f64[2] = 0; // simTimeMs
    u32[SAB_H_TELEMETRY_HEAD] = 0;
    u32[SAB_H_FLAGS] = SAB_FLAG_RUNNING;
    const compOff = SAB_HEADER_BYTES + pinRegionLen;
    const teleOff = compOff + compRegionLen;
    u32[SAB_H_PIN_OFF] = SAB_HEADER_BYTES;
    u32[SAB_H_PIN_LEN] = pinRegionLen;
    u32[SAB_H_COMP_OFF] = compOff;
    u32[SAB_H_COMP_LEN] = compRegionLen;
    u32[SAB_H_TELEMETRY_OFF] = teleOff;
    u32[SAB_H_TELEMETRY_LEN] = telemetryRegionLen;
    const offsets: Record<string, number> = {};
    componentIds.forEach((id, i) => { offsets[id] = i; });
    const cmdBuffer = SabCommandWriter.create();
    const evtBuffer = SabEventWriter.create();
    return { buffer, offsets, numComponents, bufferSize, cmdBuffer, evtBuffer };
}

export function readSabHeader(buffer: SharedArrayBuffer | ArrayBuffer) {
    const u32 = new Uint32Array(buffer);
    const f64 = new Float64Array(buffer);
    return {
        magic: u32[SAB_H_MAGIC],
        version: u32[SAB_H_VERSION],
        frameSeq: Atomics.load(u32, SAB_H_FRAME_SEQ),
        numComponents: u32[SAB_H_NUM_COMPONENTS],
        simTimeMs: f64[2],
        telemetryHead: Atomics.load(u32, SAB_H_TELEMETRY_HEAD),
        flags: Atomics.load(u32, SAB_H_FLAGS),
        compOff: u32[SAB_H_COMP_OFF],
    };
}

export interface SabDecodedCommand {
  op: number;
  target: number;
  arg0: number;
  arg1: number;
  cycles: number;
  str: string;
  event?: string;
}

export interface SabDecodedEvent {
  code: number;
  flags: number;
  a0: number;
  a1: number;
  cycles: number;
  str: string;
}

function cmdRecBase(capacity: number): number { return 16; }
function cmdStrBase(capacity: number): number { return 16 + capacity * SAB_CMD_RECORD_B; }
function evtRecBase(capacity: number): number { return 16; }
function evtStrBase(capacity: number): number { return 16 + capacity * SAB_EVT_RECORD_B; }

function writeRingString(u8: Uint8Array, strBase: number, strCap: number, strHead: number, text: string): { off: number; len: number; head: number } {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length === 0) return { off: 0, len: 0, head: strHead };
  if (bytes.length > strCap) return { off: -1, len: -1, head: strHead };
  let off = strHead;
  if (off + bytes.length > strCap) off = 0; // wrap; lossy by design
  u8.set(bytes.subarray(0, Math.min(bytes.length, strCap - off)), strBase + off);
  return { off, len: Math.min(bytes.length, strCap - off), head: off + Math.min(bytes.length, strCap - off) };
}

function readRingString(u8: Uint8Array, strBase: number, off: number, len: number): string {
  if (!len || off < 0) return '';
  try {
    // SharedArrayBuffer views can't go through TextDecoder.decode directly
    // in some Chromium builds ("must not be shared") — copy the slice out
    // first. Slice is ≤ a few dozen bytes; cost is negligible.
    const live = new Uint8Array(u8.buffer, u8.byteOffset, u8.byteLength);
    const slice = live.slice(strBase + off, strBase + off + len);
    return new TextDecoder().decode(slice);
  } catch { return ''; }
}

/** Main→worker command writer (main thread). MPSC: single writer assumed. */
export class SabCommandWriter {
  private u32: Uint32Array;
  private u8: Uint8Array;
  constructor(readonly buffer: SharedArrayBuffer, readonly capacity = SAB_CMD_CAPACITY) {
    this.u32 = new Uint32Array(buffer);
    this.u8 = new Uint8Array(buffer);
  }
  static create(capacity = SAB_CMD_CAPACITY): SharedArrayBuffer {
    const size = 16 + capacity * SAB_CMD_RECORD_B + SAB_CMD_STR_B;
    const buf = new SharedArrayBuffer(size);
    new Uint32Array(buf).fill(0);
    return buf;
  }
  pending(): number {
    const head = Atomics.load(this.u32, 0);
    const tail = Atomics.load(this.u32, 1);
    return head - tail;
  }
  private push(op: number, target: number, arg0: number, arg1: number, cycles: number, str: string): boolean {
    const head = Atomics.load(this.u32, 0);
    const tail = Atomics.load(this.u32, 1);
    if (head - tail >= this.capacity) return false; // full → caller falls back to postMessage
    const idx = head % this.capacity;
    const base = cmdRecBase(this.capacity) + idx * SAB_CMD_RECORD_B;
    // NOTE: strHead lives in the u32 header at word 2 (byte 8). The old code
    // read it via the cached this.u32 view WITHOUT Atomics — under Vite dev
    // the view can go stale across module reloads. Use Atomics.load.
    const strHead = Atomics.load(this.u32, 2);
    const wr = writeRingString(this.u8, cmdStrBase(this.capacity), SAB_CMD_STR_B, strHead, str);
    if (wr.len === -1) return false;
    // NOTE: record stores strLen/strOff at bytes 24..27 then u32 cyclesHi
    // at 28..31. The old layout overlaid the u16 tail with cyclesHi; fixed
    // so strings survive (P4 regression: interact event came back empty).
    const u16 = new Uint16Array(this.buffer, base, 2);
    u16[0] = op; u16[1] = target;
    const u32r = new Uint32Array(this.buffer, base + 4, 4);
    u32r[0] = arg0 >>> 0; u32r[1] = arg1 >>> 0;
    u32r[2] = cycles >>> 0; u32r[3] = Math.floor(cycles / 4294967296) >>> 0;
    const dv = new DataView(this.buffer, base + 24, 8);
    dv.setUint16(0, 0, true); dv.setUint16(2, 0, true);
    dv.setUint16(4, wr.len, true); dv.setUint16(6, wr.off, true);
    Atomics.store(this.u32, 2, wr.head);
    Atomics.store(this.u32, 0, head + 1);
    return true;
  }
  enqueueInteract(slotOrHash: number, event: string, cycles: number): boolean {
    return this.push(SAB_CMD_OP_INTERACT, slotOrHash >>> 0, 0, 0, cycles, event);
  }
  enqueueSerial(text: string, cycles: number): boolean {
    return this.push(SAB_CMD_OP_SERIAL, 0, 0, 0, cycles, text);
  }
  enqueueReset(cycles: number): boolean {
    return this.push(SAB_CMD_OP_RESET, 0, 0, 0, cycles, '');
  }
  enqueueSpeed(speed: number, cycles: number): boolean {
    return this.push(SAB_CMD_OP_SET_SPEED, 0, Math.round(speed * 1000), 0, cycles, '');
  }
  enqueueTelemetry(enabled: boolean, mode: number, cycles: number): boolean {
    return this.push(SAB_CMD_OP_SET_TELEMETRY, 0, enabled ? 1 : 0, mode >>> 0, cycles, '');
  }
  enqueueHalt(cycles: number): boolean {
    return this.push(SAB_CMD_OP_HALT, 0, 0, 0, cycles, '');
  }
  enqueueResume(cycles: number): boolean {
    return this.push(SAB_CMD_OP_RESUME, 0, 0, 0, cycles, '');
  }
  enqueueStep(stepCycles: number, cycles: number): boolean {
    return this.push(SAB_CMD_OP_STEP, 0, stepCycles >>> 0, 0, cycles, '');
  }
  enqueueWritePin(pinHash: number, high: number, cycles: number): boolean {
    return this.push(SAB_CMD_OP_WRITE_PIN, pinHash >>> 0, high ? 1 : 0, 0, cycles, '');
  }
  enqueueWatchPin(pinHash: number | string, expectHigh: boolean, cycles: number): boolean {
    // NOTE: target is u16 on the wire — hashPinName output is folded to
    // 16 bits so writer and checkPinWatch() agree (see hashPin16).
    const target = typeof pinHash === 'string' ? hashPin16(pinHash) : (pinHash & 0xffff);
    return this.push(SAB_CMD_OP_WATCH_ADD, target, expectHigh ? 1 : 0, 0, cycles, String(pinHash));
  }
}

/** Worker-side command reader (drains ≤N per tick, cycle-stamped). */
export class SabCommandReader {
  private u32: Uint32Array;
  private u8: Uint8Array;
  constructor(readonly buffer: SharedArrayBuffer, readonly capacity = SAB_CMD_CAPACITY) {
    this.u32 = new Uint32Array(buffer);
    this.u8 = new Uint8Array(buffer);
  }
  drain(maxN: number, nowCycles: number): SabDecodedCommand[] {
    const out: SabDecodedCommand[] = [];
    let tail = Atomics.load(this.u32, 1);
    const head = Atomics.load(this.u32, 0);
    const n = Math.min(maxN, head - tail);
    for (let k = 0; k < n; k++) {
      const idx = tail % this.capacity;
      const base = cmdRecBase(this.capacity) + idx * SAB_CMD_RECORD_B;
      const u16 = new Uint16Array(this.buffer, base, 2);
      const u32r = new Uint32Array(this.buffer, base + 4, 4);
      const dv = new DataView(this.buffer, base + 24, 8);
      const strLen = dv.getUint16(4, true);
      const strOff = dv.getUint16(6, true);
      const str = readRingString(this.u8, cmdStrBase(this.capacity), strOff, strLen);
      const cycles = u32r[2] + u32r[3] * 4294967296;
      const cmd: SabDecodedCommand = {
        op: u16[0], target: u16[1], arg0: u32r[0], arg1: u32r[1],
        cycles: cycles || nowCycles, str,
      };
      if (cmd.op === SAB_CMD_OP_INTERACT) cmd.event = str;
      out.push(cmd);
      tail++;
    }
    if (out.length) Atomics.store(this.u32, 1, tail);
    return out;
  }
}

/** Worker→main event writer (worker thread). Overflow → postMessage fallback. */
export class SabEventWriter {
  private u32: Uint32Array;
  private u8: Uint8Array;
  constructor(readonly buffer: SharedArrayBuffer, readonly capacity = SAB_EVT_CAPACITY) {
    this.u32 = new Uint32Array(buffer);
    this.u8 = new Uint8Array(buffer);
  }
  static create(capacity = SAB_EVT_CAPACITY): SharedArrayBuffer {
    const size = 16 + capacity * SAB_EVT_RECORD_B + SAB_EVT_STR_B;
    const buf = new SharedArrayBuffer(size);
    new Uint32Array(buf).fill(0);
    return buf;
  }
  /** Returns false when the record did not fit (caller posts full postMessage). */
  push(code: number, flags: number, a0: number, a1: number, cycles: number, str: string): boolean {
    const head = Atomics.load(this.u32, 0);
    const tail = Atomics.load(this.u32, 1);
    if (head - tail >= this.capacity) {
      Atomics.add(this.u32, 3, 1); // dropped counter
      return false;
    }
    const idx = head % this.capacity;
    const base = evtRecBase(this.capacity) + idx * SAB_EVT_RECORD_B;
    const wr = writeRingString(this.u8, evtStrBase(this.capacity), SAB_EVT_STR_B, Atomics.load(this.u32, 2), str);
    if (wr.len === -1) {
      Atomics.add(this.u32, 3, 1);
      return false;
    }
    const u16 = new Uint16Array(this.buffer, base, 2);
    u16[0] = code; u16[1] = flags;
    const u32r = new Uint32Array(this.buffer, base + 4, 4);
    u32r[0] = a0 >>> 0; u32r[1] = a1 >>> 0;
    u32r[2] = cycles >>> 0; u32r[3] = Math.floor(cycles / 4294967296) >>> 0;
    const dv = new DataView(this.buffer, base + 24, 8);
    dv.setUint16(0, 0, true); dv.setUint16(2, 0, true);
    dv.setUint16(4, wr.len, true); dv.setUint16(6, wr.off, true);
    Atomics.store(this.u32, 2, wr.head);
    Atomics.store(this.u32, 0, head + 1);
    return true;
  }
}

/** Main-thread event reader (poll in rAF, never blocks). */
export class SabEventReader {
  private u32: Uint32Array;
  private u8: Uint8Array;
  constructor(readonly buffer: SharedArrayBuffer, readonly capacity = SAB_EVT_CAPACITY) {
    this.u32 = new Uint32Array(buffer);
    this.u8 = new Uint8Array(buffer);
  }
  drain(maxN: number): SabDecodedEvent[] {
    const out: SabDecodedEvent[] = [];
    let tail = Atomics.load(this.u32, 1);
    const head = Atomics.load(this.u32, 0);
    const n = Math.min(maxN, head - tail);
    for (let k = 0; k < n; k++) {
      const idx = tail % this.capacity;
      const base = evtRecBase(this.capacity) + idx * SAB_EVT_RECORD_B;
      const u16 = new Uint16Array(this.buffer, base, 2);
      const u32r = new Uint32Array(this.buffer, base + 4, 4);
      const dv = new DataView(this.buffer, base + 24, 8);
      out.push({
        code: u16[0], flags: u16[1], a0: u32r[0], a1: u32r[1],
        cycles: u32r[2] + u32r[3] * 4294967296,
        str: readRingString(this.u8, evtStrBase(this.capacity), dv.getUint16(6, true), dv.getUint16(4, true)),
      });
      tail++;
    }
    if (out.length) Atomics.store(this.u32, 1, tail);
    return out;
  }
  dropped(): number {
    return Atomics.load(this.u32, 3);
  }
}

/** 16-bit pin tag for the u16 target field (writer/reader must agree). */
export function hashPin16(name: string): number {
  return hashPinName(name) & 0xffff;
}

export function hashPinName(name: string): number {
  let h = 2166136261;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Writer used by runners in forceEmitState. Zero-alloc: views created once. */
export class SabStateWriter {
    private u32: Uint32Array;
    private f64: Float64Array;
    private compBase: number;
    private telemetryBase: number;
    readonly numComponents: number;

    constructor(readonly buffer: SharedArrayBuffer) {
        this.u32 = new Uint32Array(buffer);
        this.f64 = new Float64Array(buffer);
        this.compBase = this.u32[SAB_H_COMP_OFF] || SAB_HEADER_BYTES;
        this.telemetryBase = this.u32[SAB_H_TELEMETRY_OFF] || 0;
        this.numComponents = this.u32[SAB_H_NUM_COMPONENTS] || 0;
    }

    static isCompatible(buffer: SharedArrayBuffer): boolean {
        try {
            const u32 = new Uint32Array(buffer);
            return u32[SAB_H_MAGIC] === SAB_MAGIC && u32[SAB_H_VERSION] === SAB_LAYOUT_VERSION;
        } catch {
            return false;
        }
    }

    /** Publish one component slot. fVals/iVals are plain arrays (≤8/≤4). */
    writeSlot(slot: number, version: number, kind: number, boardIdx: number, fVals?: ArrayLike<number>, iVals?: ArrayLike<number>): void {
        if (slot < 0 || slot >= this.numComponents) return;
        const base = this.compBase + slot * SAB_SLOT_STRIDE_B;
        const u32 = this.u32;
        u32[(base + SAB_SLOT_VERSION_OFF) >>> 2] = version >>> 0;
        u32[(base + SAB_SLOT_DIRTY_OFF) >>> 2] = 1;
        const kindOff = (base + SAB_SLOT_KIND_OFF) >>> 1;
        const u16 = new Uint16Array(this.buffer, base + SAB_SLOT_KIND_OFF, 2);
        u16[0] = kind;
        u16[1] = boardIdx;
        void kindOff;
        const f32 = new Float32Array(this.buffer, base + SAB_SLOT_F_OFF, SAB_SLOT_F32);
        for (let k = 0; k < SAB_SLOT_F32; k++) f32[k] = fVals && k < fVals.length ? Number(fVals[k] || 0) : 0;
        const i32 = new Int32Array(this.buffer, base + SAB_SLOT_I_OFF, SAB_SLOT_I32);
        for (let k = 0; k < SAB_SLOT_I32; k++) i32[k] = iVals && k < iVals.length ? Number(iVals[k] || 0) : 0;
    }

    /** Append one telemetry record (lossy ring, overwrite-oldest). */
    pushTelemetry(compSlot: number, code: number, v0: number, v1: number, cycles: number): void {
        if (!this.telemetryBase) return;
        const head = Atomics.load(this.u32, SAB_H_TELEMETRY_HEAD);
        const idx = head % SAB_TELEMETRY_CAPACITY;
        const base = this.telemetryBase + idx * SAB_TELEMETRY_RECORD_B;
        const u16 = new Uint16Array(this.buffer, base, 2);
        u16[0] = compSlot;
        u16[1] = code;
        const f32 = new Float32Array(this.buffer, base + 4, 2);
        f32[0] = v0; f32[1] = v1;
        const u32r = new Uint32Array(this.buffer, base + 12, 3);
        u32r[0] = cycles >>> 0;
        u32r[1] = Math.floor(cycles / 4294967296) >>> 0;
        u32r[2] = Date.now() >>> 0;
        Atomics.store(this.u32, SAB_H_TELEMETRY_HEAD, head + 1);
    }

    /** Bump frameSeq after all slots written. Main polls this (never blocks). */
    publishFrame(simTimeMs: number, telemetryOn: boolean): void {
        this.f64[2] = simTimeMs;
        let flags = Atomics.load(this.u32, SAB_H_FLAGS);
        flags |= SAB_FLAG_RUNNING;
        if (telemetryOn) flags |= SAB_FLAG_TELEMETRY_ON;
        else flags &= ~SAB_FLAG_TELEMETRY_ON;
        Atomics.store(this.u32, SAB_H_FLAGS, flags);
        Atomics.add(this.u32, SAB_H_FRAME_SEQ, 1);
    }
}
