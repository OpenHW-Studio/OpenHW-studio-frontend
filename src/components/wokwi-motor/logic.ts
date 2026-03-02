import { BaseComponent } from '../BaseComponent';

export class MotorLogic extends BaseComponent {
    private pinData: Record<string, { lastState: boolean, lastCycle: number, highCycles: number }> = {};
    private lastUpdateCycle = 0;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { speed: 0 };
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

        return dutyCycle * 5.0; // Assume 5V
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);

        const elapsedCycles = time - this.lastUpdateCycle;
        this.lastUpdateCycle = time;

        const v1 = this.getAverageVoltage('1', time, elapsedCycles);
        const v2 = this.getAverageVoltage('2', time, elapsedCycles);

        let speed = 0;
        if (v1 > v2 + 0.5) {
            speed = (v1 - v2) / 5.0;
        } else if (v2 > v1 + 0.5) {
            speed = -(v2 - v1) / 5.0;
        }

        speed = Math.max(-1, Math.min(1, speed));

        if (Math.abs(this.state.speed - speed) > 0.1) {
            this.state.speed = speed;
            this.stateChanged = true;
        }
    }
}
