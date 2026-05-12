import { BaseComponent } from '../BaseComponent';

export class PushbuttonLogic extends BaseComponent {
    private pressCount = 0;
    private lastPressedState = false;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { pressed: false };
    }

    getMnaPins() { return ['1', '2']; }
    getConductance() { return this.state.pressed ? 1000 : 1e-9; }

    onEvent(event: string) {
        if (event === 'press') {
            this.setState({ pressed: true });
            if (!this.lastPressedState) {
                this.pressCount++;
                this.lastPressedState = true;
                this.stateChanged = true;
            }
            this.setPinVoltage('1', 0); // Ground the pin
            this.setPinVoltage('2', 0);
        } else if (event === 'release') {
            this.setState({ pressed: false });
            this.lastPressedState = false;
            this.stateChanged = true;
        }
    }

    onCustomTelemetry() {
        this.setCustomTelemetry({
            pressed: this.state.pressed,
            totalPresses: this.pressCount,
            conductance: this.state.pressed ? '~1kΩ' : '∞ (open)',
        });
    }
}
