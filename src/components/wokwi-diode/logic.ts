import { BaseComponent } from '../BaseComponent';

export class DiodeLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {};
    }

    onPinStateChange() {
        const va = this.getPinVoltage('A');
        const vc = this.getPinVoltage('C');

        if (va > vc + 0.6) {
            // Forward biased
            this.setPinVoltage('C', Math.max(0, va - 0.7));
        } else {
            // Reverse biased - no pass through
            // Do not drive pin active low, let it float or stay at its own potential
        }
    }
}
