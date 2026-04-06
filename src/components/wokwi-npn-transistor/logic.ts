import { BaseComponent } from '../BaseComponent';

export class NPNTransistorLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {};
    }

    onPinStateChange() {
        const vb = this.getPinVoltage('B');
        const vc = this.getPinVoltage('C');
        // Very simplified active region model:
        if (vb > 0.6) {
            // Transistor is ON, E pulls high to C (minus saturation drop)
            this.setPinVoltage('E', Math.max(0, vc - 0.2));
        } else {
            // Transistor is OFF
            this.setPinVoltage('E', 0);
        }
    }
}
