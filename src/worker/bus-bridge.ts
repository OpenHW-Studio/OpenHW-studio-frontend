/**
 * bus-bridge.ts — shared I2C/SPI peripheral bridges for ARM runners.
 *
 * Mirrors AVRRunner's TWIAdapter/SPI hooks with identical model-side
 * semantics (first-ACK-wins I2C routing, addressed-only bytes, active-low
 * CS gating, protocol-lane posts) so components behave the same no matter
 * which runner owns them. No per-component or per-board code: addresses
 * come from the instances themselves (generic accessor chain), CS from pin
 * voltages, bus selection from SCK-pin tables.
 *
 * Engine-specific parts (callbacks, injection) stay in each runner; this
 * module is pure routing + framing and fully headless-testable.
 */

export interface BridgeCtx {
    boardId: string;
    onStateUpdate: (msg: any) => void;
    getSimTimeMs: () => number;
    instances: Map<string, any>;
    compAttrById?: Map<string, any>;
    /** Net map pin→net for board-level CS resolution (fresher than model pins). */
    pinToNet?: Map<string, number>;
    /** Board pin level override (runner pinStates mirror). Null = unknown. */
    boardPinLevel?: (pin: string) => boolean | null;
}

/** Generic I2C slave addresses owned by a board (instance first, attrs fallback). */
export function collectI2CSlaveAddresses(ctx: Pick<BridgeCtx, 'instances' | 'compAttrById'>): number[] {
    const out = new Set<number>();
    try {
        for (const inst of ctx.instances.values()) {
            if (typeof inst?.onI2CStart !== 'function') continue;
            const id = String(inst?.id || '');
            const attrs = ctx.compAttrById?.get(id) || {};
            const cands = [
                inst?.i2cAddr,
                typeof inst?.getI2CAddress === 'function' ? inst.getI2CAddress() : NaN,
                attrs?.address, attrs?.i2cAddress, attrs?.addr,
            ];
            for (const c of cands) {
                const v = Number(c);
                if (Number.isFinite(v)) { out.add(v & 0x7f); break; }
            }
        }
    } catch { /* scan never breaks the caller */ }
    return [...out];
}

export interface I2CBridge {
    start(addr: number, read: boolean): void;
    write(byte: number): void;
    read(): number;
    stop(): void;
}

/** Create an I2C slave-side bridge (AVR-TWIAdapter semantics). */
export function createI2CBridge(ctx: BridgeCtx): I2CBridge {
    let activeAddr: number | null = null;
    let activeSlave: any = null;
    let buf: number[] = [];

    const findClaim = (addr: number): any => {
        let claimed: any = null;
        try {
            for (const inst of ctx.instances.values()) {
                if (typeof inst?.onI2CStart !== 'function') continue;
                let ack = false;
                try { ack = !!inst.onI2CStart(addr, false); } catch { ack = false; }
                if (ack && !claimed) claimed = inst;
            }
        } catch { /* start never breaks the bus */ }
        return claimed;
    };

    return {
        start(addr: number, _read: boolean): void {
            activeAddr = addr & 0x7f;
            buf = [];
            activeSlave = findClaim(activeAddr);
            void _read;
        },
        write(byte: number): void {
            buf.push(byte & 0xff);
            try {
                // Addressed-slave-only (no broadcast corruption); general
                // call (no claim) fans out like AVR's fallback.
                const targets = activeSlave ? [activeSlave] : Array.from(ctx.instances.values());
                for (const inst of targets) {
                    if (typeof inst?.onI2CByte !== 'function') continue;
                    try { inst.onI2CByte(-1, byte & 0xff); } catch { /* ignore */ }
                }
            } catch { /* byte never breaks the bus */ }
        },
        read(): number {
            try {
                if (activeSlave && typeof activeSlave.onI2CReadByte === 'function') {
                    return activeSlave.onI2CReadByte() & 0xff;
                }
                if (activeSlave && typeof activeSlave.readByte === 'function') {
                    return activeSlave.readByte() & 0xff;
                }
            } catch { /* read faults return idle */ }
            return 0xff;
        },
        stop(): void {
            try {
                for (const inst of ctx.instances.values()) {
                    try { if (typeof inst?.onI2CStop === 'function') inst.onI2CStop(); } catch { /* ignore */ }
                }
                if (activeAddr !== null && buf.length > 0) {
                    try {
                        ctx.onStateUpdate({
                            type: 'protocol:i2c',
                            boardId: ctx.boardId,
                            address: activeAddr,
                            data: [...buf],
                            isWrite: true,
                            timestamp: ctx.getSimTimeMs(),
                        });
                    } catch { /* protocol lane never breaks the bus */ }
                }
            } catch { /* stop never breaks the bus */ }
            activeAddr = null;
            activeSlave = null;
            buf = [];
        },
    };
}

