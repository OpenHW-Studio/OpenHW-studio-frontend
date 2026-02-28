import { BaseComponent } from '../BaseComponent';

export class UnoLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
    }

    update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
        // Nothing right now, pin states are driven directly by avr8js in the worker
    }
}
