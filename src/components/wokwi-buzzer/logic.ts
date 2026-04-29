import { BaseComponent } from '../BaseComponent';

export class BuzzerLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { isBuzzing: false };
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);
        const v1 = this.getPinVoltage('1');
        const v2 = this.getPinVoltage('2');

        const isBuzzing = (v1 - v2) > 2.0;

        if (this.state.isBuzzing !== isBuzzing) {
            this.state.isBuzzing = isBuzzing;
            this.stateChanged = true;
        }
    }
}
