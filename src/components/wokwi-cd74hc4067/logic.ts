import { BaseComponent } from '../BaseComponent';

export class CD74HC4067Logic extends BaseComponent {
    private lastAddr = -1;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { activeChannel: -1 };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        const en = this.getPinVoltage('EN') < 2.5; // active low

        if (!en) {
            this.state.activeChannel = -1;
            this.lastAddr = -1;
            this.stateChanged = true;
            // Best effort clear outputs
            for (let i = 0; i < 16; i++) {
                this.setPinVoltage(`C${i}`, 0);
            }
            return;
        }

        const s0 = this.getPinVoltage('S0') > 2.5 ? 1 : 0;
        const s1 = this.getPinVoltage('S1') > 2.5 ? 1 : 0;
        const s2 = this.getPinVoltage('S2') > 2.5 ? 1 : 0;
        const s3 = this.getPinVoltage('S3') > 2.5 ? 1 : 0;
        const addr = s0 | (s1 << 1) | (s2 << 2) | (s3 << 3);

        const sigVolt = this.getPinVoltage('SIG');
        const cVolt = this.getPinVoltage(`C${addr}`);

        if (this.lastAddr !== addr) {
            // Address changed, clear old channel
            if (this.lastAddr !== -1) {
                this.setPinVoltage(`C${this.lastAddr}`, 0);
            }
            this.lastAddr = addr;
            this.state.activeChannel = addr;
            this.stateChanged = true;

            // Pass through current state
            if (sigVolt > 0) this.setPinVoltage(`C${addr}`, sigVolt);
            else this.setPinVoltage('SIG', cVolt);
        } else {
            // Address is same, pass through updated pin
            if (pinId === 'SIG') {
                this.setPinVoltage(`C${addr}`, sigVolt);
            } else if (pinId === `C${addr}`) {
                this.setPinVoltage('SIG', cVolt);
            }
        }
    }

    onCustomTelemetry() {
        const enabled = this.getPinVoltage('EN') < 2.5;
        const activeChannel = enabled ? this.state.activeChannel : -1;
        const sigVolt = this.getPinVoltage('SIG');

        this.setCustomTelemetry({
            enabled: enabled,
            activeChannel: activeChannel >= 0 ? activeChannel : 'disabled',
            signalVoltage: Number(sigVolt.toFixed(2)),
            addressPins: 's0 s1 s2 s3 (binary select)',
            type: '16-channel analog multiplexer',
        });
    }
}
