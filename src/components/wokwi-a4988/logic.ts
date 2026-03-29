import { BaseComponent } from '../BaseComponent';

// Full-step sequence mapping
const PHASE_MAP = [
    { '1A': 1, '1B': 0, '2A': 1, '2B': 0 }, // Step 0
    { '1A': 0, '1B': 1, '2A': 1, '2B': 0 }, // Step 1
    { '1A': 0, '1B': 1, '2A': 0, '2B': 1 }, // Step 2
    { '1A': 1, '1B': 0, '2A': 0, '2B': 1 }  // Step 3
];

export class A4988Logic extends BaseComponent {
    private stepPos = 0;
    private stepPinLast = false;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { active: false };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        if (pinId === 'STEP') {
            if (isHigh && !this.stepPinLast) { // Rising edge
                // Check Enable (Active LOW)
                const enabled = this.getPinVoltage('ENABLE') < 2.5;
                // Sleep & Reset (Active LOW, meaning must be HIGH to operate)
                const asleep = this.getPinVoltage('SLEEP') < 2.5;

                // If not asleep and enabled, process step
                if (!asleep && enabled) {
                    const dir = this.getPinVoltage('DIR') > 2.5 ? 1 : -1;
                    this.stepPos = (this.stepPos + dir + 4) % 4;
                    this.updateOutputs();
                }
            }
            this.stepPinLast = isHigh;
        }

        if (pinId === 'ENABLE' || pinId === 'SLEEP') {
            this.updateOutputs();
        }
    }

    private updateOutputs() {
        const enabled = this.getPinVoltage('ENABLE') < 2.5;
        const asleep = this.getPinVoltage('SLEEP') < 2.5;

        // If disabled or asleep, coils are off (freewheeling)
        if (asleep || !enabled) {
            this.setPinVoltage('1A', 0);
            this.setPinVoltage('1B', 0);
            this.setPinVoltage('2A', 0);
            this.setPinVoltage('2B', 0);
            this.state.active = false;
        } else {
            const phase = PHASE_MAP[this.stepPos];
            this.setPinVoltage('1A', phase['1A'] ? 5 : 0);
            this.setPinVoltage('1B', phase['1B'] ? 5 : 0);
            this.setPinVoltage('2A', phase['2A'] ? 5 : 0);
            this.setPinVoltage('2B', phase['2B'] ? 5 : 0);
            this.state.active = true;
        }
        this.stateChanged = true;
    }
}
