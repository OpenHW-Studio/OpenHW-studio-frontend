import { BaseComponent } from '@openhw/emulator/src/components/BaseComponent.ts';

function samePin(pinId: string, expected: string) {
    return String(pinId || '').toUpperCase() === expected;
}

function parsePositiveInt(value: unknown): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export class NeopixelLogic extends BaseComponent {
    private edgeLastCycle = 0;
    private edgeCyclesPerUs = 16;

    private bitCount = 0;
    private byteValue = 0;
    private byteBuffer: number[] = [];

    private readonly wsBitOneThresholdUs = 0.55;
    private readonly wsResetThresholdUs = 45;

    private collectingFrame = true;

    private preferPulseDecoder = false;
    private preferSlotDecoder = false;
    private pendingHighUs: number | null = null;
    private lowUsAvg = 0;
    private lowUsSamples = 0;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { pixels: [] };
    }

    private getConfiguredPixelCount(): number {
        const rows = parsePositiveInt((this.state as any)?.rows);
        const cols = parsePositiveInt((this.state as any)?.cols);
        if (rows > 0 && cols > 0) {
            return rows * cols;
        }

        const namedCount =
            parsePositiveInt((this.state as any)?.numPixels)
            || parsePositiveInt((this.state as any)?.num_leds)
            || parsePositiveInt((this.state as any)?.leds);
        if (namedCount > 0) {
            return namedCount;
        }

        const existing = Array.isArray((this.state as any)?.pixels) ? (this.state as any).pixels.length : 0;
        if (existing > 0) {
            return existing;
        }

        const typeKey = String(this.type || '').toLowerCase();
        return typeKey.includes('matrix') ? 64 : 1;
    }

    private getExpectedFrameBytes(): number {
        const pixels = this.getConfiguredPixelCount();
        return pixels > 0 ? pixels * 3 : 0;
    }

    private resetFrameBuilder() {
        this.bitCount = 0;
        this.byteValue = 0;
        this.byteBuffer = [];
    }

    private pushBit(bit: number) {
        this.byteValue = ((this.byteValue << 1) | (bit ? 1 : 0)) & 0xff;
        this.bitCount += 1;

        if (this.bitCount >= 8) {
            this.byteBuffer.push(this.byteValue & 0xff);
            this.byteValue = 0;
            this.bitCount = 0;

            const expectedBytes = this.getExpectedFrameBytes();
            if (expectedBytes > 0 && this.byteBuffer.length >= expectedBytes) {
                this.flushPixels();
                this.collectingFrame = true;
            }
        }
    }

    private flushPixels() {
        const expectedBytes = this.getExpectedFrameBytes();
        const sourceBytes = expectedBytes > 0
            ? this.byteBuffer.slice(0, expectedBytes)
            : this.byteBuffer.slice();

        if (sourceBytes.length === 0 && expectedBytes <= 0) {
            this.resetFrameBuilder();
            return;
        }

        const pixelCount = expectedBytes > 0
            ? Math.floor(expectedBytes / 3)
            : Math.ceil(sourceBytes.length / 3);
        const pixels = new Array(pixelCount).fill(0);

        for (let i = 0; i < pixelCount; i++) {
            const base = i * 3;
            const g = sourceBytes[base] || 0;
            const r = sourceBytes[base + 1] || 0;
            const b = sourceBytes[base + 2] || 0;
            pixels[i] = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
        }

        this.state = {
            ...this.state,
            pixels,
        };
        this.stateChanged = true;
        this.resetFrameBuilder();
    }

    private handleResetWindow() {
        if (this.byteBuffer.length > 0) {
            this.flushPixels();
        } else {
            this.resetFrameBuilder();
        }

        this.collectingFrame = true;
        this.pendingHighUs = null;
    }

    private updateLowBaseline(lowUs: number) {
        if (!Number.isFinite(lowUs) || lowUs <= 0) return;

        if (this.lowUsSamples <= 0) {
            this.lowUsAvg = lowUs;
            this.lowUsSamples = 1;
            return;
        }

        // Ignore outliers (candidate reset pulses) when learning slot low-time baseline.
        if (lowUs > this.lowUsAvg * 4) {
            return;
        }

        const alpha = this.lowUsSamples < 32 ? 0.25 : 0.08;
        this.lowUsAvg = this.lowUsAvg * (1 - alpha) + lowUs * alpha;
        this.lowUsSamples += 1;
    }

    private isPulseReset(lowUs: number): boolean {
        if (!Number.isFinite(lowUs) || lowUs <= 0) return false;
        if (lowUs >= this.wsResetThresholdUs) return true;

        if (this.lowUsSamples >= 16 && this.lowUsAvg > 0 && lowUs > this.lowUsAvg * 12) {
            return true;
        }

        return false;
    }

    private decodePulseBit(highUs: number, lowUs: number): number | null {
        if (!Number.isFinite(highUs) || !Number.isFinite(lowUs) || highUs <= 0 || lowUs <= 0) {
            return null;
        }

        const ratio = highUs / (highUs + lowUs);
        if (!Number.isFinite(ratio)) return null;
        return ratio >= 0.42 ? 1 : 0;
    }

    private decodeEdgeFallback(isHigh: boolean, cpuCycles: number) {
        if (this.edgeLastCycle <= 0) {
            this.edgeLastCycle = cpuCycles;
            return;
        }

        const elapsed = cpuCycles - this.edgeLastCycle;
        this.edgeLastCycle = cpuCycles;

        const resetThresholdCycles = Math.max(300, this.edgeCyclesPerUs * this.wsResetThresholdUs);

        if (isHigh) {
            if (elapsed > resetThresholdCycles) {
                const estimated = elapsed / this.wsResetThresholdUs;
                if (Number.isFinite(estimated) && estimated >= 8 && estimated <= 512) {
                    this.edgeCyclesPerUs = estimated;
                }
                this.handleResetWindow();
            }
            return;
        }

        if (!this.collectingFrame) return;

        const bitOneThresholdCycles = Math.max(4, this.edgeCyclesPerUs * this.wsBitOneThresholdUs);
        const bit = elapsed >= bitOneThresholdCycles ? 1 : 0;
        this.pushBit(bit);
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        if (!samePin(pinId, 'DIN')) return;
        this.decodeEdgeFallback(isHigh, cpuCycles);
    }

    onPulseHigh(pinId: string, payload: any) {
        if (!samePin(pinId, 'DIN')) return;

        const highUs = Number(payload?.highUs ?? payload?.pulseUs ?? 0);
        if (!Number.isFinite(highUs) || highUs <= 0) return;

        this.preferPulseDecoder = true;
        this.pendingHighUs = highUs;
    }

    onPulseLow(pinId: string, payload: any) {
        if (!samePin(pinId, 'DIN')) return;
        if (this.preferSlotDecoder) return;

        const lowUs = Number(payload?.lowUs ?? payload?.pulseUs ?? 0);
        if (!Number.isFinite(lowUs) || lowUs <= 0) return;

        this.preferPulseDecoder = true;

        if (this.isPulseReset(lowUs)) {
            this.handleResetWindow();
            return;
        }

        this.updateLowBaseline(lowUs);

        if (!this.collectingFrame) return;

        const highUs = this.pendingHighUs;
        this.pendingHighUs = null;

        const bit = this.decodePulseBit(Number(highUs), lowUs);
        if (bit == null) return;
        this.pushBit(bit);
    }

    onOneWireReset(pinId: string) {
        if (!samePin(pinId, 'DIN')) return;
        if (this.preferPulseDecoder) return;
        this.handleResetWindow();
    }

    onOneWireWriteBit(pinId: string, bit: number) {
        void pinId;
        void bit;
    }

    onOneWireSlot(pinId: string, payload: any) {
        if (!samePin(pinId, 'DIN')) return;

        const lowUs = Number(payload?.pulseUs ?? payload?.lowUs ?? 0);
        if (!Number.isFinite(lowUs) || lowUs <= 0) return;

        this.preferPulseDecoder = true;
        this.preferSlotDecoder = true;

        if (this.isPulseReset(lowUs)) {
            this.handleResetWindow();
            return;
        }

        this.updateLowBaseline(lowUs);
        if (!this.collectingFrame) return;

        // WS2812 uses shorter LOW for bit=1 and longer LOW for bit=0.
        // Use adaptive threshold learned from observed slot lows, clamped to sane bounds.
        let thresholdUs = this.lowUsAvg > 0 ? this.lowUsAvg * 1.35 : 1.4;
        thresholdUs = Math.max(0.8, Math.min(3.0, thresholdUs));
        const bit = lowUs <= thresholdUs ? 1 : 0;
        this.pushBit(bit);
    }
}
