import { BaseComponent } from '../BaseComponent';

export class WokwiTM1637Logic extends BaseComponent {
    private clkHigh: boolean = true;
    private dioHigh: boolean = true;

    // TM1637 State Machine
    private bitCount: number = 0;
    private currentByte: number = 0;
    private stateMachine: 'IDLE' | 'COMMAND' | 'DATA' = 'IDLE';
    private currentAddress: number = 0;
    private writeMode: 'AUTO' | 'FIXED' = 'AUTO';
    private displayOn: boolean = true;
    private brightness: number = 7;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        console.log(`[TM1637] Logic instance created for ${id}`);
        this.state = {
            digits: [0, 0, 0, 0],
            colon: false
        };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        if (pinId === 'DIO') {
            this.dioHigh = isHigh;
            if (this.clkHigh) {
                if (isHigh) {
                    // STOP Condition
                    console.log('[TM1637] STOP');
                    this.stateMachine = 'IDLE';
                    this.bitCount = 0;
                } else {
                    // START Condition
                    console.log('[TM1637] START');
                    this.bitCount = 0;
                    this.currentByte = 0;
                    this.stateMachine = 'COMMAND';
                }
            }
        } else if (pinId === 'CLK') {
            this.clkHigh = isHigh;
            if (isHigh && this.stateMachine !== 'IDLE') {
                // Rising edge: sample data
                if (this.bitCount < 8) {
                    if (this.dioHigh) {
                        this.currentByte |= (1 << this.bitCount);
                    }
                    this.bitCount++;
                } else if (this.bitCount === 8) {
                    // 9th bit: ACK
                    console.log(`[TM1637] Received Byte: 0x${this.currentByte.toString(16).toUpperCase()}`);
                    this.processByte(this.currentByte);
                    this.bitCount = 0;
                    this.currentByte = 0;
                }
            }
        }
    }

    private processByte(data: number) {
        // TM1637 Commands are distinguished by the top 2 bits
        const cmdType = data & 0xC0;

        if (cmdType === 0x40) {
            // Data command
            this.writeMode = (data & 0x04) ? 'FIXED' : 'AUTO';
            // ignore test mode and read key bits for now
            this.stateMachine = 'COMMAND';
        } else if (cmdType === 0x80) {
            // Display control
            this.displayOn = ((data & 0x08) !== 0);
            this.brightness = data & 0x07;
            this.stateChanged = true;
            this.stateMachine = 'COMMAND';
        } else if (cmdType === 0xC0) {
            // Address command
            this.currentAddress = data & 0x0F;
            this.stateMachine = 'DATA';
        } else if (this.stateMachine === 'DATA') {
            // Incoming data for current address
            if (this.currentAddress < 6) {
                // Address 0-3 are digits 1-4.
                // Depending on the wiring, Address 0 is typically Digit 1.
                // Data bit 7 is the colon on many modules.
                if (this.currentAddress < 4) {
                    this.state.digits[this.currentAddress] = data & 0x7F;
                    if ((data & 0x80) !== 0) {
                        this.state.colon = true;
                    } else if (this.currentAddress === 1) { // some modules use bit 7 of digit 2 for colon
                        this.state.colon = false;
                    }
                    this.stateChanged = true;
                }
            }
            if (this.writeMode === 'AUTO') {
                this.currentAddress++;
            }
        }
    }

    getSyncState() {
        return {
            ...this.state,
            displayOn: this.displayOn,
            brightness: this.brightness
        };
    }
}
