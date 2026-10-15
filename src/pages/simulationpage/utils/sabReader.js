/**
 * SAB state reader (main thread, §12.3 T5 / §12.5 step 3).
 *
 * Reads the worker-published state SAB (layout v1, see worker/sab/layout.ts)
 * WITHOUT postMessage payloads:
 *   - pollSabFrames(): Atomics.load(frameSeq) — cheap seq poll, never blocks.
 *     Returns dirty component slots since last poll (id, slot, version, f, i).
 *     Caller mirrors them into liveOopStatesRef + notifies listeners, same as
 *     the postMessage path in workerStateIngest.js but with zero clone bytes.
 *   - getSabDiag(): header snapshot for Playwright verification
 *     (magic/version/frameSeq/numComponents/simTimeMs/flags).
 *
 * Fallback contract: if crossOriginIsolated === false, or the buffer fails the
 * magic/version check, every function returns null/[] and the caller MUST use
 * the postMessage path unchanged. SAB complements postMessage, never replaces
 * its control/event role (serial/errors/toasts/grading stay on postMessage).
 *
 * Numeric field decoding (SAB_SLOT_F_OFF f0..f7, SAB_SLOT_I_OFF i0..i3):
 *   kind 1 (LED):      f0=brightness, i0=illuminated
 *   kind 2 (servo):    f0=angleDeg,   i0=attached
 *   kind 5 (button):   i0=pressed
 *   kind 7 (buzzer):   i0=isBuzzing
 *   kind 3 (display):  text lines stay on postMessage (variable length);
 *                      i0=dirty flag mirror only.
 *   generic/other:     raw f/i arrays, merged as { f0..f7, i0..i3 }.
 * Decoded values are written into the live-OOP state object under the same
 * keys the React UI already reads (brightness/illuminated/angle/...), plus
 * raw f/i arrays for debugging. postMessage state wins on key conflicts only
 * when its version is newer — tracked via per-component version map.
 */

// Layout constants mirrored from worker/sab/layout.ts (plain JS copy so this
// util stays importable without TS compilation in tests).
// SAB v2 (per-board serial/debug regions) is backward-compatible for readers:
// the v2 allocator keeps every offset this reader uses (pin/comp/telemetry
// regions, slots, rings) at the same derivation, and only appends per-board
// regions + new alloc fields. Accept v1 and v2 buffers.
const SAB_MAGIC = 0x4f485753;
const SAB_LAYOUT_VERSION_MIN = 1;
const SAB_LAYOUT_VERSION_MAX = 2;
const SAB_HEADER_BYTES = 64;
const SAB_SLOT_STRIDE_B = 64;
const SAB_H_MAGIC = 0;
const SAB_H_VERSION = 1;
const SAB_H_FRAME_SEQ = 2;
const SAB_H_NUM_COMPONENTS = 3;
const SAB_H_TELEMETRY_HEAD = 6;
const SAB_H_FLAGS = 7;
const SAB_H_PIN_OFF = 8;
const SAB_H_PIN_LEN = 9;
const SAB_H_COMP_OFF = 10;
// Full map (§10.4): board table (8×16 B at +64), serial rings
// (8+4096 B ×2), debug region (24 B), display descriptors (16×16 B).
const SAB_BOARD_MAX = 8;
const SAB_BOARD_RECORD_B = 16;
const SAB_SERIAL_RING_B = 4096;
const SAB_DEBUG_BYTES = 24;
const SAB_DISPLAY_MAX = 16;
const SAB_DISPLAY_RECORD_B = 16;
const SAB_SLOT_VERSION_OFF = 0;
const SAB_SLOT_DIRTY_OFF = 4;
const SAB_SLOT_KIND_OFF = 8;
const SAB_SLOT_BOARD_OFF = 10;
const SAB_SLOT_F_OFF = 12;
const SAB_SLOT_I_OFF = 44;

const KIND_LED = 1;
const KIND_SERVO = 2;
const KIND_DISPLAY = 3;
const KIND_BUTTON = 5;
const KIND_BUZZER = 7;

