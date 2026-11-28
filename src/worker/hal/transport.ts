// hal/transport.ts — transport implementations (plan §5.4, §11.5).
//
// Two implementations behind the SimTransport contract (see ./types.ts):
//   SabTransport     — hot paths into the shared SAB (pins, slots, serial,
//                      telemetry, events, commands) using sab/layout.ts.
//   MessageTransport — identical event semantics over plain objects (the
//                      postMessage-fallback twin; also the test oracle).
//
// Rules:
// - Same method signatures, same ordering, same loss accounting shape.
// - SAB layout knowledge lives ONLY here (plus sab/layout.ts + sabReader.js).
// - Runners adopt these in Phase 2; until then this module is covered by
//   parity tests proving both transports agree on identical inputs.
import {
  SabStateWriter,
  SabCommandReader,
  SabEventWriter,
  SabPinWriter,
  SabSerialRing,
  SAB_EVT_CODE_RUN_EVENT,
} from '../sab/layout.ts';
import type { RiverEnvelope, RiverLane, SimTransport } from './types.ts';

export interface SabTransportOptions {
  buffer: SharedArrayBuffer;
  /** Board pin label → SAB pin-region index (same map runners build). */
  pinIndex?: Map<string, number>;
  pinWriter?: SabPinWriter;
  stateWriter?: SabStateWriter;
  serialTx?: SabSerialRing;
  evtWriter?: SabEventWriter;
  cmdReader?: SabCommandReader;
  railVoltage?: number;
  clock?: () => number;
}

export interface MessageTransportOptions {
  /** Optional external sink; defaults to an internal sent[] log. */
  sink?: (event: RiverEnvelope) => void;
  seedCommands?: RiverEnvelope[];
  clock?: () => number;
}

/** Map a decoded SAB command record onto the shared envelope shape. */
export function commandRecordToEnvelope(cmd: {
  op: number; target: number; arg0: number; arg1: number;
  cycles: number; str: string; event?: string;
}): RiverEnvelope {
  return {
    schema: 1,
    lane: 'control',
    boardId: '',
    payload: {
      op: cmd.op, target: cmd.target, arg0: cmd.arg0, arg1: cmd.arg1,
      str: cmd.str, event: cmd.event ?? null,
    },
    seq: -1,
    simTimeMs: 0,
  };
}

export class SabTransport implements SimTransport {
  readonly mode = 'sab' as const;
  private seq = 0;
  private readonly clock: () => number;
  private readonly rail: number;

  constructor(private readonly opts: SabTransportOptions) {
    this.clock = opts.clock ?? Date.now;
    this.rail = Number.isFinite(Number(opts.railVoltage)) ? Number(opts.railVoltage) : 3.3;
  }

  private resolveIndex(pin: string): number | undefined {
    const idx = this.opts.pinIndex;
    if (!idx) return undefined;
    return idx.get(pin) ?? idx.get(pin.replace(/^D/i, '')) ?? idx.get(`D${pin}`);
  }

  publishPins(boardId: string, levels: Record<string, boolean>, analog?: Record<string, number>): void {
    void boardId;
    const w = this.opts.pinWriter;
    if (!w) return;
    for (const pin of Object.keys(levels || {})) {
      const bit = this.resolveIndex(pin);
      if (typeof bit !== 'number') continue;
      const high = !!levels[pin];
      const volts = analog && Number.isFinite(Number(analog[pin]))
        ? Number(analog[pin])
        : (high ? this.rail : 0.0);
      try {
        w.writeDigital(bit, high);
        w.writeAnalog(bit, volts);
      } catch { /* transport never breaks sim */ }
    }
  }

  publishSerial(boardId: string, bytes: number[], source: string): void {
    void boardId; void source;
    const ring = this.opts.serialTx;
    if (!ring) return;
    for (const b of bytes || []) {
      try { ring.pushByte(b & 0xff); } catch { /* ignore */ }
    }
  }

  publishComponentSlots(frames: Array<{ id: string; slot: number; version: number; kind: number; f: number[]; i: number[] }>): void {
    const w = this.opts.stateWriter;
    if (!w) return;
    for (const f of frames || []) {
      try { w.writeSlot(f.slot, f.version, f.kind, 0, f.f, f.i); } catch { /* ignore */ }
    }
  }

