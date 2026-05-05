import { BaseComponent } from '../BaseComponent';

export class BuzzerLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { isBuzzing: false };
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);
        const v1 = this.getPinVoltage('1');
        const v2 = this.getPinVoltage('2');

        const vDiff = v1 - v2;
        const isBuzzing = vDiff > 2.0;

        this.setState({ 
            isBuzzing,
            voltageDrop: Math.max(0, vDiff),
            current: isBuzzing ? 0.015 : 0 // Typical buzzer is ~15mA
        });
    }

    onCustomTelemetry() {
        this.setCustomTelemetry({
            status: this.state.isBuzzing ? 'Buzzing' : 'Silent',
            voltageDrop: (this.state.voltageDrop || 0).toFixed(2) + ' V',
            current: ((this.state.current || 0) * 1000).toFixed(2) + ' mA'
        });
    }
}
