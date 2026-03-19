import { BaseComponent } from '../BaseComponent';

export class LdrModuleLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        // Sync initial attributes to state
        this.state = {
            lux: manifest.attrs?.lux ?? 500,
            threshold: manifest.attrs?.threshold ?? 500,
            pwrLed: false,
            doLed: false
        };
    }

    // This handles updates from the Context Menu's onUpdate call
    onEvent(event: any) {
        if (event.type === 'SET_ATTR') {
            this.state[event.key] = event.value;
            this.stateChanged = true;
        }
    }

    update() {
        const vcc = this.getPinVoltage('VCC');
        const gnd = this.getPinVoltage('GND');

        if (vcc > 2.0 && gnd < 1.0) {
            this.state.pwrLed = true;

            // Analog Output (AO): 0 Lux = 0V, 1000 Lux = VCC
            const aoVoltage = vcc * (this.state.lux / 1000);
            this.setPinVoltage('AO', aoVoltage);

            // Digital Output (DO): High if Lux > Threshold
            const thresholdVolts = vcc * (this.state.threshold / 1000);
            const isHigh = aoVoltage > thresholdVolts;

            this.setPinVoltage('DO', isHigh ? vcc : 0);
            this.state.doLed = isHigh;
            this.stateChanged = true;
        } else {
            this.state.pwrLed = false;
            this.state.doLed = false;
            this.setPinVoltage('AO', 0);
            this.setPinVoltage('DO', 0);
            this.stateChanged = true;
        }
    }

    getSyncState() {
        return { ...this.state };
    }
}