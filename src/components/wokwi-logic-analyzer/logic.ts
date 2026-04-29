import { BaseComponent } from '../BaseComponent';

export class LogicAnalyzerLogic extends BaseComponent {
    private lastVal = 0;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { active: false };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        if (pinId.startsWith('D')) {
            let val = 0;
            for (let i = 0; i < 8; i++) {
                if (this.getPinVoltage(`D${i}`) > 2.5) {
                    val |= (1 << i);
                }
            }
            if (val !== this.lastVal) {
                // Signal change detected. Trigger UI indicator.
                this.state.active = true;
                this.stateChanged = true;
                this.lastVal = val;

                // Clear active flag shortly after to simulate pulse
                setTimeout(() => {
                    this.state.active = false;
                    this.stateChanged = true;
                }, 50);
            }
        }
    }
}
