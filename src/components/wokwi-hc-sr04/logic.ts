import { BaseComponent } from '../BaseComponent';

export class HCSR04Logic extends BaseComponent {
    private lastTrigHigh = 0;
    private isEchoing = false;
    private echoEndCycle = 0;
    attrs: any;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.attrs = manifest.attrs || {};
        this.state = { distance: parseFloat(this.attrs.distance || '100') };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        if (pinId === 'TRIG') {
            if (isHigh) {
                this.lastTrigHigh = cpuCycles;
            } else if (this.lastTrigHigh > 0) {
                const trigDurationUs = (cpuCycles - this.lastTrigHigh) / 16;
                if (trigDurationUs >= 10) {
                    this.startEcho(cpuCycles);
                }
                this.lastTrigHigh = 0;
            }
        }
    }

    private startEcho(cpuCycles: number) {
        if (this.isEchoing) return;

        const distance = parseFloat(this.attrs?.distance || '100');
        const echoDurationUs = distance * 58;
        const echoDurationCycles = Math.floor(echoDurationUs * 16);

        this.isEchoing = true;
        this.echoEndCycle = cpuCycles + echoDurationCycles;
        this.setPinVoltage('ECHO', 5);
    }

    update(cpuCycles: number, wires: any[], instances: BaseComponent[]) {
        super.update(cpuCycles, wires, instances);

        if (this.isEchoing && cpuCycles >= this.echoEndCycle) {
            this.setPinVoltage('ECHO', 0);
            this.isEchoing = false;
        }
    }

    onCustomTelemetry() {
        const distance = parseFloat(this.attrs?.distance || '100');
        const echoDurationUs = distance * 58; // Speed of sound: 340 m/s
        
        this.setCustomTelemetry({
            configuredDistance: distance,
            echoDurationUs: Number(echoDurationUs.toFixed(1)),
            isEchoing: this.isEchoing,
            lastMeasurement: this.state.distance || distance,
        });
    }
}
