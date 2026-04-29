import { BaseComponent } from '../BaseComponent';

/**
 * 74HC595 8-bit Shift Register
 *
 * Pin mapping (matches manifest.json):
 *   ser    – Serial data input  (DS)         – sampled on SRCLK rising edge
 *   srclk  – Shift register clock (SHCP)     – rising edge shifts data in
 *   rclk   – Storage register clock (STCP)   – rising edge latches shift → output
 *   oe     – Output enable  (active LOW)      – LOW enables q0-q7 outputs
 *   srclr  – Shift register clear (active LOW)– LOW asynch-clears the shift reg
 *   q0-q7  – 8-bit parallel outputs
 *   q7s    – Serial output (Q7′)             – for daisy-chaining
 *
 * Supports two drive modes:
 *   1. Bit-bang   – Arduino drives SER/SRCLK/RCLK directly (pin state changes)
 *   2. Hw SPI     – AVRSPI peripheral triggers onSPIByte(); RCLK still required
 */
export class ShiftRegisterLogic extends BaseComponent {
    private srclkLast = false;
    private rclkLast  = false;
    private oeLast    = false; // tracks OE pin state (active LOW)

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {
            shiftReg:    0,   // 8-bit internal shift register
            storageReg:  0,   // 8-bit storage (latch) register
            outputs:     0,   // current driven output byte (0 when OE=HIGH)
        };
    }

    // ────────────────────────────────────────────────────────────
    //  BIT-BANG mode: called whenever a connected Arduino pin changes
    // ────────────────────────────────────────────────────────────
    onPinStateChange(pinId: string, isHigh: boolean, _cpuCycles: number): void {
        const pin = pinId.toLowerCase();

        switch (pin) {
            // ── SRCLR (active LOW) ──────────────────────────────
            case 'srclr':
                if (!isHigh) {
                    // Async clear of shift register
                    this.state.shiftReg = 0;
                    this.setPinVoltage('q7s', 0);
                    this.stateChanged = true;
                }
                break;

            // ── OE (active LOW) ─────────────────────────────────
            case 'oe':
                if (this.oeLast !== isHigh) {
                    this.oeLast = isHigh;
                    this.updateOutputPins();
                }
                break;

            // ── SRCLK (shift clock) ─────────────────────────────
            // Rising edge: shift data in from SER; MSB shifted out to q7s
            case 'srclk': {
                const rising = isHigh && !this.srclkLast;
                this.srclkLast = isHigh;
                if (rising) {
                    const serBit = this.getPinVoltage('ser') > 0.5 ? 1 : 0;
                    const q7out  = (this.state.shiftReg >> 7) & 0x01; // MSB shifted out
                    this.state.shiftReg = ((this.state.shiftReg << 1) | serBit) & 0xFF;
                    // q7s mirrors the bit that just fell off the top of the shift register
                    this.setPinVoltage('q7s', q7out ? 5.0 : 0.0);
                    this.stateChanged = true;
                }
                break;
            }

            // ── RCLK (latch clock) ──────────────────────────────
            // Rising edge: copy shift register to storage register; update outputs
            case 'rclk': {
                const rising = isHigh && !this.rclkLast;
                this.rclkLast = isHigh;
                if (rising) {
                    this.state.storageReg = this.state.shiftReg;
                    this.updateOutputPins();
                }
                break;
            }
        }
    }

    // ────────────────────────────────────────────────────────────
    //  HARDWARE SPI mode: AVRSPI peripheral fires this per byte
    //  The entire 8-bit shift is done atomically; RCLK still latches.
    // ────────────────────────────────────────────────────────────
    onSPIByte(data: number): number {
        // Capture current MSB of shift register → that is the serial-out (q7s)
        // for this transaction (bits shifted out while new bits came in).
        const q7sByte = this.state.shiftReg & 0xFF;

        // Load the new byte; SPI sends MSB first, which maps directly to a
        // bit-bang sequence of 8 clocks → result is the same byte value.
        this.state.shiftReg = data & 0xFF;
        this.setPinVoltage('q7s', (q7sByte >> 7) & 0x01 ? 5.0 : 0.0);
        this.stateChanged = true;

        // Return byte read from MISO (Q7′ chain output).
        // For a single chip this is the old shift-register MSB byte;
        // for daisy-chained chips the full old byte propagates.
        return q7sByte;
    }

    // ────────────────────────────────────────────────────────────
    //  HELPERS
    // ────────────────────────────────────────────────────────────

    /** Reflect the storage register onto the q0-q7 output pins, gated by OE. */
    private updateOutputPins(): void {
        // OE is active LOW: outputs enabled when OE pin is LOW (voltage < 0.5 V)
        const oeEnabled = this.getPinVoltage('oe') < 0.5;
        const sr = oeEnabled ? this.state.storageReg : 0;
        this.state.outputs = sr;

        for (let i = 0; i < 8; i++) {
            this.setPinVoltage(`q${i}`, (sr >> i) & 0x01 ? 5.0 : 0.0);
        }
        this.stateChanged = true;
    }

    getSyncState() {
        return { ...this.state };
    }
}
