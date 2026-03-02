import { BaseComponent } from '../BaseComponent';

export class MotorDriverLogic extends BaseComponent {
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

        const ena = Math.max(0, this.getAverageVoltage('ENA', time, elapsedCycles) || 0);
        const in1 = this.getAverageVoltage('IN1', time, elapsedCycles) > 2.5;
        const in2 = this.getAverageVoltage('IN2', time, elapsedCycles) > 2.5;

        if (ena > 0.5) {
            this.setPinVoltage('OUT1', in1 ? ena : 0);
            this.setPinVoltage('OUT2', in2 ? ena : 0);
        } else {
            this.setPinVoltage('OUT1', 0);
            this.setPinVoltage('OUT2', 0);
        }

        const enb = Math.max(0, this.getAverageVoltage('ENB', time, elapsedCycles) || 0);
        const in3 = this.getAverageVoltage('IN3', time, elapsedCycles) > 2.5;
        const in4 = this.getAverageVoltage('IN4', time, elapsedCycles) > 2.5;

        if (enb > 0.5) {
            this.setPinVoltage('OUT3', in3 ? enb : 0);
            this.setPinVoltage('OUT4', in4 ? enb : 0);
        } else {
            this.setPinVoltage('OUT3', 0);
            this.setPinVoltage('OUT4', 0);
        }

        if (this.getPinVoltage('12V') > 7) {
            this.setPinVoltage('5V', 5.0);
        } else {
            this.setPinVoltage('5V', 0);
        }
    }
}
