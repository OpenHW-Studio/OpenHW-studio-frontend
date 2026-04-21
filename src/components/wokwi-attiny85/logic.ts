import { BaseComponent } from '../BaseComponent';

export class ATtiny85Logic extends BaseComponent {
    private ledTimeout: any = null;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {
            ledActive: false,
            ...this.state
        };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        // Built-in LED is on P1
        if (pinId === 'P1' || pinId === '1') {
            this.setState({ ledActive: isHigh });
        }
    }

    update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
        // CPU driven pins are handled by the core emulator
    }
}
