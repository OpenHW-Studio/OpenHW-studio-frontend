import { BaseComponent } from '../BaseComponent';

export class NLSF595Logic extends BaseComponent {
    private shiftRegister = 0;
    private latchRegister = 0;
    private sckPinLast = false;
    private csPinLast = true;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { r: 0, g: 0, b: 0 };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        const mosi = this.getPinVoltage('MOSI') > 2.5;

        if (pinId === 'SCK') {
            const cs = this.getPinVoltage('CS') > 2.5;
            // Shift on rising edge of SCK if CS is LOW (active low shift)
            if (isHigh && !this.sckPinLast && !cs) {
                this.shiftRegister = ((this.shiftRegister << 1) | (mosi ? 1 : 0)) & 0xFFFFFF; // 24-bit max for safety
            }
            this.sckPinLast = isHigh;
        }

        if (pinId === 'CS') {
            // Latch on rising edge of CS
            if (isHigh && !this.csPinLast) {
                this.latchRegister = this.shiftRegister;
                this.updateOutputs();
            }
            this.csPinLast = isHigh;
        }
    }

    private updateOutputs() {
        // Map lowest 3 bits or individual bytes depending on usage
        // Let's map Q0 to B, Q1 to G, Q2 to R
        const rVal = (this.latchRegister & 0x04) ? 5 : 0;
        const gVal = (this.latchRegister & 0x02) ? 5 : 0;
        const bVal = (this.latchRegister & 0x01) ? 5 : 0;

        this.setPinVoltage('R1', rVal);
        this.setPinVoltage('G1', gVal);
        this.setPinVoltage('B1', bVal);

        this.state.r = rVal > 2.5 ? 255 : 0;
        this.state.g = gVal > 2.5 ? 255 : 0;
        this.state.b = bVal > 2.5 ? 255 : 0;

        // Wait, if it's PWM or 8-bit color logic, usually SPI drivers like WS2812 take 24 bits.
        // NLSF595 is just a shift register, so it outputs digital High/Low.
        // What if user shifts an 8-bit value where 0, 1, 2 are R, G, B?
        this.stateChanged = true;
    }
}
