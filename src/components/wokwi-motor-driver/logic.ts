import { BaseComponent } from '../BaseComponent';

export class MotorDriverLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {};
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);
        const ena = Math.max(0, this.getPinVoltage('ENA') || 0);
        const in1 = this.getPinVoltage('IN1') > 2.5;
        const in2 = this.getPinVoltage('IN2') > 2.5;

        if (ena > 0.5) {
            this.setPinVoltage('OUT1', in1 ? ena : 0);
            this.setPinVoltage('OUT2', in2 ? ena : 0);
        } else {
            this.setPinVoltage('OUT1', 0);
            this.setPinVoltage('OUT2', 0);
        }

        const enb = Math.max(0, this.getPinVoltage('ENB') || 0);
        const in3 = this.getPinVoltage('IN3') > 2.5;
        const in4 = this.getPinVoltage('IN4') > 2.5;

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
