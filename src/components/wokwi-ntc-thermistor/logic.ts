import { BaseComponent } from '../BaseComponent';

// NTC Thermistor Comparator Module
//
// Real hardware behaviour:
//   - A voltage divider: VCC → fixed resistor (10kΩ) → junction (A0) → NTC → GND
//   - A0 provides analog voltage.
//   - LM393 comparator compares A0 against a threshold set by the potentiometer.
//   - D0 outputs HIGH or LOW based on the comparison.

export class NTCThermistorLogic extends BaseComponent {
    private temperature:        number = 25;
    private nominalResistance:  number = 10000;
    private nominalTemperature: number = 25;
    private betaCoefficient:    number = 3950;
    private threshold:          number = 512; // 0-1023
    private readonly FIXED_R          = 10000;
    
    private powered: boolean = false;
    private transmitting: boolean = false;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.temperature        = parseFloat(manifest.attrs?.temperature        ?? '25');
        this.nominalResistance  = parseFloat(manifest.attrs?.nominalResistance  ?? '10000');
        this.nominalTemperature = parseFloat(manifest.attrs?.nominalTemperature ?? '25');
        this.betaCoefficient    = parseFloat(manifest.attrs?.betaCoefficient    ?? '3950');
        this.threshold          = parseFloat(manifest.attrs?.threshold          ?? '512');

        this.state = {
            temperature:  this.temperature,
            threshold:    this.threshold,
            powered:      false,
            transmitting: false,
        };
    }

    onEvent(event: any) {
        if (event.type === 'temperature-change' || event.type === 'temperature') {
            this.temperature = Math.max(-40, Math.min(125, parseFloat(event.value)));
            this.syncState();
        }
        if (event.type === 'threshold-change' || event.type === 'threshold') {
            this.threshold = Math.max(0, Math.min(1023, parseFloat(event.value)));
            this.syncState();
        }
        if (event.type === 'POT_CLICK') {
            // Simulate adjusting the potentiometer by decreasing threshold (wraps around)
            this.threshold = (this.threshold + 128) % 1024;
            this.syncState();
        }
    }

    update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
        const vcc = this.getPinVoltage('VCC');
        this.powered = vcc >= 2.0;

        if (this.powered) {
            const rNTC = this.calcResistance(this.temperature);
            // Voltage divider: VCC -> 10k -> A0 -> NTC -> GND
            const vout = vcc * rNTC / (this.FIXED_R + rNTC);
            this.setPinVoltage('A0', vout);
            
            // Comparator output
            // threshold voltage = VCC * (threshold / 1023)
            const vThreshold = vcc * (this.threshold / 1023);
            
            // Active Low: D0 drops to 0V when temperature goes ABOVE threshold (R_NTC drops)
            // Or typically module specific. We'll use active low for high temp.
            if (vout < vThreshold) {
                this.setPinVoltage('D0', 0);
                this.transmitting = true; // D0 LED on (usually lit when LOW trigger)
            } else {
                this.setPinVoltage('D0', vcc);
                this.transmitting = false;
            }
        } else {
            this.setPinVoltage('A0', 0);
            this.setPinVoltage('D0', 0);
            this.transmitting = false;
        }

        this.syncState();
    }

    calcResistance(tempC: number): number {
        const T  = tempC + 273.15;
        const T0 = this.nominalTemperature + 273.15;
        return Math.round(
            this.nominalResistance * Math.exp(this.betaCoefficient * (1 / T - 1 / T0))
        );
    }

    syncState() {
        this.setState({
            temperature:  this.temperature,
            threshold:    this.threshold,
            powered:      this.powered,
            transmitting: this.transmitting
        });
    }
}
