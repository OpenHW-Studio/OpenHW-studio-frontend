import { BaseComponent } from '../BaseComponent';

export class L293DLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {};
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        // Bridge 1 (Left Side)
        const en12 = this.getPinVoltage('EN1,2') > 2.5;
        if (en12) {
            this.setPinVoltage('OUT1', this.getPinVoltage('IN1'));
            this.setPinVoltage('OUT2', this.getPinVoltage('IN2'));
        } else {
            this.setPinVoltage('OUT1', 0);
            this.setPinVoltage('OUT2', 0);
        }

        // Bridge 2 (Right Side)
        const en34 = this.getPinVoltage('EN3,4') > 2.5;
        if (en34) {
            this.setPinVoltage('OUT3', this.getPinVoltage('IN3'));
            this.setPinVoltage('OUT4', this.getPinVoltage('IN4'));
        } else {
            this.setPinVoltage('OUT3', 0);
            this.setPinVoltage('OUT4', 0);
        }

        this.stateChanged = true;
    }
}