const SPI_CS_NAMES = ['cs', 'ss', 'ssel', 'nss', 'csn', 'cs_n', 'nce', 'sda'];

/** CS-gated selection mirroring AVRRunner.isSPISelected (active-low; CE fallback; none → always). */
export function isSPISelected(inst: any): boolean {
    try {
        const pins = inst?.pins || {};
        for (const name of SPI_CS_NAMES) {
            if (pins[name]) return Number(inst.getPinVoltage(name)) < 0.5;
            if (pins[name.toUpperCase()]) return Number(inst.getPinVoltage(name.toUpperCase())) < 0.5;
        }
        if (pins['ce'] || pins['CE']) {
            const v = pins['ce'] ? inst.getPinVoltage('ce') : inst.getPinVoltage('CE');
            return Number(v) < 0.5;
        }
        return true;
    } catch {
        return true;
    }
}

/**
 * Board-level CS resolution: find the board pin sharing the component's CS
 * net and read the RUNNER's pin level (fresher than model pins when output
 * propagation lags — observed: F1 model CS stuck HIGH while PA4 drove LOW).
 * Returns true/false, or null when unresolvable (caller falls back).
 */
export function boardCsSelected(ctx: BridgeCtx, inst: any): boolean | null {
    try {
        const pins = inst?.pins || {};
        const netOf = ctx.pinToNet;
        if (!netOf || typeof ctx.boardPinLevel !== 'function') return null;
        for (const name of SPI_CS_NAMES) {
            const key = pins[name] ? name : (pins[name.toUpperCase()] ? name.toUpperCase() : null);
            if (!key) continue;
            const compPin = `${inst?.id}:${key}`;
            const net = netOf.get(compPin);
            if (net === undefined) continue;
            for (const [node, netId] of netOf) {
                if (netId !== net) continue;
                const sep = node.indexOf(':');
                if (sep < 0) continue;
                if (node.slice(0, sep) !== ctx.boardId) continue;
                const lvl = ctx.boardPinLevel(node.slice(sep + 1));
                if (lvl === null || lvl === undefined) continue;
                return lvl === false;
            }
            return null;
        }
        if (pins['ce'] || pins['CE']) {
            const key = pins['ce'] ? 'ce' : 'CE';
            const net = netOf.get(`${inst?.id}:${key}`);
            if (net === undefined) return null;
            for (const [node, netId] of netOf) {
                if (netId !== net) continue;
                const sep = node.indexOf(':');
                if (sep < 0) continue;
                if (node.slice(0, sep) !== ctx.boardId) continue;
                const lvl = ctx.boardPinLevel(node.slice(sep + 1));
                if (lvl === null || lvl === undefined) continue;
                return lvl === false;
            }
            return null;
        }
        return true;
    } catch {
        return null;
    }
}

export interface SPIBridge {
    /** Feed one MOSI byte; returns the MISO response byte. */
    exchange(byte: number, byteIndex: number): number;
    /** Frame boundary for protocol-lane recording (call on CS edges). */
    frame(complete: boolean): void;
    /** Per-tick idle flush for setup-only traffic / missing CS edges. */
    idleFlush(nowMs: number): void;
}