function isSabUsable(buffer) {
  if (!buffer) return false;
  if (typeof SharedArrayBuffer !== "undefined" && !(buffer instanceof SharedArrayBuffer)) return false;
  try {
    const u32 = new Uint32Array(buffer);
    if (u32.length < SAB_HEADER_BYTES / 4) return false;
    const version = u32[SAB_H_VERSION] >>> 0;
    return u32[SAB_H_MAGIC] === SAB_MAGIC && version >= SAB_LAYOUT_VERSION_MIN && version <= SAB_LAYOUT_VERSION_MAX;
  } catch {
    return false;
  }
}

export function getSabDiag(buffer) {
  if (!isSabUsable(buffer)) return null;
  try {
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
      pinOff: u32[SAB_H_PIN_OFF],
      pinLen: u32[SAB_H_PIN_LEN],
    };
  } catch {
    return null;
  }
}

/**
 * Poll dirty component slots.
 *
 * @param {SharedArrayBuffer} buffer state SAB from stateSabRef.current
 * @param {Record<string, number>} offsets componentId → slot index (from START alloc)
 * @param {{ lastSeq: number, versions: Record<string, number> }} cursor
 *        mutated in place; survives across polls (keep in a ref).
 * @returns {Array<{ id, slot, version, kind, state }>|null}
 *          null = SAB unusable → use postMessage path.
 *          [] = no new frame since last poll.
 */
export function pollSabFrames(buffer, offsets, cursor) {
  if (!isSabUsable(buffer) || !offsets || !cursor) return null;
  let u32;
  try {
    u32 = new Uint32Array(buffer);
  } catch {
    return null;
  }
  const seq = Atomics.load(u32, SAB_H_FRAME_SEQ);
  if (seq === cursor.lastSeq) return [];
  cursor.lastSeq = seq;

  const compBase = u32[SAB_H_COMP_OFF] || SAB_HEADER_BYTES;
  const out = [];
  for (const id of Object.keys(offsets)) {
    const slot = Number(offsets[id]);
    if (!Number.isFinite(slot) || slot < 0) continue;
    const base = compBase + slot * SAB_SLOT_STRIDE_B;
    let version = 0;
    let dirty = 0;
    try {
      version = u32[(base + SAB_SLOT_VERSION_OFF) >>> 2] >>> 0;
      dirty = u32[(base + SAB_SLOT_DIRTY_OFF) >>> 2] >>> 0;
    } catch {
      continue;
    }
    if (!dirty) continue;
    if (cursor.versions[id] === version) {
      // Same version re-emitted (writer bumps frameSeq per flush even when
      // this slot is unchanged) — not new data. Clear stale dirty and skip.
      try {
        Atomics.store(u32, (base + SAB_SLOT_DIRTY_OFF) >>> 2, 0);
      } catch { /* ignore */ }
      continue;
    }
    let kind = 0;
    let fVals = [];
    let iVals = [];
    try {
      const u16 = new Uint16Array(buffer, base + SAB_SLOT_KIND_OFF, 2);
      kind = u16[0];
      const f32 = new Float32Array(buffer, base + SAB_SLOT_F_OFF, 8);
      fVals = Array.from(f32);
      const i32 = new Int32Array(buffer, base + SAB_SLOT_I_OFF, 4);
      iVals = Array.from(i32);
    } catch {
      continue;
    }
    // Clear dirty AFTER read — single-reader (main) contract.
    try {
      Atomics.store(u32, (base + SAB_SLOT_DIRTY_OFF) >>> 2, 0);
    } catch { /* ignore */ }
    cursor.versions[id] = version;
    out.push({ id, slot, version, kind, state: decodeSlotState(kind, fVals, iVals) });
  }
  return out;
}

/**
 * Raw slot read (no dirty check, no cursor, no flag clearing).
 * For one-shot hydrate paths (telemetry seed after START) where the rAF
 * poller may already have consumed dirty flags. Returns ALL slots with
 * their current version/kind/state. Never returns null — [] when unusable.
 */
