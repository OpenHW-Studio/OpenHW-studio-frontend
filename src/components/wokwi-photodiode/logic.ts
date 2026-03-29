import { BaseComponent } from '../BaseComponent';

export class PhotodiodeLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        // Default light lux level (0 = dark, 100 = bright)
        this.state = { light: 0 };
    }

    onPinStateChange() {
        const va = this.getPinVoltage('A');
        const vc = this.getPinVoltage('C');

        // Normal diode behavior in forward bias
        if (va > vc + 0.6) {
            this.setPinVoltage('C', Math.max(0, va - 0.7));
            return;
        }

        // Photodiode behavior in reverse bias
        // When reverse biased (V_C > V_A), it leaks current proportional to light.
        // We'll simulate this by lowering the resistance (allowing voltage to pass from C to A).
        if (vc > va) {
            const light = this.state.light; // 0 to 100
            // If light is 100, acts like a wire with low drop
            // If light is 0, completely blocks
            if (light > 0) {
                // Pass voltage from C to A based on light intensity
                this.setPinVoltage('A', (vc * light) / 100.0);
            } else {
                this.setPinVoltage('A', 0);
            }
        }
    }
}
