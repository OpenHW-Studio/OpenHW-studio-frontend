import { BaseComponent } from '../BaseComponent';

export class NeopixelLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { pixels: [] };
    }
}