export function readAllSlots(buffer, offsets) {
  if (!isSabUsable(buffer) || !offsets) return [];
  let u32;
  try {
    u32 = new Uint32Array(buffer);
  } catch {
    return [];
  }
  const compBase = u32[SAB_H_COMP_OFF] || SAB_HEADER_BYTES;
  const out = [];
  for (const id of Object.keys(offsets)) {
    const slot = Number(offsets[id]);
    if (!Number.isFinite(slot) || slot < 0) continue;
    const base = compBase + slot * SAB_SLOT_STRIDE_B;
    try {
      const version = u32[(base + SAB_SLOT_VERSION_OFF) >>> 2] >>> 0;
      const u16 = new Uint16Array(buffer, base + SAB_SLOT_KIND_OFF, 2);
      const kind = u16[0];
      const f32 = new Float32Array(buffer, base + SAB_SLOT_F_OFF, 8);
      const i32 = new Int32Array(buffer, base + SAB_SLOT_I_OFF, 4);
      out.push({ id, slot, version, kind, state: decodeSlotState(kind, Array.from(f32), Array.from(i32)) });
    } catch {
      continue;
    }
  }
  return out;
}

const KIND_SENSOR = 4;
const KIND_MOTOR = 6;

function decodeSlotState(kind, f, i) {
  const raw = {};
  for (let k = 0; k < 8; k++) raw[`f${k}`] = f[k] || 0;
  for (let k = 0; k < 4; k++) raw[`i${k}`] = i[k] || 0;
  if (kind === KIND_LED) {
    return { brightness: f[0] || 0, illuminated: (i[0] || 0) !== 0, ...raw };
  }
  if (kind === KIND_SERVO) {
    return { angle: f[0] || 0, attached: (i[0] || 0) !== 0, ...raw };
  }
  if (kind === KIND_BUTTON) {
    return { pressed: (i[0] || 0) !== 0, value: f[0] || 0, ...raw };
  }
  if (kind === KIND_BUZZER) {
    return { isBuzzing: (i[0] || 0) !== 0, ...raw };
  }
  if (kind === KIND_SENSOR) {
    // Generic sensor numerics: f0=primary value, f1=secondary (writer-defined
    // per component via uiState; e.g. DHT f0=temp, f1=humidity).
    return { value: f[0] || 0, value2: f[1] || 0, ...raw };
  }
  if (kind === KIND_MOTOR) {
    return { speed: f[0] || 0, angle: f[1] || 0, enabled: (i[0] || 0) !== 0, ...raw };
  }
  if (kind === KIND_DISPLAY) {
    // Display numerics: i0=powerOn/displayOn dirty mirror; text lines stay
    // on postMessage (variable length). powerOn covers ILI9341-style slots,
    // displayOn covers SSD1306-style slots — both from i0.
    return { powerOn: (i[0] || 0) !== 0, displayOn: (i[0] || 0) !== 0, ...raw };
  }
  return raw;
}

// T3: telemetry ring reader. Returns up to `maxRecords` newest records as
// { compSlot, code, v0, v1, cycles } WITHOUT JSON/stringify. Caller filters
// by selectedTelemetryComponentIds BEFORE formatting (pre-read filter).
const SAB_TELEMETRY_RECORD_B = 32;
const SAB_TELEMETRY_CAPACITY = 1024;
const SAB_H_TELEMETRY_OFF = 12;

