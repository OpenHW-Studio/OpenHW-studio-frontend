import { BaseComponent } from '../BaseComponent';

export class RGBLEDLogic extends BaseComponent {
    private isAnode = false;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { r: 0, g: 0, b: 0 };
        this.isAnode = manifest.attrs?.common === 'anode';
    }

    onPinStateChange() {
        // RGB LED calculates intensity relative to common pin
        const commonIsAnode = this.isAnode;
        const comVolt = this.getPinVoltage('COM');

        let vr = this.getPinVoltage('R');
        let vg = this.getPinVoltage('G');
        let vb = this.getPinVoltage('B');

        let r = 0, g = 0, b = 0;

        if (commonIsAnode) { // Common is Anode (5V)
            r = Math.max(0, comVolt - vr);
            g = Math.max(0, comVolt - vg);
            b = Math.max(0, comVolt - vb);
        } else { // Common is Cathode (0V)
            r = Math.max(0, vr - comVolt);
            g = Math.max(0, vg - comVolt);
            b = Math.max(0, vb - comVolt);
        }

        // Map 0-5V to 0-255 RGB space
        this.state.r = Math.min(255, Math.max(0, Math.floor((r / 5.0) * 255)));
        this.state.g = Math.min(255, Math.max(0, Math.floor((g / 5.0) * 255)));
        this.state.b = Math.min(255, Math.max(0, Math.floor((b / 5.0) * 255)));

        this.stateChanged = true;
    }
}
