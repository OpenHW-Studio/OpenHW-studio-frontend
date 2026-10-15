/**
 * Debug service — worker-side control plane (§10.7).
 *
 * Consumes SabCommandReader records (HALT/RESUME/STEP/WRITE_PIN/WATCH_ADD/
 * READ_MEM) and exposes:
 *  - drainCommands(reader, nowCycles): apply ≤N commands per tick, return
 *    whether a halt took effect. Cycle-stamped; deterministic.
 *  - checkPinWatch(pinName, high, cycles): pin watchpoint edge check —
 *    called from propagateBoardPin paths; emits WATCH_HIT on match.
 *  - checkPcBreakpoint(pc, cycles): PC breakpoint check at chunk boundary
 *    (never per-instruction string compare) — emits BREAK_HIT on match.
 *  - readMem(addr, len) / snapshotCpu(cpu): DEBUG REGION fill (pc/sp/cycles/
 *    reason) valid only while paused; UI polls via SAB header.
 *  - getCommandLog() / replayDigest(): record/replay — command log with
 *    cycle stamps; digest is a deterministic FNV-1a hex over the log so two
 *    identical runs produce identical digests (grading/CI gate).
 *
 * Events ride SabEventWriter; overflow → caller posts full postMessage body
 * (SAB events are hints, postMessage stays authoritative — §10.5).
 * Serial/errors/toasts/grading NEVER flow through here.
 */
import {
  SAB_CMD_OP_HALT,
  SAB_CMD_OP_RESUME,
  SAB_CMD_OP_STEP,
  SAB_CMD_OP_WRITE_PIN,
  SAB_CMD_OP_READ_MEM,
  SAB_CMD_OP_WATCH_ADD,
  SAB_EVT_CODE_BREAK_HIT,
  SAB_EVT_CODE_WATCH_HIT,
  SAB_FLAG_PAUSED,
  SAB_H_FLAGS,
  hashPin16,
  type SabDecodedCommand,
} from '../sab/layout.ts';
import type { SabCommandReader, SabEventWriter } from '../sab/layout.ts';

export interface DebugSnapshot {
  pc: number;
  sp: number;
  cycles: number;
  breakReason: number;
  halted: boolean;
}

interface WatchEntry {
  kind: 'pin';
  pinHash: number;
  pinName: string;
  expectHigh: boolean;
  lastHigh: boolean | null;
}

export class DebugService {
  private halted = false;
  private stepRemaining = 0;
  private cycles = 0;
  private pc = 0;
  private sp = 0;
  private breakReason = 0;
  private watches: WatchEntry[] = [];
  private pcBreakpoints = new Set<number>();
  private commandLog: SabDecodedCommand[] = [];
  private u32: Uint32Array;

  constructor(
    readonly stateBuffer: SharedArrayBuffer,
    readonly slotById: Record<string, number> = {},
    readonly evtWriter: SabEventWriter | null = null,
  ) {
    this.u32 = new Uint32Array(stateBuffer);
  }

  getCycles(): number { return this.cycles; }
  isHalted(): boolean { return this.halted; }

  /** Direct controls for runner pause()/resume() (postMessage path). */
  halt(): void {
    if (!this.halted) { this.halted = true; this.breakReason = 1; }
    this.setPausedFlag();
    this.emit(SAB_EVT_CODE_BREAK_HIT, 0, 0, 'halt');
  }

  resume(): void {
    if (this.halted) { this.halted = false; this.breakReason = 0; }
    this.stepRemaining = 0;
    this.setPausedFlag();
  }

  private setPausedFlag(): void {
    try {
      let flags = Atomics.load(this.u32, SAB_H_FLAGS);
      if (this.halted) flags |= SAB_FLAG_PAUSED;
      else flags &= ~SAB_FLAG_PAUSED;
      Atomics.store(this.u32, SAB_H_FLAGS, flags);
    } catch { /* header write must never break sim */ }
  }