export function readTelemetryRing(buffer, sinceHead = 0, maxRecords = 64) {
  if (!isSabUsable(buffer)) return null;
  try {
    const u32 = new Uint32Array(buffer);
    const head = Atomics.load(u32, SAB_H_TELEMETRY_HEAD);
    const teleBase = u32[SAB_H_TELEMETRY_OFF];
    if (!teleBase) return [];
    const start = Math.max(sinceHead, head - Math.min(maxRecords, SAB_TELEMETRY_CAPACITY));
    const out = [];
    for (let h = start; h < head; h++) {
      const idx = ((h % SAB_TELEMETRY_CAPACITY) + SAB_TELEMETRY_CAPACITY) % SAB_TELEMETRY_CAPACITY;
      const base = teleBase + idx * SAB_TELEMETRY_RECORD_B;
      const u16 = new Uint16Array(buffer, base, 2);
      const f32 = new Float32Array(buffer, base + 4, 2);
      const c32 = new Uint32Array(buffer, base + 12, 2);
      out.push({ compSlot: u16[0], code: u16[1], v0: f32[0], v1: f32[1], cycles: c32[0] + c32[1] * 4294967296 });
    }
    // River loss accounting (plan §11.4): records overwritten before this
    // reader saw them are reported, never silently dropped. The writer
    // overwrites oldest without a shared tail word, but the reader knows
    // `head`, its own cursor, and how many it consumed — so skipped is
    // exact: arrived minus returned.
    const skipped = Math.max(0, (head - sinceHead) - out.length);
    return { records: out, head, skipped };
  } catch {
    return null;
  }
}

/**
 * Drain worker→main event ring (§10.4/§10.7).
 * BREAK_HIT/WATCH_HIT surface as console entries + window.__sabLastEvents;
 * ERROR/TOAST do the same (postMessage equivalents stay authoritative).
 * Serial bytes stay on postMessage (strings assembled off-tick) — event
 * SERIAL_BYTE records are counted, not formatted, to avoid per-frame strings.
 */
const EVT_NAMES = {
  1: "SERIAL_BYTE",
  2: "TOAST",
  3: "ERROR",
  4: "BREAK_HIT",
  5: "SYNC_FAULT",
  6: "WATCH_HIT",
  7: "RUN_EVENT",
};

export function drainSabEvents(evtReader, maxN = 16, appendConsoleEntry) {
  if (!evtReader || typeof evtReader.drain !== "function") return [];
  let evts = [];
  try {
    evts = evtReader.drain(maxN) || [];
  } catch {
    return [];
  }
  if (!evts.length || typeof appendConsoleEntry !== "function") return evts;
  for (const e of evts) {
    const name = EVT_NAMES[e.code] || `EVT_${e.code}`;
    if (e.code === 4 || e.code === 6) {
      appendConsoleEntry(
        "warn",
        `[SAB ${name}] ${e.str || ""} (cycles=${e.cycles})`,
        "simulator",
      );
    } else if (e.code === 3) {
      appendConsoleEntry("error", `[SAB ${name}] ${e.str || ""}`, "simulator");
    } else if (e.code === 2 || e.code === 5 || e.code === 7) {
      appendConsoleEntry("info", `[SAB ${name}] ${e.str || ""}`, "simulator");
    }
    // code 1 (SERIAL_BYTE): counted only — strings stay on postMessage.
  }
  return evts;
}

/**
 * Read the pin bitfield + analog array (§10.4 full map).
 * boardPinMaps (from START, same order as allocateStateSab) give per-board
 * bases; with no maps the region is 0-length and this returns {}.
 * Returns { [boardId]: { bits: Uint32Array copy, analog: number[] } } —
 * copies only (never live views; the worker keeps writing).
 */
