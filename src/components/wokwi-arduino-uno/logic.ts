import { BaseComponent } from '../BaseComponent';

export class UnoLogic extends BaseComponent {
    private txTimeout: any = null;
    private rxTimeout: any = null;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {
            txActive: false,
            rxActive: false,
            ...this.state
        };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        // RX is pin 0, TX is pin 1
        if (pinId === '0') {
            this.setState({ rxActive: true });
            if (this.rxTimeout) clearTimeout(this.rxTimeout);
            this.rxTimeout = setTimeout(() => {
                this.setState({ rxActive: false });
                this.rxTimeout = null;
            }, 100);
        } else if (pinId === '1') {
            this.setState({ txActive: true });
            if (this.txTimeout) clearTimeout(this.txTimeout);
            this.txTimeout = setTimeout(() => {
                this.setState({ txActive: false });
                this.txTimeout = null;
            }, 100);
        }
    }

    update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
        // Nothing right now, pin states are driven directly by avr8js in the worker
    }
}
