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
const SAB_MAGIC = 0x4f485753;
const SAB_LAYOUT_VERSION = 1;
const SAB_HEADER_BYTES = 64;
const SAB_SLOT_STRIDE_B = 64;
const SAB_H_MAGIC = 0;
const SAB_H_VERSION = 1;
const SAB_H_FRAME_SEQ = 2;
const SAB_H_NUM_COMPONENTS = 3;
const SAB_H_TELEMETRY_HEAD = 6;
const SAB_H_FLAGS = 7;
const SAB_H_COMP_OFF = 10;
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
    return u32[SAB_H_MAGIC] === SAB_MAGIC && u32[SAB_H_VERSION] === SAB_LAYOUT_VERSION;
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
    return { records: out, head };
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