  private emit(code: number, a0: number, a1: number, str: string): void {
    try {
      const ok = this.evtWriter?.push(code, 0, a0, a1, this.cycles, str);
      if (ok === false) {
        // Overflow — the caller (runner/worker) posts the full postMessage.
        // Service records the drop intent via flags in the event itself.
      }
    } catch { /* event write never breaks sim */ }
  }

  /** Drain ≤maxN commands. Returns true if halt state changed this call. */
  drainCommands(reader: SabCommandReader, nowCycles: number, maxN = 16): boolean {
    const cmds = reader.drain(maxN, nowCycles);
    if (!cmds.length) return false;
    let haltChanged = false;
    for (const c of cmds) {
      this.cycles = c.cycles || nowCycles;
      this.commandLog.push({ ...c });
      if (c.op === SAB_CMD_OP_HALT) {
        if (!this.halted) { this.halted = true; this.breakReason = 1; haltChanged = true; }
        this.setPausedFlag();
        this.emit(SAB_EVT_CODE_BREAK_HIT, 0, 0, 'halt');
      } else if (c.op === SAB_CMD_OP_RESUME) {
        if (this.halted) { this.halted = false; this.breakReason = 0; haltChanged = true; }
        this.stepRemaining = 0;
        this.setPausedFlag();
      } else if (c.op === SAB_CMD_OP_STEP) {
        this.stepRemaining += Math.max(1, c.arg0 || 1);
        if (this.halted) haltChanged = true; // stepping while halted still advances
      } else if (c.op === SAB_CMD_OP_WATCH_ADD) {
        const name = c.str || String(c.target);
        this.watches.push({
          kind: 'pin', pinHash: c.target >>> 0, pinName: name,
          expectHigh: c.arg0 === 1, lastHigh: null,
        });
        if (this.watches.length > 32) this.watches.shift();
      } else if (c.op === SAB_CMD_OP_WRITE_PIN || c.op === SAB_CMD_OP_READ_MEM) {
        // Applied by the runner (owns pins/memory); service logs + stamps.
      }
    }
    return haltChanged;
  }

  /** Consume step budget. Returns cycles the tick may execute (0 = stay frozen). */
  takeStepBudget(requested: number): number {
    if (!this.halted) return requested;
    const n = Math.min(requested, Math.max(0, this.stepRemaining));
    this.stepRemaining -= n;
    this.cycles += n;
    return n;
  }

  /** Queue a STEP budget directly (postMessage fallback path).
   * Logs the record so replayDigest() stays deterministic even when the
   * command bypassed the ring. Returns the queued amount. */
  queueStep(n: number): number {
    const amount = Math.max(1, Math.floor(Number(n) || 1));
    this.stepRemaining += amount;
    this.commandLog.push({
      op: SAB_CMD_OP_STEP, target: 0, arg0: amount, arg1: 0,
      cycles: this.cycles, str: '',
    });
    return amount;
  }

  /** Pending STEP budget (for the freeze-loop auto-consume check). */
  pendingSteps(): number {
    return Math.max(0, this.stepRemaining);
  }

  /** Advance cycle clock when running free (called once per tick). */
  advanceFree(cycles: number): void {
    if (!this.halted) this.cycles += Math.max(0, cycles);
  }

  /** Pin watchpoint — call on board-pin edges. Returns true on hit. */
  checkPinWatch(pinName: string, high: boolean, cycles: number): boolean {
    const h = hashPin16(pinName);
    let hit = false;
    for (const w of this.watches) {
      if (w.kind !== 'pin' || w.pinHash !== h) continue;
      const prev = w.lastHigh;
      w.lastHigh = high;
      if (prev === null) continue; // baseline, no edge yet
      if (prev !== high && high === w.expectHigh) {
        hit = true;
        this.emit(SAB_EVT_CODE_WATCH_HIT, h, high ? 1 : 0, pinName);
      }
    }
    if (cycles) this.cycles = Math.max(this.cycles, cycles);
    return hit;
  }

