import { BaseComponent } from '../BaseComponent';

export class MAX7219Logic extends BaseComponent {
    private shiftRegister: number = 0;
    private bitsReceived: number = 0;
    private matrixData: number[] = new Array(8).fill(0);
    private shutdown: boolean = true;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {
            matrix: [...this.matrixData],
            active: false
        };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        const voltageOut = isHigh ? 5.0 : 0.0;

        // Passthrough signals for daisy-chaining
        if (pinId === 'CS') this.setPinVoltage('CS_OUT', voltageOut);
        if (pinId === 'CLK') this.setPinVoltage('CLK_OUT', voltageOut);

        if (pinId === 'CLK') {
            if (isHigh) {
                // Rising Edge: Clock data IN
                const din = this.getPinVoltage('DIN') > 2.5 ? 1 : 0;
                this.shiftRegister = ((this.shiftRegister << 1) | din) & 0xFFFF;
                this.bitsReceived++;
            } else {
                // Falling Edge: Clock data OUT to DOUT for the next module in chain
                const doutBit = (this.shiftRegister >> 15) & 1;
                this.setPinVoltage('DOUT', doutBit ? 5.0 : 0.0);
            }
        }

        // Latch data on CS (LOAD) rising edge
        if (pinId === 'CS' && isHigh) {
            this.executeCommand(this.shiftRegister);
            this.bitsReceived = 0; 
        }
    }

    private executeCommand(data: number) {
        const address = (data >> 8) & 0x0F;
        const value = data & 0xFF;

        if (address >= 0x01 && address <= 0x08) {
            this.matrixData[address - 1] = value;
        } else if (address === 0x0C) {
            this.shutdown = (value === 0);
        } else if (address === 0x0F) {
            if (value) this.matrixData.fill(0xFF);
            else this.matrixData.fill(0); 
        }

        this.setState({ 
            matrix: [...this.matrixData],
            active: !this.shutdown
        });
    }

    getSyncState() {
        return { ...this.state };
    }
}