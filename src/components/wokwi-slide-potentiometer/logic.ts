import { BaseComponent } from '../BaseComponent';

export class SlidePotLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { value: 50 };
        ['VCC', 'GND', 'SIG'].forEach(p => {
            if (!this.pins[p]) this.pins[p] = { voltage: 0, mode: 'INPUT' };
        });
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);
        let val = Number(this.state.value) || 0;
        let vcc = this.getPinVoltage('VCC');
        let gnd = this.getPinVoltage('GND');

        wires.forEach(w => {
            if (w.from === `${this.id}:VCC` || w.to === `${this.id}:VCC`) {
                const other = w.from === `${this.id}:VCC` ? w.to : w.from;
                const pk = other.toLowerCase();
                if (pk.endsWith(':5v') || pk.endsWith(':vcc')) vcc = 5.0;
                if (pk.endsWith(':3.3v') || pk.endsWith(':3v3')) vcc = 3.3;
                if (pk.includes(':gnd')) vcc = 0.0;
            }
            if (w.from === `${this.id}:GND` || w.to === `${this.id}:GND`) {
                const other = w.from === `${this.id}:GND` ? w.to : w.from;
                const pk = other.toLowerCase();
                if (pk.endsWith(':5v') || pk.endsWith(':vcc')) gnd = 5.0;
                if (pk.endsWith(':3.3v') || pk.endsWith(':3v3')) gnd = 3.3;
                if (pk.includes(':gnd')) gnd = 0.0;
            }
        });

        const sigV = gnd + (vcc - gnd) * (val / 100.0);
        this.setPinVoltage('SIG', sigV);
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