export function readPinRegion(buffer, boardPinMaps) {
  if (!isSabUsable(buffer) || !Array.isArray(boardPinMaps) || boardPinMaps.length === 0) {
    return {};
  }
  try {
    const u32 = new Uint32Array(buffer);
    const pinBase = u32[SAB_H_PIN_OFF] || 0;
    const pinLen = u32[SAB_H_PIN_LEN] || 0;
    if (!pinBase || !pinLen) return {};
    const out = {};
    let bitCursor = 0;
    let analogCursor = 0;
    for (const b of boardPinMaps.slice(0, SAB_BOARD_MAX)) {
      const n = Array.isArray(b?.pins) ? b.pins.length : 0;
      const words = Math.ceil(n / 32);
      const bits = [];
      for (let w = 0; w < words; w++) {
        bits.push(Atomics.load(u32, (pinBase >>> 2) + bitCursor + w) >>> 0);
      }
      const f32 = new Float32Array(buffer, pinBase + (function () {
        // analog base = pinBase + totalBitWords*4; recompute from maps
        let totalBits = 0;
        for (const bb of boardPinMaps.slice(0, SAB_BOARD_MAX)) {
          totalBits += Math.ceil((Array.isArray(bb?.pins) ? bb.pins.length : 0) / 32);
        }
        return totalBits * 4;
      })() + analogCursor * 4, n);
      out[String(b.boardId)] = { bits, analog: Array.from(f32) };
      bitCursor += words;
      analogCursor += n;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Drain a serial byte ring (§10.4) at an absolute buffer offset.
 * Returns up to maxN byte values. Strings assemble on the caller off-tick.
 * Shape preserved (array) for existing callers; use drainSerialRingCounted
 * when loss accounting matters.
 */
export function drainSerialRing(buffer, ringOffset, maxN = 256) {
  return drainSerialRingCounted(buffer, ringOffset, maxN).bytes;
}

/**
 * Counted serial drain (river loss accounting, plan §11.4): bytes the ring
 * overwrote before this reader saw them are reported as `skipped`, never
 * silently dropped. `tail` is this reader's cursor only when it is the sole
 * drainer; with competing drainers `skipped` is a lower bound.
 */
export function drainSerialRingCounted(buffer, ringOffset, maxN = 256) {
  if (!isSabUsable(buffer) || !Number.isFinite(ringOffset) || ringOffset <= 0) {
    return { bytes: [], skipped: 0 };
  }
  try {
    const u32 = new Uint32Array(buffer, ringOffset, 2);
    let tail = Atomics.load(u32, 1);
    const head = Atomics.load(u32, 0);
    const pending = Math.max(0, head - tail);
    const n = Math.min(maxN, pending);
    const skipped = pending - n;
    const u8 = new Uint8Array(buffer, ringOffset + 8, SAB_SERIAL_RING_B);
    const out = [];
    for (let k = 0; k < n; k++) {
      out.push(u8[(tail % SAB_SERIAL_RING_B + SAB_SERIAL_RING_B) % SAB_SERIAL_RING_B]);
      tail++;
    }
    if (out.length) Atomics.store(u32, 1, tail);
    return { bytes: out, skipped };
  } catch {
    return { bytes: [], skipped: 0 };
  }
}

/**
 * Read the debug region (§10.7 DEBUG REGION): pc/sp/cycles/breakReason/halted.
 * Valid only while paused/halted; runners mirror snapshot() here.
 */
export function readDebugRegion(buffer, debugOffset) {
  if (!isSabUsable(buffer) || !Number.isFinite(debugOffset) || debugOffset <= 0) {
    return null;
  }
  try {
    const u32 = new Uint32Array(buffer, debugOffset, 6);
    return {
      pc: u32[0] >>> 0,
      sp: u32[1] >>> 0,
      cycles: u32[2] + u32[3] * 4294967296,
      breakReason: u32[4] >>> 0,
      halted: u32[5] !== 0,
    };
  } catch {
    return null;
  }
}

/**
 * Read display descriptors (§10.4, slot-oriented — never pixels).
 * Returns [{ compSlot, width, height, vramHandle, dirtyRect }] for
 * non-zero records (index 0 with slot 0 counts when width > 0).
 */
export function readDisplayDescriptors(buffer, displayDescOffset, max = SAB_DISPLAY_MAX) {
  if (!isSabUsable(buffer) || !Number.isFinite(displayDescOffset) || displayDescOffset <= 0) {
    return [];
  }
  try {
    const out = [];
    const n = Math.max(0, Math.min(max, SAB_DISPLAY_MAX));
    for (let idx = 0; idx < n; idx++) {
      const base = displayDescOffset + idx * SAB_DISPLAY_RECORD_B;
      const u16 = new Uint16Array(buffer, base, 4);
      const u32r = new Uint32Array(buffer, base + 8, 1);
      if (u16[1] === 0 && u16[2] === 0) continue; // empty (no dimensions)
      out.push({
        compSlot: u16[0],
        width: u16[1],
        height: u16[2],
        vramHandle: u16[3],
        dirtyRect: u32r[0] >>> 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function createSabCursor() {
  return { lastSeq: -1, versions: {} };
}

/**
 * Apply polled SAB frames into the live-OOP mirror (same shape as the
 * postMessage path: liveOopStatesRef.current[compId] = state object).
 * Returns the list of changed compIds (caller notifies listeners).
 */
export function applySabFrames(frames, liveOopStatesRef, runComponentUpdateCountsRef) {
  if (!Array.isArray(frames) || frames.length === 0 || !liveOopStatesRef) return [];
  const changed = [];
  const nextStates = liveOopStatesRef.current;
  for (const fr of frames) {
    const compId = String(fr?.id || "").trim();
    if (!compId) continue;
    const prev = nextStates[compId] || {};
    nextStates[compId] = { ...prev, ...fr.state, _sabVersion: fr.version, _sabSlot: fr.slot };
    if (runComponentUpdateCountsRef) {
      runComponentUpdateCountsRef.current[compId] =
        (runComponentUpdateCountsRef.current[compId] || 0) + 1;
    }
    changed.push(compId);
  }
  return changed;
}

/**
 * readRiver — the single river intake (plan §11.5).
 *
 * One call returns every readable lane since the caller's cursor, each with
 * loss accounting. Pure reads, zero worker dependency, never throws:
 * unusable buffer → null (caller uses the postMessage path).
 *
 * @param {SharedArrayBuffer} buffer state SAB from START alloc
 * @param {object} args
 *   boardPinMaps: same order as allocateStateSab
 *   offsets: componentId → slot index
 *   cursor: { lastSeq, versions } from createSabCursor() (frames lane)
 *   telemetrySinceHead/telemetryMax: telemetry ring window
 *   serialRings: [{ boardId, offset }] byte-ring offsets to drain
 *   serialMax: per-ring byte cap
 *   debugOffset, displayDescOffset, displayMax: optional regions
 * @returns null when the river is unusable; otherwise
 *   { header, pins, frames, serial: {boardId: {bytes, skipped}},
 *     telemetry: {records, head, skipped} | null,
 *     debug, displays, skipped: {telemetry, serial} }
 */
export function readRiver(buffer, args = {}) {
  if (!isSabUsable(buffer)) return null;
  const {
    boardPinMaps = [],
    offsets = null,
    cursor = null,
    telemetrySinceHead = 0,
    telemetryMax = 64,
    serialRings = [],
    serialMax = 256,
    debugOffset = 0,
    displayDescOffset = 0,
    displayMax = SAB_DISPLAY_MAX,
  } = args || {};
  try {
    const header = getSabDiag(buffer);
    const pins = readPinRegion(buffer, boardPinMaps);
    const frames = cursor ? (pollSabFrames(buffer, offsets, cursor) || []) : [];
    const serial = {};
    let serialSkipped = 0;
    for (const ring of serialRings || []) {
      if (!ring || !Number.isFinite(ring.offset) || ring.offset <= 0) continue;
      const res = drainSerialRingCounted(buffer, ring.offset, serialMax);
      serial[String(ring.boardId || '')] = res;
      serialSkipped += res.skipped;
    }
    const telemetry = readTelemetryRing(buffer, telemetrySinceHead, telemetryMax);
    const debug = debugOffset > 0 ? readDebugRegion(buffer, debugOffset) : null;
    const displays = displayDescOffset > 0 ? readDisplayDescriptors(buffer, displayDescOffset, displayMax) : [];
    return {
      header,
      pins,
      frames,
      serial,
      telemetry,
      debug,
      displays,
      skipped: {
        telemetry: (telemetry && typeof telemetry === 'object' ? telemetry.skipped : 0) || 0,
        serial: serialSkipped,
      },
    };
  } catch {
    return null;
  }
}
