import { BaseComponent } from '../BaseComponent';

export class LEDLogic extends BaseComponent {
    voltageDrop = 1.8;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {
            illuminated: false,
            brightness: 0,
            color: manifest.attrs?.color || 'red',
            burnedOut: false
        };
    }

    update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
        if (this.state.burnedOut) return;

        const vA = this.getPinVoltage('A');
        const vK = this.getPinVoltage('K');
        const voltageDiff = vA - vK;

        const myPins = [`${this.id}:A`, `${this.id}:K`];
        const isWired = currentWires.some(w => myPins.includes(w.from) || myPins.includes(w.to));

        const hasResistor = currentWires.some(w => {
            const otherSide = w.from.startsWith(this.id) ? w.to : (w.to.startsWith(this.id) ? w.from : null);
            if (!otherSide) return false;
            // Check if the other side of this wire is a resistor
            const compId = otherSide.split(':')[0];
            const comp = allComponentsInstances.find(c => c.id === compId);
            return comp && comp.manifest?.type === 'wokwi-resistor';
        });

        if (isWired && voltageDiff > 4.0 && !hasResistor) {
            this.setState({ illuminated: false, brightness: 0, burnedOut: true });
            return;
        }

        if (voltageDiff > this.voltageDrop) {
            this.setState({ illuminated: true, brightness: 255 });
        } else {
            this.setState({ illuminated: false, brightness: 0 });
        }
    }

    onCustomTelemetry() {
        let status = 'off';
        if (this.state.burnedOut) status = 'burnedOut';
        else if (this.state.illuminated && this.state.brightness > 200) status = 'fully lit';
        else if (this.state.illuminated) status = 'dim';

        this.setCustomTelemetry({
            status,
            color: this.state.color,
            brightness: this.state.brightness
        });
    }
}
