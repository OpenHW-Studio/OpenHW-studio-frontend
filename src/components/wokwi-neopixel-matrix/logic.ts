import { BaseComponent } from '../BaseComponent';

export class NeopixelLogic extends BaseComponent {
    private lastCycle = 0;
    private buffer: number[] = [];
    private currentBit = 0;
    private currentByte = 0;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { pixels: [] };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        if (pinId === 'DIN') {
            const elapsed = cpuCycles - this.lastCycle;
            this.lastCycle = cpuCycles;

            if (isHigh) {
                // Rising edge. The time spent LOW is `elapsed`.
                if (elapsed > 400) {
                    // Reset > 25us (400 cycles @ 16mhz)
                    if (this.buffer.length > 0) {
                        const pixels = [];
                        for (let i = 0; i < this.buffer.length; i += 3) {
                            const g = this.buffer[i] || 0;
                            const r = this.buffer[i + 1] || 0;
                            const b = this.buffer[i + 2] || 0;
                            pixels.push((r << 16) | (g << 8) | b);
                        }
                        this.state.pixels = pixels;
                        this.stateChanged = true;
                        this.buffer = [];
                    }
                    this.currentBit = 0;
                    this.currentByte = 0;
                }
            } else {
                // Falling edge. The time spent HIGH is `elapsed`.
                // A 0-bit is ~0.4us (6.4 cycles). A 1-bit is ~0.8us (12.8 cycles). Threshold 9:
                const bit = elapsed >= 9 ? 1 : 0;
                this.currentByte = (this.currentByte << 1) | bit;
                this.currentBit++;

                if (this.currentBit === 8) {
                    this.buffer.push(this.currentByte);
                    this.currentByte = 0;
                    this.currentBit = 0;
                }
            }
        }
    }
}
