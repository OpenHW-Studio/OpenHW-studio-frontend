import { BaseComponent } from "../BaseComponent";
export class ServoLogic extends BaseComponent {
    private lastEdgeTime: number = 0;
    private isHigh: boolean = false;
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { angle: 90 };
        ["PWM", "V+", "GND"].forEach(p => {
            if (!this.pins[p]) this.pins[p] = { voltage: 0, mode: "INPUT" };
        });
    }
    setPinVoltage(pinId: string, voltage: number, cpuCycles?: number) {
        super.setPinVoltage(pinId, voltage, cpuCycles);
        if (pinId === "PWM" && cpuCycles !== undefined) {
            const currentHigh = voltage > 2.5;
            if (currentHigh !== this.isHigh) {
                if (currentHigh) {
                    this.lastEdgeTime = cpuCycles;
                } else {
                    const pulseLengthTicks = cpuCycles - this.lastEdgeTime;
                    const minPulse = 8704;
                    const maxPulse = 38400;
                    if (pulseLengthTicks >= 5000 && pulseLengthTicks <= 45000) {
                        const clamped = Math.max(minPulse, Math.min(pulseLengthTicks, maxPulse));
                        const percent = (clamped - minPulse) / (maxPulse - minPulse);
                        const angle = Math.round(percent * 180);
                        if (this.state.angle !== angle) {
                            this.state.angle = angle;
                            this.stateChanged = true;
                        }
                    }
                }
                this.isHigh = currentHigh;
            }
        }
    }
}
