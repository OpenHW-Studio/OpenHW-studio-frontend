import { BaseComponent } from '../BaseComponent';

export class ClockGeneratorLogic extends BaseComponent {
    private lastToggleTime: number = 0;
    private outputState: boolean = false;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { out: false };
    }

    private getFrequency(): number {
        let p = parseFloat(this.manifest?.attrs?.frequency) || 10;
        let u = this.manifest?.attrs?.units || 'KHz'; // Default to KHz as used mostly
        if (u === 'KHz' || u === 'kHz') p *= 1000;
        if (u === 'MHz') p *= 1000000;
        return p > 0 ? p : 1; // Prevent div by 0
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);

        const currentFreqHz = this.getFrequency();
        const periodNs = 1000000000 / currentFreqHz;
        const halfNs = periodNs / 2;

        if (time - this.lastToggleTime >= halfNs) {
            this.outputState = !this.outputState;
            // Catch-up logic to keep it somewhat stable if simulator stutters
            this.lastToggleTime += halfNs;
            if (time - this.lastToggleTime > periodNs * 2) {
                this.lastToggleTime = time; // Resync if fell too far behind
            }

            if (this.state.out !== this.outputState) {
                this.state.out = this.outputState;
                this.stateChanged = true;
            }
        }

        this.propagatePin('OUT', this.outputState ? 5.0 : 0.0, wires, instances);
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
        if (pinId === 'OUT') return this.outputState ? 5.0 : 0.0;
        return super.getPinVoltage(pinId);
    }
}
