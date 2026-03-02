import { BaseComponent } from '../BaseComponent';

export class ServoLogic extends BaseComponent {
    private lastHighCycle = 0;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { angle: 0 };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        if (pinId === 'PWM') {
            if (isHigh) {
                this.lastHighCycle = cpuCycles;
            } else {
                if (this.lastHighCycle > 0) {
                    const elapsedCycles = cpuCycles - this.lastHighCycle;
                    const us = elapsedCycles / 16;

                    let angle = (us - 544) * 180 / (2400 - 544);
                    angle = Math.max(0, Math.min(180, angle));

                    if (Math.abs(this.state.angle - angle) > 1) {
                        this.state.angle = angle;
                        this.stateChanged = true;
                    }
                }
            }
        }
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);
    }
}
