import { BaseComponent } from '../BaseComponent';

export class PhotoresistorLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {
            resistance: 10000,
            lux: parseFloat(manifest.attrs?.lux || '500')
        };
    }

    getConductance() {
        const lux = Math.max(0.1, parseFloat(this.attrs?.lux || '500'));
        const gamma = parseFloat(this.attrs?.gamma || '0.7');
        const r10 = parseFloat(this.attrs?.r10 || '10000');

        // R = R10 * (10 / Lux)^gamma
        const resistance = r10 * Math.pow(10 / lux, gamma);
        return 1 / resistance;
    }

    update() {
        // Conductance handles the electrical side in the solver.
        // We just update the state for UI/Telemetry.
        const lux = parseFloat(this.attrs?.lux || '500');
        const gamma = parseFloat(this.attrs?.gamma || '0.7');
        const r10 = parseFloat(this.attrs?.r10 || '10000');
        const resistance = r10 * Math.pow(10 / lux, gamma);

        this.setState({
            resistance,
            lux
        });
    }

    onCustomTelemetry() {
        this.setCustomTelemetry({
            lux: this.state.lux.toFixed(0) + ' lx',
            resistance: (this.state.resistance / 1000).toFixed(1) + ' kΩ'
        });
    }
}
