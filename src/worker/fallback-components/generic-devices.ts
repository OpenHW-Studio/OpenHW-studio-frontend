import { BaseComponent } from '@openhw/emulator';

export class GenericI2CDeviceLogic extends BaseComponent {
    private readonly address: number;
    private readonly readQueue: number[] = [];

    constructor(id: string, manifest: any) {
        super(id, manifest);

        const type = String(manifest?.type || '').toLowerCase();
        const defaultAddress = type === 'openhw-lcd2004-i2c'
            ? 0x27
            : type === 'max30102'
                ? 0x57
                : 0x3c;
        const rawAddress = Number(
            manifest?.attrs?.address
            ?? manifest?.attrs?.i2cAddress
            ?? manifest?.attrs?.addr
            ?? defaultAddress
        );
        this.address = Number.isFinite(rawAddress) ? (rawAddress & 0x7f) : defaultAddress;

        this.state = {
            ...this.state,
            i2cAddress: this.address,
            i2cRxBytes: 0,
            i2cTxBytes: 0,
            lastWrite: 0,
            lastRead: 0xff,
        };
    }

    onI2CStart(address: number, read: boolean): boolean {
        const ack = (address & 0x7f) === this.address;
        this.state.lastReadMode = !!read;
        this.stateChanged = true;
        return ack;
    }

    onI2CByte(_address: number, data: number): boolean {
        const byte = data & 0xff;
        this.state.lastWrite = byte;
        this.state.i2cRxBytes = Number(this.state.i2cRxBytes || 0) + 1;
        this.stateChanged = true;

        if (this.readQueue.length < 32) {
            this.readQueue.push(byte);
        }
        return true;
    }

    onI2CReadByte(): number {
        const byte = this.readQueue.length > 0
            ? this.readQueue.shift()!
            : Number(this.state.defaultReadByte ?? 0xff) & 0xff;
        this.state.lastRead = byte;
        this.state.i2cTxBytes = Number(this.state.i2cTxBytes || 0) + 1;
        this.stateChanged = true;
        return byte;
    }
}

export class GenericSPIDeviceLogic extends BaseComponent {
    onSPIByte(data: number): number {
        const byte = data & 0xff;
        this.state.lastWrite = byte;
        this.state.spiRxBytes = Number(this.state.spiRxBytes || 0) + 1;
        this.stateChanged = true;

        const response = Number(this.state.defaultReadByte ?? this.state.spiResponse ?? 0xff);
        return Number.isFinite(response) ? (response & 0xff) : 0xff;
    }
}
