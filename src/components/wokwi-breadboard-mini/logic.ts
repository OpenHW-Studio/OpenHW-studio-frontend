import { BaseComponent } from '../BaseComponent';

export class MiniBreadboardLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {};
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        // Breadboards are passive and handled natively by the engine's netlist generator.
    }
}