  /** PC breakpoint — call at chunk boundary only. Returns true on hit. */
  checkPcBreakpoint(pc: number, cycles: number): boolean {
    this.pc = pc >>> 0;
    if (cycles) this.cycles = Math.max(this.cycles, cycles);
    if (this.pcBreakpoints.has(this.pc)) {
      this.halted = true;
      this.breakReason = 2;
      this.setPausedFlag();
      this.emit(SAB_EVT_CODE_BREAK_HIT, this.pc, 0, `pc=0x${this.pc.toString(16)}`);
      return true;
    }
    return false;
  }

  addPcBreakpoint(pc: number): void {
    this.pcBreakpoints.add(pc >>> 0);
    if (this.pcBreakpoints.size > 64) {
      const first = this.pcBreakpoints.values().next().value;
      if (first !== undefined) this.pcBreakpoints.delete(first);
    }
  }

  /** Direct pin-watch registration (DEBUG_WATCH postMessage fallback path).
   * Ring path (WATCH_ADD record) stays authoritative for cycle stamps; this
   * covers no-ring boards + immediate UI feedback before the next drain. */
  addPinWatch(pinName: string, expectHigh = true): void {
    const name = String(pinName || '').trim();
    if (!name) return;
    if (this.watches.some((w) => w.pinName === name)) return;
    this.watches.push({
      kind: 'pin', pinHash: hashPin16(name), pinName: name,
      expectHigh: expectHigh !== false, lastHigh: null,
    });
    if (this.watches.length > 32) this.watches.shift();
  }

  removePinWatch(pinName: string): void {
    const name = String(pinName || '').trim();
    this.watches = this.watches.filter((w) => w.pinName !== name);
  }

  getWatches(): Array<{ pin: string; expectHigh: boolean }> {
    return this.watches.map((w) => ({ pin: w.pinName, expectHigh: w.expectHigh }));
  }

  clearBreakpoints(): void {
    this.pcBreakpoints.clear();
    this.watches = [];
  }

  /** DEBUG REGION snapshot (valid while paused; UI polls, read-only). */
  snapshot(sp = 0): DebugSnapshot {
    return { pc: this.pc, sp, cycles: this.cycles, breakReason: this.breakReason, halted: this.halted };
  }

  readMem(addr: number, len: number): Uint8Array {
    // Placeholder backing — runners override with real CPU memory via
    // attachMemory(view). Deterministic zeros keep the contract testable.
    const view = this.memView;
    const out = new Uint8Array(Math.max(0, Math.min(len, 256)));
    if (view) out.set(view.subarray(addr >>> 0, (addr >>> 0) + out.length));
    return out;
  }

  private memView: Uint8Array | null = null;
  attachMemory(view: Uint8Array): void { this.memView = view; }

  getCommandLog(): SabDecodedCommand[] {
    return this.commandLog.map((c) => ({ ...c }));
  }

  /** Deterministic digest over the command log (record/replay gate). */
  replayDigest(): string {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    const mix = (n: number) => {
      h1 = Math.imul(h1 ^ (n >>> 0), 16777619);
      h2 = Math.imul(h2 + (n >>> 0), 31);
    };
    for (const c of this.commandLog) {
      mix(c.op); mix(c.target); mix(c.arg0); mix(c.arg1);
      mix(c.cycles >>> 0); mix(Math.floor(c.cycles / 4294967296));
      for (let i = 0; i < c.str.length; i++) mix(c.str.charCodeAt(i));
    }
    const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
    // 64-hex digest: 8 words alternating the two accumulators (deterministic).
    return hex(h1) + hex(h2) + hex(Math.imul(h1, 31)) + hex(h2 ^ h1) +
           hex(Math.imul(h2, 33)) + hex(h1 ^ 0x9e3779b9) + hex(Math.imul(h1 ^ h2, 7)) + hex(h2 + h1);
  }
}
