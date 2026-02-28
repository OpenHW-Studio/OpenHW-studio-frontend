import { BaseComponent } from '../BaseComponent';

export class PowerSupplyLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {};
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);
        this.setPinVoltage('5V', 5.0);
        this.setPinVoltage('GND', 0.0);
    }
}
