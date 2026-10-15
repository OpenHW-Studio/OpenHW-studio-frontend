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

export interface SPIBridge {
    /** Feed one MOSI byte; returns the MISO response byte. */
    exchange(byte: number, byteIndex: number): number;
    /** Frame boundary for protocol-lane recording (call on CS edges). */
    frame(complete: boolean): void;
}

/** Create an SPI slave-side bridge (AVR onByte semantics, no clock-delay). */
export function createSPIBridge(ctx: BridgeCtx): SPIBridge {
    let frameBytes: number[] = [];
    let frameStartMs = 0;
    let byteIndex = 0;
    return {
        exchange(byte: number, idx: number): number {
            const v = byte & 0xff;
            frameBytes.push(v);
            if (frameBytes.length === 1) {
                try { frameStartMs = ctx.getSimTimeMs(); } catch { frameStartMs = 0; }
            }
            let ret = 0xff;
            try {
                for (const inst of ctx.instances.values()) {
                    const hasByte = typeof inst?.onSPIByte === 'function';
                    const hasXchg = typeof inst?.onSPIByteExchange === 'function';
                    if (!hasByte && !hasXchg) continue;
                    let selected = false;
                    try { selected = isSPISelected(inst); } catch { selected = true; }
                    if (!selected) continue;
                    try {
                        if (hasXchg) {
                            const r = inst.onSPIByteExchange(v, idx);
                            if (r !== undefined) ret = Number(r) & 0xff;
                        } else {
                            const r = inst.onSPIByte(v);
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
            frameBytes = [];
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
