// mcp2518fd.ts — MCP2518FD SPI-to-CAN-FD controller (LOCAL model).
//
// Local class following the MicrobitBoardLogic precedent in
// registries/component-registry.ts: defined outside the emulator package,
// registered via LOGIC_REGISTRY + COMPONENT_PINS only. No package edits.
//
// Scope: SIMPLEST HONEST single-node proof — INTERNAL LOOPBACK mode. The
// controller echoes a transmitted frame into its own RX mailbox so firmware
// can write a frame via SPI and read it back byte-exact. Two-node bus
// arbitration, bit-timing (nominal + data phase), TEF/TXQ FIFO pointer RAM
// scheme, and CRC SPI commands are OUT OF SCOPE (documented limits below).
//
// Real MCP2518FD SPI framing implemented (datasheet §7):
//   - RESET:            bytes 0x00 0x00 (cmd nibble 0x0, addr 0x000)
//   - WRITE:            first byte 0x2N (cmd nibble 0x2 + addr[11:8]),
//                       second byte addr[7:0], then data bytes (auto-increment)
//   - READ:             first byte 0x3N, second byte addr[7:0], then the
//                       master clocks dummy bytes and captures MISO per byte
// Implemented register subset (byte-addressed, real addresses where cheap):
//   - 0x000 CiCON (32-bit, LE): byte0 REQOP[2:0] (write) / OPMOD[6:4] (status).
//     Modes: 0 = Normal, 2 = Internal loopback, 4 = Configuration (reset).
//     SIMPLIFICATION: OPMOD mirrors REQOP instantly; real silicon needs
//     oscillator/mode-settle time. Other CiCON bytes are plain storage.
//   - 0x01C CiINT (32-bit, LE): byte0 bit0 = RXIF. Set on loopback delivery;
//     cleared on RXLEN read (SIMPLIFICATION: real RXIF clears via FIFO STA).
//   - 0x400 TXLEN (byte, 0..64) + 0x401.. TX payload (SIMPLIFICATION: plain
//     length byte instead of the FD DLC table; real payload RAM lives behind
//     FIFO UA pointers at 0x400+ with UINC semantics).
//   - 0x480 RXLEN (byte; read clears RXIF + releases INT HIGH) + 0x481.. RX.
//   - 0x500 TXCON: bit0 TXREQ (write 1 = request-to-send). Auto-cleared on
//     delivery. Delivery requires OPMOD == 2 (internal loopback); TXREQ in
//     any other mode sets txBlocked and delivers nothing (honest gate: a
//     lone node cannot put a frame on a live bus).
// Pins: CS, MOSI, MISO, SCK, VCC, GND, INT (active-low, driven), TXCAN/RXCAN
// (present for netlist completeness; unconnected — no bus modeled).
import { SPIProtocol } from '@openhw/emulator';

// CiCON / CiINT addresses (real) and simplified mailbox addresses.
const REG_CICON = 0x000;
const REG_CIINT = 0x01c;
const REG_TXLEN = 0x400;
const REG_TXDATA = 0x401;
const REG_RXLEN = 0x480;
const REG_RXDATA = 0x481;
const REG_TXCON = 0x500;

const MAX_PAYLOAD = 64;

// OPMOD/REQOP mode values.
const MODE_NORMAL = 0;
const MODE_LOOPBACK = 2;
const MODE_CONFIG = 4;

const RESET_CICON = 0x00000044; // REQOP=4, OPMOD=4 (config), rest zero (simplified)

