import { BaseComponent } from '../BaseComponent';

export class ArduinoNanoLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
    }

    onPinStateChange() {
        // Logic handled intrinsically by the backend ATmega328P execution core interception.
    }
}
