import { BaseComponent } from '../BaseComponent';

// ── IC Definitions ──────────────────────────────────────────────────
// Each IC type defines its internal gate connections.
// For 2-input gates (AND, OR, etc.) the standard 74xx quad-gate DIP-14 pinout is:
//   Gate 1: inputs p1,p2  output p3
//   Gate 2: inputs p4,p5  output p6
//   Gate 3: inputs p10,p9 output p8
//   Gate 4: inputs p13,p12 output p11
// Pin 7 = GND, Pin 14 = VCC
//
// 7402 (NOR) has INVERTED pinout (output first):
//   Gate 1: output p1, inputs p2,p3
//   Gate 2: output p4, inputs p5,p6
//   Gate 3: output p10, inputs p8,p9
//   Gate 4: output p13, inputs p11,p12
//
// 7404 (NOT / Hex Inverter) has 6 single-input gates:
//   1A→1Y: p1→p2, 2A→2Y: p3→p4, 3A→3Y: p5→p6,
//   4A→4Y: p9→p8, 5A→5Y: p11→p10, 6A→6Y: p13→p12
//
// 7407 (Hex Buffer, open-collector) same pinout as 7404 but non-inverting.

interface GateDef {
    inputs: string[];
    output: string;
}

interface ICDef {
    label: string;
    gates: GateDef[];
    fn: (...args: boolean[]) => boolean;
}

const IC_DEFINITIONS: Record<string, ICDef> = {
    '7400': {
        label: '74LS00 (NAND)',
        gates: [
            { inputs: ['p1', 'p2'], output: 'p3' },
            { inputs: ['p4', 'p5'], output: 'p6' },
            { inputs: ['p10', 'p9'], output: 'p8' },
            { inputs: ['p13', 'p12'], output: 'p11' },
        ],
        fn: (a: boolean, b: boolean) => !(a && b),
    },
    '7402': {
        label: '74LS02 (NOR)',
        gates: [
            { inputs: ['p2', 'p3'], output: 'p1' },
            { inputs: ['p5', 'p6'], output: 'p4' },
            { inputs: ['p8', 'p9'], output: 'p10' },
            { inputs: ['p11', 'p12'], output: 'p13' },
        ],
        fn: (a: boolean, b: boolean) => !(a || b),
    },
    '7404': {
        label: '74LS04 (NOT)',
        gates: [
            { inputs: ['p1'], output: 'p2' },
            { inputs: ['p3'], output: 'p4' },
            { inputs: ['p5'], output: 'p6' },
            { inputs: ['p9'], output: 'p8' },
            { inputs: ['p11'], output: 'p10' },
            { inputs: ['p13'], output: 'p12' },
        ],
        fn: (a: boolean) => !a,
    },
    '7407': {
        label: '74LS07 (Buffer)',
        gates: [
            { inputs: ['p1'], output: 'p2' },
            { inputs: ['p3'], output: 'p4' },
            { inputs: ['p5'], output: 'p6' },
            { inputs: ['p9'], output: 'p8' },
            { inputs: ['p11'], output: 'p10' },
            { inputs: ['p13'], output: 'p12' },
        ],
        fn: (a: boolean) => a,
    },
    '7408': {
        label: '74LS08 (AND)',
        gates: [
            { inputs: ['p1', 'p2'], output: 'p3' },
            { inputs: ['p4', 'p5'], output: 'p6' },
            { inputs: ['p10', 'p9'], output: 'p8' },
            { inputs: ['p13', 'p12'], output: 'p11' },
        ],
        fn: (a: boolean, b: boolean) => a && b,
    },
    '7432': {
        label: '74LS32 (OR)',
        gates: [
            { inputs: ['p1', 'p2'], output: 'p3' },
            { inputs: ['p4', 'p5'], output: 'p6' },
            { inputs: ['p10', 'p9'], output: 'p8' },
            { inputs: ['p13', 'p12'], output: 'p11' },
        ],
        fn: (a: boolean, b: boolean) => a || b,
    },
    '7486': {
        label: '74LS86 (XOR)',
        gates: [
            { inputs: ['p1', 'p2'], output: 'p3' },
            { inputs: ['p4', 'p5'], output: 'p6' },
            { inputs: ['p10', 'p9'], output: 'p8' },
            { inputs: ['p13', 'p12'], output: 'p11' },
        ],
        fn: (a: boolean, b: boolean) => a !== b,
    },
    '74266': {
        label: '74LS266 (XNOR)',
        gates: [
            { inputs: ['p1', 'p2'], output: 'p3' },
            { inputs: ['p4', 'p5'], output: 'p6' },
            { inputs: ['p10', 'p9'], output: 'p8' },
            { inputs: ['p13', 'p12'], output: 'p11' },
        ],
        fn: (a: boolean, b: boolean) => a === b,
    },
};

export { IC_DEFINITIONS };

export class LogicIC74xxLogic extends BaseComponent {
    private prevOutputs: Record<string, boolean> = {};

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { icType: '7408', outputs: {} as Record<string, boolean> };
    }

    private getICType(): string {
        // Read from attrs that may be updated via ContextMenu
        return (this as any).manifest?.attrs?.icType || this.state.icType || '7408';
    }

    update(time: number, wires: any[], instances: BaseComponent[]) {
        super.update(time, wires, instances);

        const icType = this.getICType();
        const def = IC_DEFINITIONS[icType];
        if (!def) return;

        // Check VCC and GND
        const vcc = this.getPinVoltage('p14');
        const gnd = this.getPinVoltage('p7');

        // IC needs power to work: VCC should be high, GND should be low
        const powered = vcc >= 2.5 && gnd < 2.5;

        const newOutputs: Record<string, boolean> = {};
        let changed = false;

        for (const gate of def.gates) {
            const inputValues = gate.inputs.map(pin => this.getPinVoltage(pin) >= 2.5);
            const result = powered ? def.fn(...inputValues) : false;
            newOutputs[gate.output] = result;

            if (this.prevOutputs[gate.output] !== result) {
                changed = true;
            }

            // Propagate the output voltage
            const outVoltage = result ? 5.0 : 0.0;
            this.propagatePin(gate.output, outVoltage, wires, instances);
        }

        if (changed) {
            this.prevOutputs = { ...newOutputs };
            this.state.outputs = newOutputs;
            this.state.icType = icType;
            this.stateChanged = true;
        }
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
        // If this pin is an output of a gate, return the computed value
        const icType = this.getICType();
        const def = IC_DEFINITIONS[icType];
        if (def) {
            for (const gate of def.gates) {
                if (gate.output === pinId) {
                    return this.prevOutputs[pinId] ? 5.0 : 0.0;
                }
            }
        }
        return super.getPinVoltage(pinId);
    }
}
