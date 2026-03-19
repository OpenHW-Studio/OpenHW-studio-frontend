import { BaseComponent } from '../BaseComponent';

// ─── MAX30102 Register Map ───────────────────────────────────────────
const REG_INT_STATUS1   = 0x00;
const REG_INT_STATUS2   = 0x01;
const REG_INT_ENABLE1   = 0x02;
const REG_INT_ENABLE2   = 0x03;
const REG_FIFO_WR_PTR   = 0x04;
const REG_FIFO_OVF      = 0x05;
const REG_FIFO_RD_PTR   = 0x06;
const REG_FIFO_DATA     = 0x07;
const REG_FIFO_CONFIG   = 0x08;
const REG_MODE_CONFIG   = 0x09;
const REG_SPO2_CONFIG   = 0x0A;
const REG_LED1_PA       = 0x0C; // RED LED pulse amplitude
const REG_LED2_PA       = 0x0D; // IR  LED pulse amplitude
const REG_MULTI_LED_1   = 0x11;
const REG_MULTI_LED_2   = 0x12;
const REG_TEMP_INT      = 0x1F;
const REG_TEMP_FRAC     = 0x20;
const REG_TEMP_CONFIG   = 0x21;
const REG_PROX_INT_TH   = 0x30;
const REG_REV_ID        = 0xFE;
const REG_PART_ID       = 0xFF;

const I2C_ADDR          = 0x57;
const PART_ID           = 0x15;
const REV_ID            = 0x03;
const FIFO_DEPTH        = 32;
const CYCLES_PER_HZ     = 16_000_000;

// ─── PPG Pulse Shape ──────────────────────────────────────────────────
// Returns a value in [0, 1] for a normalized phase t ∈ [0, 1):
// - Systolic rise (0-20%), systolic peak, dicrotic notch (30-50%), diastolic decay
function ppgPulseShape(t: number): number {
    if (t < 0.18) {
        // Rapid systolic rise
        return 0.5 * (1 - Math.cos(Math.PI * t / 0.18));
    } else if (t < 0.28) {
        // Fall from systolic peak to dicrotic notch
        const p = (t - 0.18) / 0.10;
        return 0.7 + 0.3 * Math.cos(Math.PI * p);
    } else if (t < 0.42) {
        // Dicrotic wave
        const p = (t - 0.28) / 0.14;
        return 0.7 - 0.25 * Math.sin(Math.PI * p);
    } else {
        // Slow diastolic decay back to baseline
        const p = (t - 0.42) / 0.58;
        return 0.45 * Math.exp(-3.5 * p);
    }
}

interface FifoEntry { red: number; ir: number; }

export class MAX30102Logic extends BaseComponent {
    // ── I2C state machine ──────────────────
    private i2cAddr        = 0;
    private i2cReadMode    = false;
    private i2cRegPtr      = -1;      // -1 = not yet set
    private i2cWritePhase  = 0;       // 0 = address byte, 1+ = data bytes

    // ── Register shadow ────────────────────
    private regs: Uint8Array = new Uint8Array(256);

    // ── FIFO ───────────────────────────────
    private fifo: FifoEntry[]  = Array.from({ length: FIFO_DEPTH }, () => ({ red: 0, ir: 0 }));
    private fifoReadByteIdx    = 0;   // 0-5 within a single 6-byte SpO2 sample

    // ── LED amplitudes (0-255) ─────────────
    private redAmp  = 0;   // from REG_LED1_PA
    private irAmp   = 0;   // from REG_LED2_PA

    // ── PPG simulation ────────────────────
    private ppgPhase         = 0;           // 0.0 – 1.0 heart-beat cycle
    private heartRateHz      = 1.20;        // 72 BPM
    private lastSampleCycles = 0;
    private sampleRateHz     = 100;         // 100 SPS default
    private motionNoise      = 0;           // brief noise on LED change
    private noiseDecay       = 0;

    // ── UI-visible state ──────────────────
    // state.redLedOn    → glowing SVG LED
    // state.redAmp      → slider value 0-255
    // state.irAmp       → slider value 0-255
    // state.heartRate   → BPM string shown in context menu
    // state.spo2        → SpO2 % string

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.regs[REG_PART_ID]    = PART_ID;
        this.regs[REG_REV_ID]     = REV_ID;
        this.regs[REG_MODE_CONFIG] = 0x00;
        this.regs[REG_FIFO_CONFIG] = 0x0F; // 4-sample average, FIFO almost-full at 17
        this.regs[REG_SPO2_CONFIG] = 0x27; // 4096 range, 100SPS, 411µs pulse

