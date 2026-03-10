import { BaseComponent } from '../BaseComponent';

export class PotentiometerLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { value: 50 };
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);
        let val = Number(this.state.value) || 0;

        const v1 = this.getPinVoltage('VCC') || this.getPinVoltage('1');
        const v2 = this.getPinVoltage('GND') || this.getPinVoltage('2');

        const sigV = v1 + (v2 - v1) * (val / 100.0);
        this.setPinVoltage('SIG', sigV);
    }

    getSyncState() {
        return { value: this.state.value };
    }

    onEvent(event: any) {
        if (event && event.type === 'input' && event.value !== undefined) {
            this.state.value = event.value;
            this.stateChanged = true;
        }
    }
}
