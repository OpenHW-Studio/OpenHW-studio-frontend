import { BaseComponent } from '../BaseComponent';

export class JoystickLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        // Default to center (0.5, 0.5) and not pressed
        this.state = { x: 0.5, y: 0.5, pressed: false };
    }

    onEvent(event: string | any) {
        if (typeof event === 'string') {
            if (event === 'press') {
                this.setState({ pressed: true });
            } else if (event === 'release') {
                this.setState({ pressed: false });
            }
        } else if (typeof event === 'object' && event.type === 'move') {
            this.setState({ x: event.x, y: event.y });
        }
    }

    update() {
        // VRX and VRY output voltage based on x and y (0.0 to 1.0)
        // Usually, connected to 5V, so voltage is proportion of '5V' pin voltage or just 5V constant
        const vcc = this.getPinVoltage('5V') || 5.0; // fallback to 5.0 if not fully powered but simulating
        const gnd = this.getPinVoltage('GND') || 0.0;

        const vx = gnd + this.state.x * (vcc - gnd);
        const vy = gnd + this.state.y * (vcc - gnd);

        this.setPinVoltage('VRX', vx);
        this.setPinVoltage('VRY', vy);
    }

    onCustomTelemetry() {
        this.setCustomTelemetry({
            position: `(${this.state.x.toFixed(2)}, ${this.state.y.toFixed(2)})`,
            buttonPressed: !!this.state.pressed,
            vrxVoltage: Number((this.getPinVoltage('VRX') || 0).toFixed(2)),
            vryVoltage: Number((this.getPinVoltage('VRY') || 0).toFixed(2))
        });
    }
}
