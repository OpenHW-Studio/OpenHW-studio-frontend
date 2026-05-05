import { BaseComponent } from '../BaseComponent';

export class PotentiometerLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { value: 50 };
    }

    getMnaStamps() {
        const val = Number(this.state.value) || 0;
        const totalR = 10000;
        const r1 = Math.max(0.1, totalR * (val / 100.0));
        const r2 = Math.max(0.1, totalR * (1 - val / 100.0));
        return [
            { pins: ['1', 'SIG'], g: 1 / r1 },
            { pins: ['2', 'SIG'], g: 1 / r2 }
        ];
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);
        let val = Number(this.state.value) || 0;

        const v1 = this.getPinVoltage('VCC') || this.getPinVoltage('1');
        const v2 = this.getPinVoltage('GND') || this.getPinVoltage('2');

        const sigV = v1 + (v2 - v1) * (val / 100.0);
        this.setPinVoltage('SIG', sigV);
    }

    onCustomTelemetry() {
        const val = Number(this.state.value) || 0;
        const v1 = this.getPinVoltage('VCC') || this.getPinVoltage('1');
        const v2 = this.getPinVoltage('GND') || this.getPinVoltage('2');
        const sigV = v1 + (v2 - v1) * (val / 100.0);

        this.setCustomTelemetry({
            resistanceRatio: Number((val / 100.0).toFixed(4)),
            signalVoltage: Number(sigV.toFixed(4)),
        });
    }

    getSyncState() {
        return { value: this.state.value };
    }

    onEvent(event: any) {
        if (event && event.type === 'input' && event.value !== undefined) {
            this.state.value = event.value;
            this.stateChanged = true;
        }
    }
}
