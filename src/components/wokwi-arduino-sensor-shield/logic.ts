import { BaseComponent } from '../BaseComponent';

export class SensorShieldLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
    }

    onPinStateChange() {
        // As a passive shield, it realistically relies on wires physically connecting nets.
        // The emulator handles standard routing through the user drawing physical wires to the S/V/G headers.
        // We act simply as a visual component where the pins are physically located for the frontend workspace.
    }
}
