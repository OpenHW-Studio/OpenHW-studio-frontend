import { BaseComponent } from '../BaseComponent';

export class PushbuttonLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { pressed: false };
    }

    onEvent(event: string) {
        if (event === 'press') {
            this.setState({ pressed: true });
            this.setPinVoltage('1', 0); // Ground the pin
            this.setPinVoltage('2', 0);
        } else if (event === 'release') {
            this.setState({ pressed: false });
        }
    }
}
