import { BaseComponent } from '../BaseComponent';

export class DFlipFlopLogic extends BaseComponent {
    private prevClk: boolean = false;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { d: false, clk: false, q: false, qbar: true };
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);

        const d = this.getPinVoltage('D') >= 2.5;
        const clk = this.getPinVoltage('CLK') >= 2.5;
        let q = this.state.q;
        let qbar = this.state.qbar;

        // Rising edge detection
        if (clk && !this.prevClk) {
            q = d;
            qbar = !d;
        }
        this.prevClk = clk;

        if (this.state.d !== d || this.state.clk !== clk || this.state.q !== q || this.state.qbar !== qbar) {
            this.state.d = d;
            this.state.clk = clk;
            this.state.q = q;
            this.state.qbar = qbar;
            this.stateChanged = true;
        }

        // Propagate Q output
        this.propagatePin('Q', q ? 5.0 : 0.0, wires, instances);
        // Propagate Qbar output
        this.propagatePin('Qbar', qbar ? 5.0 : 0.0, wires, instances);
    }

    private propagatePin(pinId: string, voltage: number, wires: any[], instances: BaseComponent[]) {
        const pinKey = `${this.id}:${pinId}`;
        const visited = new Set<string>();
        visited.add(pinKey);

        const propagate = (key: string, v: number) => {
            for (const w of wires) {
                const match = w.from === key || w.to === key;
                if (!match) continue;
                const otherKey = w.from === key ? w.to : w.from;
                if (visited.has(otherKey)) continue;
                visited.add(otherKey);

                const [compId, compPin] = otherKey.split(':');
                const inst = instances.find(i => i.id === compId);
                if (!inst) continue;

                if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: 'INPUT' };
                inst.setPinVoltage(compPin, v);

                if (inst.type === 'wokwi-resistor') {
                    const otherPin = compPin === 'p1' ? 'p2' : 'p1';
                    inst.setPinVoltage(otherPin, v);
                    const forwardKey = `${compId}:${otherPin}`;
                    if (!visited.has(forwardKey)) {
                        visited.add(forwardKey);
                        propagate(forwardKey, v);
                    }
                }
            }
        };

        propagate(pinKey, voltage);
    }

    getPinVoltage(pinId: string): number {
        if (pinId === 'Q') return this.state.q ? 5.0 : 0.0;
        if (pinId === 'Qbar') return this.state.qbar ? 5.0 : 0.0;
        return super.getPinVoltage(pinId);
    }
}
