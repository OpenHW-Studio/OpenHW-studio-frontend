import { BaseComponent } from '../BaseComponent';

export class ShiftRegisterLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {
            shiftRegister: 0,
            storageRegister: 0
        };
    }
}
