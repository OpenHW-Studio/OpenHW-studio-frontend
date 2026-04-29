import { BaseComponent } from '../BaseComponent';

export class PowerSupplyLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {};
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);
        const voltageStr = this.state.voltage ?? '5.0';
        const voltage = parseFloat(voltageStr) || 0;
        this.setPinVoltage('5V', voltage);
        this.setPinVoltage('GND', 0.0);
    }
}
