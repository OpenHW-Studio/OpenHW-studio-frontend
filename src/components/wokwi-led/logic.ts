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

        let directTo5V = false;
        let connectedToResistor = false;

        if (isWired) {
            currentWires.forEach(w => {
                if (myPins.includes(w.from) || myPins.includes(w.to)) {
                    if (w.from.includes('5V') || w.to.includes('5V')) directTo5V = true;
                    if (w.from.includes('wokwi-resistor') || w.to.includes('wokwi-resistor')) connectedToResistor = true;
                }
            });
        }

        if (isWired && directTo5V && !connectedToResistor) {
            this.setState({ illuminated: false, brightness: 0, burnedOut: true });
            return;
        }

        if (voltageDiff > this.voltageDrop) {
            this.setState({ illuminated: true, brightness: 255 });
        } else {
            this.setState({ illuminated: false, brightness: 0 });
        }
    }
}
