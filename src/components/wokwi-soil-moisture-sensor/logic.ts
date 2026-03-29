import { BaseComponent } from '../BaseComponent';

export class SoilMoistureSensorLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { moisture: 50 }; // Default 50%
    }

    onPinStateChange() {
        const vcc = this.getPinVoltage('VCC');
        if (vcc < 1.0) {
            this.setPinVoltage('A0', 0);
            this.setPinVoltage('D0', 0);
            return;
        }

        const m = Math.max(0, Math.min(100, this.state.moisture));

        // Analog: VCC when dry, ~1.0V when completely completely submerged
        const dryVolt = vcc;
        const wetVolt = 1.0;
        const outA0 = wetVolt + ((100 - m) / 100) * (dryVolt - wetVolt);

        // Digital comparator: goes LOW when wet (moisture > threshold)
        // Let's set a fixed threshold at 50%
        const outD0 = m < 50 ? vcc : 0;

        this.setPinVoltage('A0', outA0);
        this.setPinVoltage('D0', outD0);
    }
}
