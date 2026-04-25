import { BaseComponent } from '../BaseComponent';

export class HCSR04Logic extends BaseComponent {
    private lastTrigHigh = 0;
    private echoStartCycle = 0;
    private echoEndCycle = 0;
    private isEchoing = false;
    private echoStarted = false;
    attrs: any;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.attrs = manifest.attrs || {};
        this.state = {
            distance: parseFloat(this.attrs.distance || '100')
        };
        // Explicitly set ECHO as OUTPUT mode to ensure it can drive the wire
        if (this.pins['ECHO']) {
            this.pins['ECHO'].mode = 'OUTPUT';
        }
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        if (pinId === 'TRIG') {
            if (isHigh) {
                this.lastTrigHigh = cpuCycles;
            } else if (this.lastTrigHigh > 0) {
                const trigDurationUs = (cpuCycles - this.lastTrigHigh) / 16;
                // Standard HC-SR04 needs at least 10us TRIG pulse
                if (trigDurationUs >= 10) {
                    this.startEcho(cpuCycles);
                }
                this.lastTrigHigh = 0;
            }
        }
    }

    onEvent(event: any) {
        if (event.type === 'SET_ATTR' && event.key === 'distance') {
            const val = parseFloat(event.value);
            if (!isNaN(val)) {
                this.state.distance = val;
                this.stateChanged = true;
            }
        }
    }

    private startEcho(cpuCycles: number) {
        if (this.isEchoing) return;

        // Use the reactive state distance
        const distance = this.state.distance ?? parseFloat(this.attrs?.distance || '100');
        const echoDurationUs = distance * 58;
        const echoDurationCycles = Math.floor(echoDurationUs * 16);

        // Standard HC-SR04 has a small internal processing delay before Echo starts
        // We add a 50us delay to ensure Arduino's pulseIn is fully ready for the rising edge
        const startDelayCycles = 50 * 16;

        this.isEchoing = true;
        this.echoStarted = false;
        this.echoStartCycle = cpuCycles + startDelayCycles;
        this.echoEndCycle = this.echoStartCycle + echoDurationCycles;
    }

    update(cpuCycles: number, wires: any[], instances: BaseComponent[]) {
        super.update(cpuCycles, wires, instances);

        if (!this.isEchoing) return;

        // Wait until the delay cycle is reached to set ECHO HIGH
        if (!this.echoStarted && cpuCycles >= this.echoStartCycle) {
            this.setPinVoltage('ECHO', 5);
            this.echoStarted = true;
        }

        // Wait until the end cycle is reached to set ECHO LOW
        if (this.echoStarted && cpuCycles >= this.echoEndCycle) {
            this.setPinVoltage('ECHO', 0);
            this.isEchoing = false;
            this.echoStarted = false;
        }
    }
}