/** Create an SPI slave-side bridge (AVR onByte semantics, no clock-delay). */
export function createSPIBridge(ctx: BridgeCtx): SPIBridge {
    let frameBytes: number[] = [];
    let frameStartMs = 0;
    let byteIndex = 0;
    const spiInstances = (): any[] => {
        const out: any[] = [];
        try {
            for (const inst of ctx.instances.values()) {
                if (typeof inst?.onSPIByte === 'function'
                    || typeof inst?.onSPIByteExchange === 'function') out.push(inst);
            }
        } catch { /* ignore */ }
        return out;
    };
    // Synthesized close for single-slave runs: deliver CS deassert to the
    // model when its frame is non-empty and still open, then drain the
    // model frame so a late real HIGH re-close processes an empty frame
    // (lastFrame preserved) instead of double-applying. Multi-slave keeps
    // model CS authoritative — never synthesized.
    const synthClose = (): void => {
        try {
            const slaves = spiInstances();
            if (slaves.length !== 1) return;
            const inst = slaves[0];
            if (!inst || typeof (inst as any)?.onPinStateChange !== 'function') return;
            if (!(inst as any)?.csActive) return;
            if ((inst as any)?.csActivelow === false) return; // active-high: HIGH asserts
            let pending = 0;
            try {
                const cf = (inst as any)?.currentFrame;
                pending = Array.isArray(cf) ? cf.length : 0;
            } catch { pending = 0; }
            if (pending <= 0) return;
            let pin = 'CS';
            try {
                if (typeof (inst as any)?.getCSPinName === 'function') {
                    pin = String((inst as any).getCSPinName()) || 'CS';
                }
            } catch { /* default pin */ }
            try { (inst as any).onPinStateChange(pin, true, 0); } catch { /* ignore */ }
            // Drain: bridge owns the lifecycle in single-slave mode.
            // (TS-private _frame is runtime-accessible; no component
            // files touched.)
            try { if (Array.isArray((inst as any)?._frame)) (inst as any)._frame.length = 0; } catch { /* ignore */ }
        } catch { /* synth never breaks the bus */ }
    };
    return {
        exchange(byte: number, idx: number): number {
            const v = byte & 0xff;
            frameBytes.push(v);
            if (frameBytes.length === 1) {
                try { frameStartMs = ctx.getSimTimeMs(); } catch { frameStartMs = 0; }
            }
            let ret = 0xff;
            try {
                const slaves = spiInstances();
                for (const inst of slaves) {
                    const hasByte = typeof inst?.onSPIByte === 'function';
                    const hasXchg = typeof inst?.onSPIByteExchange === 'function';
                    if (!hasByte && !hasXchg) continue;
                    // Single slave owns the bus: route everything (CS level
                    // sampling races transfer events in tick-drained cores —
                    // stale HIGH would wrongly deselect; with one device the
                    // bus has nowhere else to go). Multi-slave keeps CS
                    // gating (best-effort).
                    let selected = slaves.length === 1;
                    if (!selected) {
                        // Board-level CS first (runner pin mirror — fresh),
                        // model pins as fallback (may lag output propagation).
                        let lvl: boolean | null = null;
                        try { lvl = boardCsSelected(ctx, inst); } catch { lvl = null; }
                        if (lvl === null) {
                            try { lvl = isSPISelected(inst); } catch { lvl = true; }
                        }
                        selected = !!lvl;
                    }
                    if (!selected) continue;
                    // Single-slave frame lifecycle (bridge-owned): GPIO
                    // change events dispatch AFTER execute() while transfers
                    // fire during it, so real assert/deassert order at the
                    // model is unreliable (observed: late assert wiping a
                    // full frame every time). Implicit assert on first byte
                    // of an idle window; gap-close in frame() below.
                    // Multi-slave keeps model CS authoritative (untouched).
                    // NOTE: drive onPinStateChange (not onCSAssert — the base
                    // hook is a no-op that never sets csActive, so the
                    // synth-close below would skip forever).
                    if (slaves.length === 1) {
                        try {
                            if (!(inst as any)?.csActive && typeof (inst as any)?.onPinStateChange === 'function') {
                                let pin = 'CS';
                                try {
                                    if (typeof (inst as any)?.getCSPinName === 'function') {
                                        pin = String((inst as any).getCSPinName()) || 'CS';
                                    }
                                } catch { /* default pin */ }
                                const lowActive = (inst as any)?.csActivelow !== false;
                                (inst as any).onPinStateChange(pin, !lowActive, 0);
                            }
                        } catch { /* assert never breaks the bus */ }
                    }
                    try {
                        // Prefer onSPIByte: SPIProtocol's accumulator (frame
                        // + spiRxBytes + internal exchange dispatch). Direct
                        // onSPIByteExchange bypasses accumulation and starves
                        // write-only devices (observed: MAX7219 lastFrame []
                        // with 10 transfers flowing). Full-duplex overrides
                        // still run — onSPIByte dispatches to them.
                        if (hasByte) {
                            const r = (inst as any).onSPIByte(v);
                            if (r !== undefined) ret = Number(r) & 0xff;
                        } else if (hasXchg) {
                            const r = inst.onSPIByteExchange(v, idx);
                            if (r !== undefined) ret = Number(r) & 0xff;
                        }
                    } catch { /* one bad model never breaks the bus */ }
                }
            } catch { /* exchange never breaks the bus */ }
            byteIndex = idx + 1;
            void byteIndex;
            return ret;
        },
        frame(complete: boolean): void {
            try {
                if (complete && frameBytes.length > 0) {
                    ctx.onStateUpdate({
                        type: 'protocol:spi',
                        boardId: ctx.boardId,
                        data: [...frameBytes],
                        timestamp: frameStartMs,
                    });
                }
            } catch { /* protocol lane never breaks the bus */ }
            if (complete) synthClose();
            frameBytes = [];
        },
        /** Per-tick idle flush (runner calls from drainUartOut): closes a
         * frame whose last byte is older than the 2ms sim gap even when no
         * later transfer arrives (setup-only traffic) or the real CS edge
         * never dispatches (observed: final HIGH missing, model stuck
         * active). Same lifecycle as frame(true). */
        idleFlush(nowMs: number): void {
            try {
                if (frameBytes.length > 0 && (nowMs - frameStartMs) > 2.0) {
                    let lane: number[] = [];
                    try { lane = [...frameBytes]; } catch { lane = []; }
                    if (lane.length > 0) {
                        try {
                            ctx.onStateUpdate({
                                type: 'protocol:spi',
                                boardId: ctx.boardId,
                                data: lane,
                                timestamp: frameStartMs,
                            });
                        } catch { /* lane never breaks flush */ }
                    }
                    synthClose();
                    frameBytes = [];
                }
            } catch { /* flush never breaks the tick */ }
        },
    };
}