        // Pull initial attr values if restored from a save
        const savedRed = parseInt(manifest.attrs?.redLed?.default ?? '0', 10);
        const savedIr  = parseInt(manifest.attrs?.irLed?.default  ?? '0', 10);
        this.redAmp = isNaN(savedRed) ? 0 : Math.min(255, Math.max(0, savedRed));
        this.irAmp  = isNaN(savedIr)  ? 0 : Math.min(255, Math.max(0, savedIr));
        this.regs[REG_LED1_PA] = this.redAmp;
        this.regs[REG_LED2_PA] = this.irAmp;

        this.state = {
            redLedOn:  false,
            irLedOn:   false,
            redAmp:    this.redAmp,
            irAmp:     this.irAmp,
            heartRate: '72',
            spo2:      '--',
        };
    }

    // ─────────────────────────────────────────────────────────────────
    //  I2C PROTOCOL
    // ─────────────────────────────────────────────────────────────────

    onI2CStart(addr: number, read: boolean): boolean {
        if (addr !== I2C_ADDR) return false;
        this.i2cAddr       = addr;
        this.i2cReadMode   = read;
        this.i2cWritePhase = 0;
        if (read && this.i2cRegPtr < 0) this.i2cRegPtr = 0; // default to 0 on bare read
        return true; // ACK
    }

    onI2CByte(addr: number, data: number): boolean {
        if (this.i2cReadMode) {
            // This call path is used by some simulator builds where
            // the master read is fed back through onI2CByte.
            // We just ACK and let readByte() / onI2CReadByte() supply data.
            return true;
        }
        // ─── Write transaction ─────────────────────────────────────
        if (this.i2cWritePhase === 0) {
            // First byte = register address pointer
            this.i2cRegPtr = data & 0xFF;
            this.i2cWritePhase = 1;
        } else {
            this.writeReg(this.i2cRegPtr, data & 0xFF);
            this.i2cRegPtr = (this.i2cRegPtr + 1) & 0xFF; // auto-increment
        }
        return true;
    }

    /** Called by simulator framework when master clocks out a read byte. */
    onI2CReadByte(): number {
        return this.readReg();
    }

    /** Alias – some simulator builds use this name */
    readByte(): number {
        return this.readReg();
    }

    onI2CStop(): void {
        this.i2cWritePhase = 0;
    }

    // ─────────────────────────────────────────────────────────────────
    //  REGISTER READ / WRITE
    // ─────────────────────────────────────────────────────────────────

    private readReg(): number {
        const reg = this.i2cRegPtr & 0xFF;
        let value: number;

        if (reg === REG_FIFO_DATA) {
            value = this.readFifoByte();
            // Do NOT auto-increment here; pointer managed by readFifoByte
        } else {
            value = this.regs[reg];
            this.i2cRegPtr = (this.i2cRegPtr + 1) & 0xFF; // auto-inc for non-FIFO
        }
        return value;
    }

    private writeReg(reg: number, val: number): void {
        switch (reg) {
            case REG_MODE_CONFIG:
                if (val & 0x40) { this.resetDevice(); return; }   // RESET bit
                this.regs[reg] = val & ~0x40;
                this.updateSampleRate();
                this.applyLEDState();
                break;

            case REG_SPO2_CONFIG:
                this.regs[reg] = val;
                this.updateSampleRate();
                break;

            case REG_LED1_PA:
                this.redAmp = val;
                this.regs[reg] = val;
                this.applyLEDState();
                this.triggerMotionNoise();
                break;

            case REG_LED2_PA:
                this.irAmp = val;
                this.regs[reg] = val;
                this.applyLEDState();
                this.triggerMotionNoise();
                break;

            case REG_FIFO_WR_PTR:
                this.regs[reg] = val & 0x1F;
                break;

            case REG_FIFO_RD_PTR:
                this.regs[reg] = val & 0x1F;
                this.fifoReadByteIdx = 0;
                break;

            case REG_FIFO_OVF:
                this.regs[reg] = val & 0x1F;
                break;

            case REG_FIFO_CONFIG:
                this.regs[reg] = val;
                break;

            case REG_INT_ENABLE1:
            case REG_INT_ENABLE2:
            case REG_MULTI_LED_1:
            case REG_MULTI_LED_2:
            case REG_TEMP_CONFIG:
            case REG_PROX_INT_TH:
                this.regs[reg] = val;
                break;

            // Read-only registers – silently ignore writes
            case REG_INT_STATUS1:
            case REG_INT_STATUS2:
            case REG_PART_ID:
            case REG_REV_ID:
                break;

            default:
                this.regs[reg] = val;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  FIFO READ
    // ─────────────────────────────────────────────────────────────────

    private readFifoByte(): number {
        const rdPtr = this.regs[REG_FIFO_RD_PTR] & 0x1F;
        const wrPtr = this.regs[REG_FIFO_WR_PTR] & 0x1F;
        if (rdPtr === wrPtr) return 0; // FIFO empty

        const entry = this.fifo[rdPtr];
        const mode  = this.regs[REG_MODE_CONFIG] & 0x07;
        const bytesPerSample = (mode === 0x02) ? 3 : 6; // HR=3, SpO2=6

        let byte = 0;
        switch (this.fifoReadByteIdx % bytesPerSample) {
            case 0: byte = (entry.red >> 16) & 0x03; break;
            case 1: byte = (entry.red >>  8) & 0xFF; break;
            case 2: byte =  entry.red        & 0xFF; break;
            case 3: byte = (entry.ir  >> 16) & 0x03; break;
            case 4: byte = (entry.ir  >>  8) & 0xFF; break;
            case 5: byte =  entry.ir         & 0xFF; break;
        }

        this.fifoReadByteIdx++;
        if (this.fifoReadByteIdx >= bytesPerSample) {
            this.fifoReadByteIdx = 0;
            this.regs[REG_FIFO_RD_PTR] = (rdPtr + 1) & 0x1F;
        }
        return byte;
    }

    private pushFifo(red: number, ir: number): void {
        const wrPtr   = this.regs[REG_FIFO_WR_PTR] & 0x1F;
        const rdPtr   = this.regs[REG_FIFO_RD_PTR] & 0x1F;
        const newWr   = (wrPtr + 1) & 0x1F;

        if (newWr === rdPtr) {
            // FIFO full: overflow
            const ovf = (this.regs[REG_FIFO_OVF] + 1) & 0x1F;
            this.regs[REG_FIFO_OVF] = ovf;
            this.regs[REG_INT_STATUS1] |= 0x20; // A_FULL flag
            return;
        }

        this.fifo[wrPtr] = { red: red & 0x3FFFF, ir: ir & 0x3FFFF };
        this.regs[REG_FIFO_WR_PTR] = newWr;

        // Set PPG_RDY interrupt flag
        this.regs[REG_INT_STATUS1] |= 0x40;

        // Almost-full interrupt (when there are only FIFO_A_FULL empty slots left)
        const fifoAFull = this.regs[REG_FIFO_CONFIG] & 0x0F;
        const fifoCount = (newWr - rdPtr + FIFO_DEPTH) % FIFO_DEPTH;
        if (fifoCount >= (FIFO_DEPTH - fifoAFull)) {
            this.regs[REG_INT_STATUS1] |= 0x80;
        }

        // Drive INT pin LOW (active-low) if interrupt is enabled and pending
        const intEnabled = this.regs[REG_INT_ENABLE1];
        if (intEnabled & this.regs[REG_INT_STATUS1]) {
            this.setPinVoltage('INT', 0);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  SIMULATION TICK
    // ─────────────────────────────────────────────────────────────────

    update(cpuCycles: number): void {
        const mode = this.regs[REG_MODE_CONFIG] & 0x07;
        const shutdown = this.regs[REG_MODE_CONFIG] & 0x80;

        if (shutdown || (mode !== 0x02 && mode !== 0x03 && mode !== 0x07)) return;
        if (this.redAmp === 0 && this.irAmp === 0) return;

        const cyclesPerSample = Math.floor(CYCLES_PER_HZ / this.sampleRateHz);
        if (cpuCycles - this.lastSampleCycles < cyclesPerSample) return;
        this.lastSampleCycles = cpuCycles;

        // Advance PPG phase
        const cyclesPerBeat = CYCLES_PER_HZ / this.heartRateHz;
        this.ppgPhase += cyclesPerSample / cyclesPerBeat;
        if (this.ppgPhase >= 1.0) this.ppgPhase -= 1.0;

        // Generate sample
        const pulse = ppgPulseShape(this.ppgPhase);

        // ── RED channel ──────────────────────────────────────────────
        // DC scales strongly with amplitude; AC (pulsatile) ~1.5% of DC
        const redDC  = this.redAmp * 780;
        const redAC  = redDC * 0.014;
        let redVal   = Math.round(redDC + redAC * pulse);

        // ── IR channel ───────────────────────────────────────────────
        // IR absorption is slightly higher; AC ratio is lower (~1.0%)
        const irDC   = this.irAmp * 900;
        const irAC   = irDC * 0.010;
        let irVal    = Math.round(irDC + irAC * pulse);

        // ── Motion / LED-change noise ─────────────────────────────────
        if (this.noiseDecay > 0) {
            const noise = this.motionNoise * this.noiseDecay * (Math.random() - 0.5) * 2;
            redVal = Math.round(redVal + noise);
            irVal  = Math.round(irVal  + noise * 0.85);
            this.noiseDecay -= 0.04;
            if (this.noiseDecay < 0) this.noiseDecay = 0;
        }

        // ── Clamp to 18-bit ───────────────────────────────────────────
        redVal = Math.max(0, Math.min(0x3FFFF, redVal));
        irVal  = Math.max(0, Math.min(0x3FFFF, irVal));

        this.pushFifo(redVal, irVal);

        // ── Update displayed stats every 25 samples ───────────────────
        if ((this.regs[REG_FIFO_WR_PTR] & 0x1F) % 25 === 0) {
            this.updateDisplayedStats(redDC, redAC, irDC, irAC);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  EVENTS FROM UI (context menu sliders)
    // ─────────────────────────────────────────────────────────────────

    onEvent(event: any): void {
        if (!event || !event.type) return;

        switch (event.type) {
            case 'SET_RED_LED': {
                const v = Math.max(0, Math.min(255, parseInt(event.value, 10) || 0));
                this.writeReg(REG_LED1_PA, v);
                break;
            }
            case 'SET_IR_LED': {
                const v = Math.max(0, Math.min(255, parseInt(event.value, 10) || 0));
                this.writeReg(REG_LED2_PA, v);
                break;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────────────────────────────

    private applyLEDState(): void {
        const mode     = this.regs[REG_MODE_CONFIG] & 0x07;
        const shutdown = (this.regs[REG_MODE_CONFIG] & 0x80) !== 0;
        const active   = !shutdown && (mode === 0x02 || mode === 0x03 || mode === 0x07);

        const redOn = active && this.redAmp > 0;
        const irOn  = active && this.irAmp  > 0;

        this.setState({
            ...this.state,
            redLedOn: redOn,
            irLedOn:  irOn,
            redAmp:   this.redAmp,
            irAmp:    this.irAmp,
        });
    }

    private triggerMotionNoise(): void {
        // Brief noise burst to simulate real-world LED current change transient
        this.motionNoise = Math.max(this.redAmp, this.irAmp) * 120;
        this.noiseDecay  = 1.0;
    }

    private updateSampleRate(): void {
        const spo2Cfg = this.regs[REG_SPO2_CONFIG];
        const srBits  = (spo2Cfg >> 2) & 0x07;
        const rates   = [50, 100, 200, 400, 800, 1000, 1600, 3200];
        this.sampleRateHz = rates[srBits] ?? 100;
    }

    private updateDisplayedStats(redDC: number, redAC: number, irDC: number, irAC: number): void {
        const mode = this.regs[REG_MODE_CONFIG] & 0x07;
        let spo2Str = '--';

        if ((mode === 0x03 || mode === 0x07) && this.irAmp > 0 && this.redAmp > 0 && irDC > 0 && redDC > 0) {
            // Simplified Mendelson/Kamat R-value formula:
            //   R = (AC_red / DC_red) / (AC_ir / DC_ir)
            //   SpO2 ≈ 110 − 25 × R
            const R    = (redAC / redDC) / (irAC / irDC);
            let spo2   = 110 - 25 * R;
            // Clamp to physiologically plausible range
            spo2 = Math.max(70, Math.min(100, spo2));
            spo2Str = spo2.toFixed(1) + '%';
        }

        const bpm = Math.round(this.heartRateHz * 60);

        this.setState({
            ...this.state,
            heartRate: mode !== 0x00 && this.redAmp > 0 ? String(bpm) : '--',
            spo2:      spo2Str,
        });
    }

    private resetDevice(): void {
        this.regs.fill(0);
        this.regs[REG_PART_ID] = PART_ID;
        this.regs[REG_REV_ID]  = REV_ID;
        this.fifo.forEach(e => { e.red = 0; e.ir = 0; });
        this.fifoReadByteIdx = 0;
        this.ppgPhase        = 0;
        this.lastSampleCycles = 0;
        this.redAmp = 0;
        this.irAmp  = 0;
        this.setState({
            redLedOn: false, irLedOn: false,
            redAmp: 0, irAmp: 0,
            heartRate: '--', spo2: '--',
        });
    }

    getSyncState() {
        return { ...this.state };
    }
}
