export class BaseComponent {
    id: string;
    type: string;
    pins: { [key: string]: { voltage: number, mode: string } };
    state: any;
    stateChanged: boolean;

    constructor(id: string, manifest: any) {
        this.id = id;
        this.type = manifest.type;
        this.pins = {};

        // Initialize pins from manifest
        if (manifest.pins) {
            manifest.pins.forEach((pinSpec: any) => {
                this.pins[pinSpec.id] = {
                    voltage: 0,
                    mode: 'INPUT',
                };
            });
        }

        this.state = {};
        this.stateChanged = true;
    }

    setPinVoltage(pinId: string, voltage: number) {
        if (this.pins[pinId] && this.pins[pinId].voltage !== voltage) {
            this.pins[pinId].voltage = voltage;
            this.stateChanged = true;
        }
    }

    getPinVoltage(pinId: string): number {
        return this.pins[pinId] ? this.pins[pinId].voltage : 0.0;
    }

    update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
        // Override in subclasses
    }

    onEvent(event: any) {
        // Override in subclasses to handle UI interactions
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        // Override in subclasses
    }

    onI2CStart?(address: number, read: boolean): boolean;
    onI2CByte?(address: number, data: number): boolean;
    onI2CStop?(): void;

    onSPIByte?(data: number): number | void;

    setState(newState: any) {
        let changed = false;
        for (const key in newState) {
            if (this.state[key] !== newState[key]) {
                this.state[key] = newState[key];
                changed = true;
            }
        }
        if (changed) {
            this.stateChanged = true;
        }
    }

    getSyncState() {
        return this.state;
    }
}
