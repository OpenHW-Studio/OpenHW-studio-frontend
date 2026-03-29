import { BaseComponent } from '../BaseComponent';

export class PCA9865Logic extends BaseComponent {
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
        // Assume mapping to either primary or right header
        let sda = this.getPinVoltage('SDA') > 2.5;
        if (pinId === 'SDA_R') sda = this.getPinVoltage('SDA_R') > 2.5;

        let scl = this.getPinVoltage('SCL') > 2.5;
        if (pinId === 'SCL_R') scl = this.getPinVoltage('SCL_R') > 2.5;

        // I2C START condition
        if ((pinId.startsWith('SDA')) && !sda && this.sdaLast && scl) {
            this.i2cState = 'RECV_ADDR';
            this.bitCount = 0;
            this.curByte = 0;
        }
        // I2C STOP condition
        else if ((pinId.startsWith('SDA')) && sda && !this.sdaLast && scl) {
            this.i2cState = 'IDLE';
        }

        // I2C Clock rising edge data sensing
        if ((pinId.startsWith('SCL')) && scl && !this.sclLast && this.i2cState !== 'IDLE') {
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

        if (pinId.startsWith('SDA')) this.sdaLast = sda;
        if (pinId.startsWith('SCL')) this.sclLast = scl;
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
            this.regAddr++;
        }
    }

    private updatePWMOutputs() {
        for (let ch = 0; ch < 16; ch++) {
            const base = 0x06 + 4 * ch;
            const onVal = this.pwmRegs[base] | ((this.pwmRegs[base + 1] & 0x0F) << 8);
            const offVal = this.pwmRegs[base + 2] | ((this.pwmRegs[base + 3] & 0x0F) << 8);

            let duty = (offVal - onVal) / 4096.0;
            if (duty < 0) duty += 1.0;

            // Full ON and Full OFF logic bit 4
            if (this.pwmRegs[base + 1] & 0x10) duty = 1.0;
            else if (this.pwmRegs[base + 3] & 0x10) duty = 0.0;

            this.setPinVoltage(`S${ch}`, 5.0 * duty);
        }
    }
}
