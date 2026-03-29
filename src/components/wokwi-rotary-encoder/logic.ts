import { BaseComponent } from '../BaseComponent';

export class RotaryEncoderLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { rot: 0, sw: false };
    }

    onPinStateChange() {
        // In physical emulation, turning the knob triggers quadrature 
        // pulses on CLK/DT from the frontend/UI logic injecting state.
        // We act simply as a passive pin host until driven by the UI events.
    }
}
