import { BaseComponent } from '../BaseComponent';

export class MotorLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { speed: 0 };
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);
        const v1 = this.getPinVoltage('1');
        const v2 = this.getPinVoltage('2');

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
