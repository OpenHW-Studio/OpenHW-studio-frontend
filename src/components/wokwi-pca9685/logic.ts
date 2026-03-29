import { BaseComponent } from '../BaseComponent';

export class PCA9685Logic extends BaseComponent {
    private sdaLast = true;
    private sclLast = true;
    private i2cState = 'IDLE';
    private bitCount = 0;
    private curByte = 0;
    private regAddr = 0;
    private pwmRegs = new Uint8Array(256);
    private i2cAddress = 0x40;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {};
        if (manifest.attrs?.i2c_address) {
            this.i2cAddress = parseInt(manifest.attrs.i2c_address, 16);
        }
    }

    onPinStateChange(pinId: string, isHigh: boolean) {
        const sda = this.getPinVoltage('SDA') > 2.5;
        const scl = this.getPinVoltage('SCL') > 2.5;

        // I2C START condition
        if (pinId === 'SDA' && !sda && this.sdaLast && scl) {
            this.i2cState = 'RECV_ADDR';
            this.bitCount = 0;
            this.curByte = 0;
        }
        // I2C STOP condition
        else if (pinId === 'SDA' && sda && !this.sdaLast && scl) {
            this.i2cState = 'IDLE';
        }

        // I2C Clock rising edge data sensing
        if (pinId === 'SCL' && scl && !this.sclLast && this.i2cState !== 'IDLE') {
            if (this.bitCount < 8) {
                this.curByte = (this.curByte << 1) | (sda ? 1 : 0);
                this.bitCount++;
            } else {
                // 9th bit: ACK. We process the byte here
                this.processI2CByte(this.curByte);
                this.bitCount = 0;
                this.curByte = 0;
            }
        }

        if (pinId === 'SDA') this.sdaLast = sda;
        if (pinId === 'SCL') this.sclLast = scl;
    }

    private processI2CByte(byte: number) {
        if (this.i2cState === 'RECV_ADDR') {
            const addr = byte >> 1;
            if (addr === this.i2cAddress) {
                this.i2cState = 'RECV_REG';
            } else {
                this.i2cState = 'IDLE';
            }
        } else if (this.i2cState === 'RECV_REG') {
            this.regAddr = byte;
            this.i2cState = 'RECV_DATA';
        } else if (this.i2cState === 'RECV_DATA') {
            this.pwmRegs[this.regAddr] = byte;
            this.updatePWMOutputs();
            this.regAddr++; // Auto increment for sequential writes
        }
    }

    private updatePWMOutputs() {
        // Registers structure:
        // LED0_ON_L (0x06), LED0_ON_H (0x07), LED0_OFF_L (0x08), LED0_OFF_H (0x09) ...
        // We evaluate an equivalent duty cycle mapped to voltage for simple emulation.
        // A PCA9685 channel has 12-bit resolution.

        for (let ch = 0; ch < 16; ch++) {
            const base = 0x06 + 4 * ch;
            const onVal = this.pwmRegs[base] | ((this.pwmRegs[base + 1] & 0x0F) << 8);
            const offVal = this.pwmRegs[base + 2] | ((this.pwmRegs[base + 3] & 0x0F) << 8);

            // Basic duty cycle calculation: (offVal - onVal) / 4096
            let duty = (offVal - onVal) / 4096.0;
            if (duty < 0) duty += 1.0;

            // Full ON and Full OFF logic bit 4
            if (this.pwmRegs[base + 1] & 0x10) duty = 1.0;
            else if (this.pwmRegs[base + 3] & 0x10) duty = 0.0;

            // Output simulated PWM as a continuous analog voltage between 0-5V to drive components
            this.setPinVoltage(`S${ch}`, 5.0 * duty);
        }
    }
}
