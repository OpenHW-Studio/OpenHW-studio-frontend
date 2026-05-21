import { BaseComponent, DigitalProtocol } from '@openhw/emulator';

function gateVoltage(isHigh: boolean): number {
    return isHigh ? 5.0 : 0.0;
}

function pinIsHigh(inst: BaseComponent, pinId: string): boolean {
    return !!inst?.pins?.[pinId]?.isHigh;
}

function setGateOutput(inst: BaseComponent, pinId: string, isHigh: boolean) {
    if (typeof inst?.setPinVoltage === 'function') {
        inst.setPinVoltage(pinId, gateVoltage(isHigh));
    }
    if (inst?.pins?.[pinId]) {
        inst.pins[pinId].isHigh = !!isHigh;
        inst.pins[pinId].voltage = gateVoltage(isHigh);
    }
}

export class NotGateLogic extends DigitalProtocol {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { ...this.state, out: true };
    }

    onPinEdge(pinId: string, isHigh: boolean) {
        const pin = String(pinId || '').toUpperCase();
        if (pin === 'IN' || pin === 'A' || pin === 'P1' || pin === '1') {
            const next = !isHigh;
            this.state.out = next;
            setGateOutput(this, 'OUT', next);
        }
    }
}

export class TwoInputGateLogic extends DigitalProtocol {
    protected evaluate(_a: boolean, _b: boolean): boolean {
        return false;
    }

    protected refreshOutput() {
        const a = pinIsHigh(this, 'A') || pinIsHigh(this, 'D0') || pinIsHigh(this, 'IN1') || pinIsHigh(this, '1') || pinIsHigh(this, 'p1');
        const b = pinIsHigh(this, 'B') || pinIsHigh(this, 'D1') || pinIsHigh(this, 'IN2') || pinIsHigh(this, '2') || pinIsHigh(this, 'p2');
        const next = this.evaluate(a, b);
        this.state.out = next;
        setGateOutput(this, 'OUT', next);
    }

    onPinEdge(pinId: string, isHigh: boolean) {
        const pin = String(pinId || '').toUpperCase();
        if (['A', 'B', 'D0', 'D1', 'IN1', 'IN2', '1', '2', 'P1', 'P2'].includes(pin)) {
            this.refreshOutput();
        }
    }
}

export class AndGateLogic extends TwoInputGateLogic {
    protected evaluate(a: boolean, b: boolean): boolean {
        return a && b;
    }
}

export class NandGateLogic extends TwoInputGateLogic {
    protected evaluate(a: boolean, b: boolean): boolean {
        return !(a && b);
    }
}

export class NorGateLogic extends TwoInputGateLogic {
    protected evaluate(a: boolean, b: boolean): boolean {
        return !(a || b);
    }
}

export class XorGateLogic extends TwoInputGateLogic {
    protected evaluate(a: boolean, b: boolean): boolean {
        return !!a !== !!b;
    }
}
