import { BaseComponent } from '../BaseComponent';

export class PotentiometerLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { value: 50 };
        // Ensure pins exist even if not in manifest
        ['1', '2', 'SIG'].forEach(p => {
            if (!this.pins[p]) this.pins[p] = { voltage: 0, mode: 'INPUT' };
        });
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);
        let val = Number(this.state.value) || 0;

        let v1 = this.getPinVoltage('1');
        let v2 = this.getPinVoltage('2');

        // Check if v1 or v2 is wired to 5V or 3.3V or GND
        wires.forEach(w => {
            if (w.from === `${this.id}:1` || w.to === `${this.id}:1`) {
                const other = w.from === `${this.id}:1` ? w.to : w.from;
                const pk = other.toLowerCase();
                if (pk.endsWith(':5v') || pk.endsWith(':vcc')) v1 = 5.0;
                if (pk.endsWith(':3.3v') || pk.endsWith(':3v3')) v1 = 3.3;
                if (pk.includes(':gnd')) v1 = 0.0;
            }
            if (w.from === `${this.id}:2` || w.to === `${this.id}:2`) {
                const other = w.from === `${this.id}:2` ? w.to : w.from;
                const pk = other.toLowerCase();
                if (pk.endsWith(':5v') || pk.endsWith(':vcc')) v2 = 5.0;
                if (pk.endsWith(':3.3v') || pk.endsWith(':3v3')) v2 = 3.3;
                if (pk.includes(':gnd')) v2 = 0.0;
            }
        });

        const sigV = v1 + (v2 - v1) * (val / 100.0);
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
