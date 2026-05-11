import { BaseComponent } from '../BaseComponent';

// Relay Module (single channel, 5V active-LOW trigger)
//
// Real hardware behaviour:
//   - Control pin (IN) is ACTIVE LOW by default (most relay modules)
//   - When IN is LOW (or pulled LOW by Arduino): relay ENERGISED → COM connects to NO
//   - When IN is HIGH (or floating): relay DE-ENERGISED → COM connects to NC
//   - Coil draws ~70mA — must be powered by VCC/GND, NOT directly from Arduino 5V pin
//
// Arduino sketch:
//   pinMode(7, OUTPUT);
//   digitalWrite(7, LOW);  // relay ON  (active-low)
//   digitalWrite(7, HIGH); // relay OFF

export class RelayModuleLogic extends BaseComponent {
    private energised: boolean = false;
    private triggerLevel: string = 'low'; // 'low' | 'high'

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.triggerLevel = manifest.attrs?.triggerLevel ?? 'low';
        this.state = {
            energised: false,
            ledOn:     false,
        };
    }

    onEvent(event: any) {
        if (event.type === 'relay-toggle') {
            this.energised = !this.energised;
            this.setState({ energised: this.energised, ledOn: this.energised });
        }
    }

    update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
        const vcc = this.getPinVoltage('VCC');
        const inp = this.getPinVoltage('IN');

        if (vcc < 2.5) {
            // Not powered
            this.energised = false;
            this.setState({ energised: false, ledOn: false });
            return;
        }

        // Determine energised state based on trigger level
        if (this.triggerLevel === 'low') {
            // Active LOW: energised when IN is pulled LOW (< 1V)
            this.energised = inp < 1.0;
        } else {
            // Active HIGH: energised when IN is HIGH (> 2.5V)
            this.energised = inp > 2.5;
        }

        // When energised: COM connects to NO, break from NC
        // Propagate voltage through COM→NO path
        if (this.energised) {
            const comV = this.getPinVoltage('COM');
            // NO not defined in simplified manifest but logic is tracked via state
        }

        this.setState({ energised: this.energised, ledOn: this.energised });
    }
}
