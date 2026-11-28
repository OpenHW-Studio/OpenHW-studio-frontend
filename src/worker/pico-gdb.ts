/**
 * pico-gdb.ts — minimal GDB-RSP driver for the pico-emu watchpoint bridge.
 *
 * Talks to the core's GDB stub over its JS queue API (push_rx / pop_tx /
 * tx_len / poll) to trap MMIO writes (I2C TAR + DATA_CMD) and recover the
 * trapped byte by decoding the faulting Thumb store. Lets runner-owned
 * peripheral bridges observe firmware-driven bus traffic the core never
 * exposes — same component interface as AVR's TWIAdapter, no core changes.
 *
 * Transport is injected (sync fns) so the packet layer is fully
 * headless-testable; the live core only enters in the runner wiring.
 */

export interface GdbTransport {
    pushRx(bytes: Uint8Array): void;
    popTx(maxlen: number): Uint8Array;
    txLen(): number;
    poll(): number;
}

export function gdbChecksum(payload: string): string {
    let sum = 0;
    for (let i = 0; i < payload.length; i++) sum = (sum + payload.charCodeAt(i)) & 0xff;
    return sum.toString(16).padStart(2, '0');
}

export function gdbPacketize(payload: string): Uint8Array {
    const s = `$${payload}#${gdbChecksum(payload)}`;
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
}

/** Parse a stop reply. Returns {addr, type} for T05watch/rwatch/awatch, else null. */
export function gdbParseStopReply(text: string): { addr: number; type: string } | null {
    const m = /T05((?:watch)|(?:rwatch)|(?:awatch)):([0-9a-fA-F]+)/.exec(text);
    if (!m) return null;
    return { type: m[1], addr: parseInt(m[2], 16) >>> 0 };
}

/** Little-endian u32 from 8 GDB hex chars (target is LE). */
export function gdbParseU32le(hex8: string): number {
    if (!hex8 || hex8.length < 8 || hex8.includes('x')) return NaN;
    const b0 = parseInt(hex8.slice(0, 2), 16);
    const b1 = parseInt(hex8.slice(2, 4), 16);
    const b2 = parseInt(hex8.slice(4, 6), 16);
    const b3 = parseInt(hex8.slice(6, 8), 16);
    if ([b0, b1, b2, b3].some((v) => !Number.isFinite(v))) return NaN;
    return ((b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0);
}

export interface DecodedStore {
    kind: 'strb-imm' | 'strh-imm' | 'str-imm' | 'unknown';
    rt: number;
    sizeBytes: number;
}

/**
 * Decode a Thumb store-immediate at the trapped PC. Handles the common
 * compiler shapes for MMIO writes (T1 STRB/STRH/STR immediate + T2/T3
 * 32-bit forms). Returns kind unknown when the halfword doesn't decode —
 * callers treat that as "skip byte, keep running", never fatal.
 */
export function gdbDecodeThumbStore(halfword: number, halfwordNext: number): DecodedStore {
    const h = halfword & 0xffff;
    // T1 STRB (immediate): 01110 Rn(3) Rt(3) imm5 → 0x7000..0x77FF
    if ((h & 0xf800) === 0x7000) {
        return { kind: 'strb-imm', rt: h & 0x7, sizeBytes: 1 };
    }
    // T1 STRH (immediate): 10000 Rn(3) Rt(3) imm5 → 0x8000..0x87FF
    if ((h & 0xf800) === 0x8000) {
        return { kind: 'strh-imm', rt: h & 0x7, sizeBytes: 2 };
    }
    // T1 STR (immediate, word): 01100 ... → 0x6000..0x67FF
    if ((h & 0xf800) === 0x6000) {
        return { kind: 'str-imm', rt: h & 0x7, sizeBytes: 4 };
    }
    // T2/T3 32-bit STRB/STRH/STR immediate: 11111 000 ... / 11111 001 ...
    if ((h & 0xfff0) === 0xf880 || (h & 0xfff0) === 0xf800 || (h & 0xfff0) === 0xf840) {
        // Second halfword: Rt in bits[15:12].
        const rt = (halfwordNext >>> 12) & 0xf;
        const sizeBytes = (h & 0xfff0) === 0xf880 ? 1 : ((h & 0xfff0) === 0xf800 ? 2 : 4);
        const kind = sizeBytes === 1 ? 'strb-imm' : (sizeBytes === 2 ? 'strh-imm' : 'str-imm');
        return { kind, rt, sizeBytes };
    }
    return { kind: 'unknown', rt: -1, sizeBytes: 0 };
}

const GDB_POLL_MAX_DRAIN = 64;

/** Drain all pending TX bytes from the stub into a string. */
export function gdbDrainTx(t: GdbTransport): string {
    let out = '';
    for (let i = 0; i < GDB_POLL_MAX_DRAIN; i++) {
        if (t.txLen() <= 0) break;
        const chunk = t.popTx(4096);
        for (let k = 0; k < chunk.length; k++) out += String.fromCharCode(chunk[k]);
    }
    return out;
}

export class PicoGdb {
    private seq = 0;
    constructor(private t: GdbTransport) {}

    /** Send one packet, run poll until a non-empty reply arrives or tries run out. */
    exchange(payload: string, tries = 40): string {
        try {
            this.t.pushRx(gdbPacketize(payload));
        } catch { return ''; }
        void this.seq++;
        let acc = '';
        for (let i = 0; i < tries; i++) {
            try { this.t.poll(); } catch { break; }
            acc += gdbDrainTx(this.t);
            // Replies are $...#CS or bare OK/E..; stop when a frame closes.
            if (/#[0-9a-fA-F]{2}/.test(acc) || acc === 'OK' || acc.startsWith('E')) return acc;
        }
        return acc;
    }

    setWriteWatchpoint(addr: number, len = 2): string {
        return this.exchange(`Z2,${(addr >>> 0).toString(16)},${len}`);
    }

    removeWatchpoint(kind: number, addr: number, len = 2): string {
        return this.exchange(`z${kind},${(addr >>> 0).toString(16)},${len}`);
    }

    resume(): string {
        return this.exchange('c', 4);
    }

    /** 'g' → array of 17 LE u32 (r0..r15, xpsr). NaN entries on short reads. */
    readRegs(): number[] {
        const resp = this.exchange('g');
        const m = /\$([0-9a-fA-Fx]+)#/.exec(resp);
        const hex = m ? m[1] : '';
        const out: number[] = [];
        for (let i = 0; i < 17; i++) {
            out.push(gdbParseU32le(hex.slice(i * 8, i * 8 + 8)));
        }
        return out;
    }

    /** 'm' read, returns raw bytes. */
    readMem(addr: number, len: number): number[] {
        const resp = this.exchange(`m${(addr >>> 0).toString(16)},${(len >>> 0).toString(16)}`);
        const m = /\$([0-9a-fA-F]+)#/.exec(resp);
        const hex = m ? m[1] : '';
        const out: number[] = [];
        for (let i = 0; i + 1 < hex.length; i += 2) {
            const v = parseInt(hex.slice(i, i + 2), 16);
            if (Number.isFinite(v)) out.push(v);
        }
        return out;
    }
}
