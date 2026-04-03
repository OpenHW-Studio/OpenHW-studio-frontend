import { BaseComponent } from '../BaseComponent';

export class L293DLogic extends BaseComponent {
    private pinData: Record<string, { lastState: boolean, lastCycle: number, highCycles: number }> = {};
    private lastUpdateCycle = 0;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {};
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        if (!this.pinData[pinId]) {
            this.pinData[pinId] = { lastState: false, lastCycle: cpuCycles, highCycles: 0 };
        }
        const data = this.pinData[pinId];
        if (data.lastState) {
            data.highCycles += (cpuCycles - data.lastCycle);
        }
        data.lastState = isHigh;
        data.lastCycle = cpuCycles;
    }

    private getAverageVoltage(pinId: string, currentCycles: number, elapsedCycles: number): number {
        const data = this.pinData[pinId];
        if (!data) return this.getPinVoltage(pinId);

        let highCyclesToCount = data.highCycles;
        if (data.lastState) {
            highCyclesToCount += (currentCycles - data.lastCycle);
        }

        data.highCycles = 0;
        data.lastCycle = currentCycles;

        if (elapsedCycles <= 0) return this.getPinVoltage(pinId);

        let dutyCycle = highCyclesToCount / elapsedCycles;
        dutyCycle = Math.max(0, Math.min(1, dutyCycle));

        return dutyCycle * 5.0; // Assume 5V logic range
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);

        const elapsedCycles = time - this.lastUpdateCycle;
        this.lastUpdateCycle = time;

        if (elapsedCycles <= 0) return;

        // Bridge 1 (Left Side)
        const en12 = this.getAverageVoltage('EN1,2', time, elapsedCycles);
        const in1 = this.getPinVoltage('IN1') > 2.5;
        const in2 = this.getPinVoltage('IN2') > 2.5;

        if (en12 > 0.5) {
            this.setPinVoltage('OUT1', in1 ? en12 : 0);
            this.setPinVoltage('OUT2', in2 ? en12 : 0);
        } else {
            this.setPinVoltage('OUT1', 0);
            this.setPinVoltage('OUT2', 0);
        }

        // Bridge 2 (Right Side)
        const en34 = this.getAverageVoltage('EN3,4', time, elapsedCycles);
        const in3 = this.getPinVoltage('IN3') > 2.5;
        const in4 = this.getPinVoltage('IN4') > 2.5;

        if (en34 > 0.5) {
            this.setPinVoltage('OUT3', in3 ? en34 : 0);
            this.setPinVoltage('OUT4', in4 ? en34 : 0);
        } else {
            this.setPinVoltage('OUT3', 0);
            this.setPinVoltage('OUT4', 0);
        }

        this.stateChanged = true;
    }
}
