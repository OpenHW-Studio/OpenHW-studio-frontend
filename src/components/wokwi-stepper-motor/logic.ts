import { BaseComponent } from '../BaseComponent';

export class StepperMotorLogic extends BaseComponent {
    private angle = 0;
    private stepAngle = 1.8;
    private currentPhase = -1;
    private stepCount = 0;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        if (manifest.attrs && manifest.attrs.step_angle) {
            this.stepAngle = parseFloat(manifest.attrs.step_angle);
        }
        this.state = { angle: this.angle };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        const aPlus = this.getPinVoltage('A+') > 2.5;
        const aMinus = this.getPinVoltage('A-') > 2.5;
        const bPlus = this.getPinVoltage('B+') > 2.5;
        const bMinus = this.getPinVoltage('B-') > 2.5;

        let phaseA = 0;
        if (aPlus && !aMinus) phaseA = 1;
        else if (!aPlus && aMinus) phaseA = -1;

        let phaseB = 0;
        if (bPlus && !bMinus) phaseB = 1;
        else if (!bPlus && bMinus) phaseB = -1;

        let newPhase = -1;
        if (phaseA === 1 && phaseB === 1) newPhase = 0;
        else if (phaseA === -1 && phaseB === 1) newPhase = 1;
        else if (phaseA === -1 && phaseB === -1) newPhase = 2;
        else if (phaseA === 1 && phaseB === -1) newPhase = 3;

        if (newPhase !== -1) {
            if (this.currentPhase === -1) {
                this.currentPhase = newPhase;
            } else if (newPhase !== this.currentPhase) {
                const diff = (newPhase - this.currentPhase + 4) % 4;
                if (diff === 1) {
                    this.angle += this.stepAngle;
                    this.stepCount++;
                } else if (diff === 3) {
                    this.angle -= this.stepAngle;
                    this.stepCount--;
                }
                this.currentPhase = newPhase;
                this.state.angle = this.angle;
                this.stateChanged = true;
            }
        } else {
            // Unpowered or freewheeling phase
            this.currentPhase = -1;
        }
    }

    onCustomTelemetry() {
        const revolutionCount = this.stepCount * this.stepAngle / 360;
        this.setCustomTelemetry({
            angle: Number(this.angle.toFixed(1)),
            stepCount: this.stepCount,
            stepsPerRevolution: Number((360 / this.stepAngle).toFixed(0)),
            revolutions: Number(revolutionCount.toFixed(2)),
            currentPhase: this.currentPhase,
        });
    }
}