/** SCK board-pin → SPI bus index per board family (for engine callback routing). */
const SPI_SCK_BUS: Array<{ match: RegExp; pins: Record<string, number> }> = [
    // STM32F1/F4: SPI1 = PA5/6/7 (SCK PA5), SPI2 = PB13/14/15 (SCK PB13).
    { match: /stm32/i, pins: { PA5: 1, PB13: 2, PB3: 3 } },
    // ESP32: VSPI/HSPI — SCK 18 (VSPI) / 14 (HSPI); bus index by core id.
    { match: /esp32/i, pins: { D18: 1, D14: 2, GPIO18: 1, GPIO14: 2 } },
    // RP2040: SPI0 SCK GP18/GP2/GP6…; SPI1 SCK GP10/GP14. Default bus 0/1.
    { match: /pico|rp2040|rp2350/i, pins: { GP18: 0, GP6: 0, GP2: 0, GP10: 1, GP14: 1 } },
];

/** Resolve an SPI bus index from the wired SCK board pin (default 1/0). */
export function spiBusForSck(boardType: string, sckPin: string): number {
    try {
        const t = String(boardType || '');
        const p = String(sckPin || '').trim();
        for (const row of SPI_SCK_BUS) {
            if (!row.match.test(t)) continue;
            if (p in row.pins) return row.pins[p];
            const up = p.toUpperCase();
            for (const [k, v] of Object.entries(row.pins)) {
                if (k.toUpperCase() === up) return v;
            }
        }
    } catch { /* fall through to default */ }
    return /stm32|esp32/i.test(String(boardType || '')) ? 1 : 0;
}
