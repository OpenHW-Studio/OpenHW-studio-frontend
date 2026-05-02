import { BaseComponent } from '../BaseComponent';

export class NotGateLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { inputHigh: false, outputHigh: true };
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);

        const inputHigh = this.getPinVoltage('IN') >= 2.5;
        const outputHigh = !inputHigh;

        if (this.state.inputHigh !== inputHigh || this.state.outputHigh !== outputHigh) {
            this.state.inputHigh = inputHigh;
            this.state.outputHigh = outputHigh;
            this.stateChanged = true;
        }

        const outVoltage = outputHigh ? 5.0 : 0.0;
        const outPinKey = `${this.id}:OUT`;
        const visited = new Set<string>();
        visited.add(outPinKey);

        const propagate = (pinKey: string, voltage: number) => {
            for (const w of wires) {
                const match = w.from === pinKey || w.to === pinKey;
                if (!match) continue;
                const otherKey = w.from === pinKey ? w.to : w.from;
                if (visited.has(otherKey)) continue;
                visited.add(otherKey);

                const [compId, compPin] = otherKey.split(':');
                const inst = instances.find(i => i.id === compId);
                if (!inst) continue;

                if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: 'INPUT' };
                inst.setPinVoltage(compPin, voltage);

                if (inst.type === 'wokwi-resistor') {
                    const otherPin = compPin === 'p1' ? 'p2' : 'p1';
                    inst.setPinVoltage(otherPin, voltage);
                    const forwardKey = `${compId}:${otherPin}`;
                    if (!visited.has(forwardKey)) {
                        visited.add(forwardKey);
                        propagate(forwardKey, voltage);
                    }
                }
            }
        };

        propagate(outPinKey, outVoltage);
    }

    getPinVoltage(pinId: string): number {
        if (pinId === 'OUT') {
            return this.state.outputHigh ? 5.0 : 0.0;
        }
        return super.getPinVoltage(pinId);
    }
}
