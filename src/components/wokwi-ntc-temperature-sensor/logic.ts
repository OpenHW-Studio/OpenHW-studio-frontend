import { BaseComponent } from '../BaseComponent';

export class NtcLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {
            resistance: 10000,
            temperature: parseFloat(manifest.attrs?.temperature || '25')
        };
    }

    getConductance() {
        const tempC = parseFloat(this.attrs?.temperature || '25');
        const beta = parseFloat(this.attrs?.beta || '3950');
        const r25 = parseFloat(this.attrs?.r25 || '10000');

        const tempK = tempC + 273.15;
        const t0K = 25 + 273.15;

        // R = R25 * exp(Beta * (1/T - 1/T0))
        const resistance = r25 * Math.exp(beta * (1 / tempK - 1 / t0K));
        return 1 / resistance;
    }

    update() {
        const tempC = parseFloat(this.attrs?.temperature || '25');
        const beta = parseFloat(this.attrs?.beta || '3950');
        const r25 = parseFloat(this.attrs?.r25 || '10000');
        
        const tempK = tempC + 273.15;
        const t0K = 25 + 273.15;
        const resistance = r25 * Math.exp(beta * (1 / tempK - 1 / t0K));

        this.setState({
            resistance,
            temperature: tempC
        });
    }

    onCustomTelemetry() {
        this.setCustomTelemetry({
            temperature: this.state.temperature.toFixed(1) + ' °C',
            resistance: (this.state.resistance / 1000).toFixed(1) + ' kΩ'
        });
    }
}
