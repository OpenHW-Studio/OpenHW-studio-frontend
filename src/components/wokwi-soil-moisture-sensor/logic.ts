import { BaseComponent } from '../BaseComponent';

export class SoilMoistureSensorLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { moisture: 50 }; // Default 50%
    }

    onPinStateChange() {
        const vcc = this.getPinVoltage('VCC');
        if (vcc < 1.0) {
            this.setPinVoltage('SIG', 0);
            return;
        }

        const m = Math.max(0, Math.min(100, this.state.moisture));

        // Analog: VCC when dry, ~1.0V when completely submerged
        const dryVolt = vcc;
        const wetVolt = 1.0;
        const outSig = wetVolt + ((100 - m) / 100) * (dryVolt - wetVolt);

        this.setPinVoltage('SIG', outSig);
    }

    onCustomTelemetry() {
        const vcc = this.getPinVoltage('VCC');
        const sig = this.getPinVoltage('SIG');
        
        this.setCustomTelemetry({
            moisturePercent: Number(this.state.moisture.toFixed(1)),
            vccVoltage: Number(vcc.toFixed(2)),
            outputVoltage: Number(sig.toFixed(2)),
            sensorType: 'Capacitive Soil Moisture',
        });
    }
}
