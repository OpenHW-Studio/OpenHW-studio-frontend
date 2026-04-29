import { BaseComponent } from '../BaseComponent';

export class NeopixelRingLogic extends BaseComponent {
    private lastCycle = 0;
    private buffer: number[] = [];
    private currentBit = 0;
    private currentByte = 0;
    private pixelsCount = 16;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.pixelsCount = parseInt(manifest.attrs?.pixels || '16', 10);
        this.state = { pixels: Array(this.pixelsCount).fill(0) };
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

    onCustomTelemetry() {
        const pixels: number[] = this.state.pixels || [];
        let activeCount = 0;
        let sumR = 0, sumG = 0, sumB = 0;

        for (const p of pixels) {
            if (p > 0) {
                activeCount++;
                sumR += (p >> 16) & 0xff;
                sumG += (p >> 8) & 0xff;
                sumB += p & 0xff;
            }
        }

        const count = pixels.length || 1;
        const avgColor = `rgb(${Math.round(sumR / count)}, ${Math.round(sumG / count)}, ${Math.round(sumB / count)})`;
        const estPowerMa = (pixels.length * 1) + ((sumR + sumG + sumB) / 255.0) * 20;

        let pattern = 'Steady';
        const idleTime = this.getStateIdleMs();
        if (idleTime < 2000 && activeCount > 0) pattern = 'Blinking/Animated';

        this.setCustomTelemetry({
            activePixels: activeCount,
            totalPixels: pixels.length,
            averageColor: avgColor,
            estimatedPowerMa: Number(estPowerMa.toFixed(2)),
            pattern: activeCount === 0 ? 'Off' : pattern
        });
    }
}
