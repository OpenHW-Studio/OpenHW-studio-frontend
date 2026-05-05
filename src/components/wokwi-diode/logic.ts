import { BaseComponent } from '../BaseComponent';

export class DiodeLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {};
    }

    getMnaPins() { return ['A', 'C']; }
    getConductance() {
        const va = this.getPinVoltage('A');
        const vc = this.getPinVoltage('C');
        return (va > vc + 0.6) ? 100 : 1e-9;
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
