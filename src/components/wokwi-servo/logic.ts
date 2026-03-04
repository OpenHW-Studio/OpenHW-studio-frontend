import { BaseComponent } from '../BaseComponent';

export class ServoLogic extends BaseComponent {
    private lastHighCycle = 0;
    private targetAngle = -1; // -1 indicates uninitialized target
    private lastUpdateCycle = 0;

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

                    this.targetAngle = angle;
                }
            }
        }
    }

    update(cpuCycles: number, wires: any[], instances: BaseComponent[]) {
        super.update(cpuCycles, wires, instances);

        if (this.lastUpdateCycle === 0) {
            this.lastUpdateCycle = cpuCycles;
            // Initialize target to starting angle to prevent jumping to 0 if no PWM received yet
            if (this.targetAngle === -1) {
                this.targetAngle = this.state.angle || 0;
            }
            return;
        }

        const elapsedCycles = cpuCycles - this.lastUpdateCycle;
        this.lastUpdateCycle = cpuCycles;

        if (Math.abs(this.state.angle - this.targetAngle) > 0.1) {
            // Smoothly move the servo to simulate physical motor speed
            // Standard servo is 60 degrees / 0.15s (400 deg / sec). At 16MHz, 1s = 16,000,000 cycles
            const maxMovement = 400 * (elapsedCycles / 16000000);

            if (this.state.angle < this.targetAngle) {
                this.state.angle = Math.min(this.targetAngle, this.state.angle + maxMovement);
            } else {
                this.state.angle = Math.max(this.targetAngle, this.state.angle - maxMovement);
            }
            this.stateChanged = true;
        }
    }
}
