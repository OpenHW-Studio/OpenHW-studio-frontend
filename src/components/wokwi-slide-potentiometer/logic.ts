import { BaseComponent } from '../BaseComponent';

export class SlidePotLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { value: 50 };
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);
        let val = Number(this.state.value) || 0;
        const vcc = this.getPinVoltage('VCC');
        const gnd = this.getPinVoltage('GND');

        const sigV = gnd + (vcc - gnd) * (val / 100.0);
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
