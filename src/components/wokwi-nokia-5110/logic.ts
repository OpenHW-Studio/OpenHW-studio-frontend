import { BaseComponent } from '../BaseComponent';

export class Nokia5110Logic extends BaseComponent {
    private fb = new Uint8Array(504);
    private x = 0;
    private y = 0;
    private shiftReg = 0;
    private bitCount = 0;
    private clkLast = false;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { fbStr: "" };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        if (pinId === 'RST') {
            if (!isHigh) {
                this.fb.fill(0);
                this.x = 0;
                this.y = 0;
                this.updateFbStr();
            }
            return;
        }

        const ce = this.getPinVoltage('SCE') > 2.5;
        if (ce) return; // Chip not selected

        if (pinId === 'SCLK') {
            // Rising edge
            if (isHigh && !this.clkLast) {
                const din = this.getPinVoltage('DN') > 2.5 ? 1 : 0;
                this.shiftReg = ((this.shiftReg << 1) | din) & 0xFF;
                this.bitCount++;

                if (this.bitCount === 8) {
                    this.processByte(this.shiftReg);
                    this.bitCount = 0;
                }
            }
            this.clkLast = isHigh;
        }
    }

    private processByte(byte: number) {
        const isData = this.getPinVoltage('DC') > 2.5;

        if (isData) {
            // Write data to framebuffer
            if (this.x < 84 && this.y < 6) {
                this.fb[this.y * 84 + this.x] = byte;
            }
            // Auto increment X, then Y
            this.x++;
            if (this.x >= 84) {
                this.x = 0;
                this.y++;
                if (this.y >= 6) this.y = 0;
            }
            this.updateFbStr();
        } else {
            // Command
            if ((byte & 0x80) === 0x80) { // Set X
                this.x = byte & 0x7F;
            } else if ((byte & 0x40) === 0x40) { // Set Y
                this.y = byte & 0x07;
            } else if ((byte & 0x20) === 0x20) {
                // Function set (bias, power, etc) - ignored in simple emulation
            }
        }
    }

    private updateFbStr() {
        // Convert framebuffer to base64 or a hex string, something easy for React
        // Hex string is fine
        let str = "";
        for (let i = 0; i < 504; i++) {
            str += this.fb[i].toString(16).padStart(2, '0');
        }
        this.state.fbStr = str;
        this.stateChanged = true;
    }
}