export class Mcp2518fdLogic extends SPIProtocol {
    private regs = new Map<number, number>();
    private cmdNibble = 0;
    private baseAddr = 0;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.doReset();
        this.state = {
            ...this.state,
            mode: MODE_CONFIG,
            txCount: 0,
            rxCount: 0,
            rxReady: false,
            txBlocked: false,
            lastTxLen: 0,
            lastTx: [] as number[],
            lastRx: [] as number[],
        };
        try { this.setPinVoltage('INT', 5.0); } catch { /* ignore */ }
    }

    getCSPinName(): string { return 'CS'; }

    // ── reset ──────────────────────────────────────────────────────────────
    private doReset(): void {
        this.regs.clear();
        this.regs.set(REG_CICON, RESET_CICON & 0xff);
        this.regs.set(REG_CICON + 1, (RESET_CICON >> 8) & 0xff);
        this.regs.set(REG_CICON + 2, (RESET_CICON >> 16) & 0xff);
        this.regs.set(REG_CICON + 3, (RESET_CICON >> 24) & 0xff);
        this.regs.set(REG_CIINT, 0x00);
        this.regs.set(REG_TXLEN, 0x00);
        this.regs.set(REG_RXLEN, 0x00);
        this.regs.set(REG_TXCON, 0x00);
        this.cmdNibble = 0;
        this.baseAddr = 0;
    }

    // ── SPI byte-exchange hook (streaming decode within a CS window) ───────
    override onCSAssert(): void {
        this.cmdNibble = 0;
        this.baseAddr = 0;
    }

    override onSPIByteExchange(byte: number, byteIndex: number): number {
        const b = byte & 0xff;
        if (byteIndex === 0) {
            this.cmdNibble = (b >> 4) & 0x0f;
            this.baseAddr = (b & 0x0f) << 8;
            return 0xff;
        }
        if (byteIndex === 1) {
            this.baseAddr |= b;
            if (this.cmdNibble === 0x0 && this.baseAddr === 0x000) {
                this.doReset();
                this.setState({
                    mode: MODE_CONFIG, rxReady: false, txBlocked: false,
                    lastTxLen: 0, lastTx: [], lastRx: [],
                });
                try { this.setPinVoltage('INT', 5.0); } catch { /* ignore */ }
            }
            return 0xff;
        }
        const addr = (this.baseAddr + (byteIndex - 2)) & 0xfff;
        if (this.cmdNibble === 0x2) {
            this.writeReg(addr, b);
            return 0xff;
        }
        if (this.cmdNibble === 0x3) {
            return this.readReg(addr);
        }
        return 0xff;
    }

    // ── register file with side effects ────────────────────────────────────
    private writeReg(addr: number, value: number): void {
        const v = value & 0xff;
        if (addr === REG_CICON) {
            // byte0: REQOP writable, OPMOD read-only mirror.
            const reqop = v & 0x07;
            const prev = this.regs.get(REG_CICON) ?? 0;
            const opmod = (prev >> 4) & 0x07;
            if (reqop === MODE_NORMAL || reqop === MODE_LOOPBACK || reqop === MODE_CONFIG) {
                const merged = (reqop & 0x07) | ((reqop & 0x07) << 4);
                this.regs.set(addr, merged);
                this.setState({ mode: reqop });
            } else {
                // Invalid REQOP ignored (real chip behavior); keep OPMOD.
                this.regs.set(addr, (prev & 0xf0) | (prev & 0x07));
            }
            void opmod;
            return;
        }
        if (addr === REG_CIINT) {
            // RXIF (bit0) is status-only; other bits are plain storage.
            const cur = this.regs.get(REG_CIINT) ?? 0;
            this.regs.set(addr, (v & 0xfe) | (cur & 0x01));
            return;
        }
        if (addr === REG_TXLEN) {
            this.regs.set(addr, Math.min(v, MAX_PAYLOAD));
            return;
        }
        if (addr === REG_TXCON) {
            const cur = this.regs.get(REG_TXCON) ?? 0;
            this.regs.set(addr, (cur & 0xfe) | (v & 0x01));
            if (v & 0x01) this.requestToSend();
            return;
        }
        this.regs.set(addr, v);
    }

    private readReg(addr: number): number {
        if (addr === REG_RXLEN) {
            const len = this.regs.get(REG_RXLEN) ?? 0;
            // Simplified RXIF clear-on-RXLEN-read (real chip: FIFO STA UINC).
            this.regs.set(REG_CIINT, (this.regs.get(REG_CIINT) ?? 0) & 0xfe);
            this.setState({ rxReady: false });
            try { this.setPinVoltage('INT', 5.0); } catch { /* ignore */ }
            return len & 0xff;
        }
        return this.regs.get(addr) ?? 0x00;
    }

    // ── request-to-send: internal-loopback delivery ────────────────────────
    private requestToSend(): void {
        const opmod = ((this.regs.get(REG_CICON) ?? 0) >> 4) & 0x07;
        if (opmod !== MODE_LOOPBACK) {
            // Honest gate: no loopback path, no delivery. Frame is dropped,
            // TXREQ stays visible until the next write (diagnosable).
            this.setState({ txBlocked: true });
            return;
        }
        const len = Math.min(this.regs.get(REG_TXLEN) ?? 0, MAX_PAYLOAD);
        const tx: number[] = [];
        for (let i = 0; i < len; i++) tx.push(this.regs.get(REG_TXDATA + i) ?? 0x00);
        this.regs.set(REG_RXLEN, len);
        for (let i = 0; i < len; i++) this.regs.set(REG_RXDATA + i, tx[i]);
        this.regs.set(REG_TXCON, 0x00); // TXREQ auto-clear on delivery
        this.regs.set(REG_CIINT, ((this.regs.get(REG_CIINT) ?? 0) | 0x01));
        this.setState({
            txBlocked: false,
            txCount: (Number((this.state as any)?.txCount) || 0) + 1,
            rxCount: (Number((this.state as any)?.rxCount) || 0) + 1,
            rxReady: true,
            lastTxLen: len,
            lastTx: [...tx],
            lastRx: [...tx],
        });
        try { this.setPinVoltage('INT', 0.0); } catch { /* ignore */ }
    }

    override onCustomTelemetry(): void {
        this.setCustomTelemetry({
            mode: Number((this.state as any)?.mode ?? MODE_CONFIG),
            txCount: Number((this.state as any)?.txCount ?? 0),
            rxCount: Number((this.state as any)?.rxCount ?? 0),
            rxReady: !!((this.state as any)?.rxReady),
            txBlocked: !!((this.state as any)?.txBlocked),
            lastTxLen: Number((this.state as any)?.lastTxLen ?? 0),
        });
    }

    validate(_component: any, _graph: Map<string, string[]>): null {
        return null;
    }
}