  publishTelemetryRecords(records: Array<{ slot: number; code: number; v0: number; v1: number; cycles: number }>): void {
    const w = this.opts.stateWriter;
    if (!w) return;
    for (const r of records || []) {
      try { w.pushTelemetry(r.slot, r.code, r.v0, r.v1, r.cycles); } catch { /* ignore */ }
    }
  }

  publishFrame(simTimeMs: number, telemetryOn: boolean): void {
    try { this.opts.stateWriter?.publishFrame(simTimeMs, telemetryOn); } catch { /* ignore */ }
  }

  emitEvent(event: RiverEnvelope): void {
    const w = this.opts.evtWriter;
    if (!w) return;
    const str = JSON.stringify({
      lane: event.lane, boardId: event.boardId, componentId: event.componentId ?? null,
      pin: event.pin ?? null, payload: event.payload ?? null, seq: event.seq,
      simTimeMs: event.simTimeMs,
    });
    try {
      const ok = w.push(SAB_EVT_CODE_RUN_EVENT, 0, 0, 0, 0, str);
      void ok; // false = ring full → postMessage fallback owns it (caller path)
    } catch { /* ignore */ }
  }

  drainCommands(max: number): RiverEnvelope[] {
    const r = this.opts.cmdReader;
    if (!r) return [];
    let decoded: Array<{ op: number; target: number; arg0: number; arg1: number; cycles: number; str: string; event?: string }> = [];
    try { decoded = r.drain(Math.max(1, max), this.clock()); } catch { decoded = []; }
    return decoded.map((c) => ({ ...commandRecordToEnvelope(c), seq: this.seq++, simTimeMs: this.clock() }));
  }
}

export class MessageTransport implements SimTransport {
  readonly mode = 'message' as const;
  readonly sent: RiverEnvelope[] = [];
  private queue: RiverEnvelope[] = [];
  private seq = 0;
  private readonly clock: () => number;

  constructor(private readonly opts: MessageTransportOptions = {}) {
    this.clock = opts.clock ?? Date.now;
    for (const c of opts.seedCommands || []) this.queue.push({ ...c });
  }

  private emit(lane: RiverLane, boardId: string, payload: unknown): void {
    const event: RiverEnvelope = {
      schema: 1, lane, boardId, payload: payload as never,
      seq: this.seq++, simTimeMs: this.clock(),
    };
    if (typeof this.opts.sink === 'function') {
      try { this.opts.sink(event); } catch { /* ignore */ }
    } else {
      this.sent.push(event);
    }
  }

  publishPins(boardId: string, levels: Record<string, boolean>, analog?: Record<string, number>): void {
    this.emit('signal', boardId, { levels: { ...(levels || {}) }, analog: { ...(analog || {}) } });
  }

  publishSerial(boardId: string, bytes: number[], source: string): void {
    this.emit('serial', boardId, { bytes: [...(bytes || [])], source });
  }

  publishComponentSlots(frames: Array<{ id: string; slot: number; version: number; kind: number; f: number[]; i: number[] }>): void {
    this.emit('state', '', { frames: [...(frames || [])] });
  }

  publishTelemetryRecords(records: Array<{ slot: number; code: number; v0: number; v1: number; cycles: number }>): void {
    this.emit('telemetry', '', { records: [...(records || [])] });
  }

  publishFrame(simTimeMs: number, telemetryOn: boolean): void {
    this.emit('state', '', { frame: true, simTimeMs, telemetryOn });
  }

  emitEvent(event: RiverEnvelope): void {
    const copy: RiverEnvelope = {
      schema: 1, lane: event.lane, boardId: event.boardId,
      componentId: event.componentId, pin: event.pin, bus: event.bus,
      source: event.source, payload: event.payload,
      seq: this.seq++, simTimeMs: this.clock(),
    };
    if (typeof this.opts.sink === 'function') {
      try { this.opts.sink(copy); } catch { /* ignore */ }
    } else {
      this.sent.push(copy);
    }
  }

  drainCommands(max: number): RiverEnvelope[] {
    return this.queue.splice(0, Math.max(1, max));
  }
}
