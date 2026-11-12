/**
 * lockstep-barrier.ts — SAB-Atomics step barrier for multi-board lockstep.
 *
 * Phase B transport: the parent sim worker and each per-board compute worker
 * share one small Int32Array. Word 0 is the step sequence (parent writes,
 * workers wait); words 1..N are per-board ACKs (worker `barrierIdx` writes,
 * parent waits). Same scheduler protocol as the postMessage BOARD_STEP path
 * (same quanta, same stepQuantum calls) — only the wakeup/ACK transport
 * moves onto SAB Atomics, so STEP delivery + completion are observable in
 * shared memory instead of message queues.
 *
 * The barrier is BOUNDED, never hard: the parent collects ACKs with a
 * timeout and always advances (a hung board stretches ticks, never wedges
 * the run); workers re-check stop conditions on every wait slice. All
 * helpers are synchronous and main-thread safe except the blocking waits,
 * which only ever run inside worker threads (nodes/browsers throw on
 * Atomics.wait on the main thread — callers gate on that).
 */

export const BARRIER_STEP_IDX = 0;
/** ACK cell for board `barrierIdx` (dense 0..N-1 spawn order). */
export function barrierAckIdx(barrierIdx: number): number {
    return 1 + Math.max(0, Math.floor(Number(barrierIdx) || 0));
}

/** Allocate a zeroed barrier for up to `numBoards` boards. Null when SAB is unavailable. */
export function createBarrier(numBoards: number): { sab: SharedArrayBuffer; cells: Int32Array } | null {
    try {
        if (typeof SharedArrayBuffer === 'undefined') return null;
        const cap = Math.max(1, Math.floor(Number(numBoards) || 1));
        const sab = new SharedArrayBuffer(4 * (1 + cap));
        return { sab, cells: new Int32Array(sab) };
    } catch {
        return null;
    }
}

/** Parent: publish a new step sequence and wake all waiting board workers. */
export function barrierPostStep(cells: Int32Array, seq: number): void {
    try {
        Atomics.store(cells, BARRIER_STEP_IDX, Math.max(0, Math.floor(Number(seq) || 0)));
        Atomics.notify(cells, BARRIER_STEP_IDX);
    } catch { /* store/notify never breaks the scheduler tick */ }
}

/**
 * Parent: bounded ACK collection. Returns the observed ACK per board index.
 * Never blocks longer than `timeoutMs` TOTAL across all boards; boards that
 * have not ACKed in time report their last observed value (stragglers are
 * flagged by the skew check, never waited on forever).
 */
export function barrierCollectAcks(
    cells: Int32Array,
    ackIdxs: number[],
    seq: number,
    timeoutMs: number,
): number[] {
    const out: number[] = [];
    const deadline = Date.now() + Math.max(0, Number(timeoutMs) || 0);
    for (const ai of ackIdxs) {
        let cur: number;
        try {
            cur = Atomics.load(cells, ai);
        } catch {
            cur = seq; // unreadable cell: treat as acked, never stall
        }
        while (cur < seq) {
            const remain = deadline - Date.now();
            if (remain <= 0) break;
            try {
                // Wait only while the cell still holds the stale value;
                // returns immediately ('not-equal') when already advanced.
                Atomics.wait(cells, ai, cur, Math.min(remain, 10));
            } catch {
                break; // no blocking wait here (e.g. main thread): move on
            }
            try {
                cur = Atomics.load(cells, ai);
            } catch {
                cur = seq;
                break;
            }
        }
        out.push(cur);
    }
    return out;
}

/**
 * Worker: non-blocking single poll. If the step cell advanced past
 * `lastSeq`, runs ONE catch-up step covering the whole gap (capped) and
 * ACKs only what it actually advanced — the remainder converges on later
 * ticks. Returns the new last-acked sequence (unchanged when idle). The
 * blocking wait-loop lives in board.worker; this unit stays pure and fully
 * headless-testable.
 *
 * Why coalesce: a board that falls `gap` quanta behind (tab jank, one slow
 * WASM burst) would otherwise need `gap` ticks to catch up while the skew
 * watchdog glares. One `gap × quantumMs` call advances (near-)identical
 * sim-time — AVR chunks work internally by 2ms sim, baud budgets and cycle
 * counters scale linearly — at a fraction of the per-call overhead. The cap
 * keeps any single step bounded so catch-up itself can't wedge the thread.
 */
export const BARRIER_MAX_CATCHUP_QUANTA = 4;
export function barrierTryStep(
    cells: Int32Array,
    ackIdx: number,
    lastSeq: number,
    quantumMs: number,
    step: (seq: number, simMs: number) => void,
): number {
    let cur = lastSeq;
    try {
        cur = Atomics.load(cells, BARRIER_STEP_IDX);
    } catch {
        return lastSeq;
    }
    const gap = cur - lastSeq;
    if (gap <= 0) return lastSeq;
    const n = Math.min(gap, BARRIER_MAX_CATCHUP_QUANTA);
    const q = Math.max(0.5, Number(quantumMs) || 8);
    const ack = lastSeq + n;
    try {
        step(ack, n * q);
    } catch { /* a bad quantum never breaks the barrier loop */ }
    try {
        Atomics.store(cells, ackIdx, ack);
        Atomics.notify(cells, ackIdx, 1);
    } catch { /* ack store never breaks the loop */ }
    return ack;
}

/** Skew across boards: how far the slowest ACK lags the current sequence. */
export function barrierSkew(acks: number[], seq: number): { minAck: number; skew: number } {
    let minAck = seq;
    for (const a of acks) {
        const v = Math.floor(Number(a) || 0);
        if (v < minAck) minAck = v;
    }
    return { minAck, skew: seq - minAck };
}
