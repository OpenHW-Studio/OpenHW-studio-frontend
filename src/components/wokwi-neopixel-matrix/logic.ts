import { BaseComponent } from '../BaseComponent';

export class NeopixelLogic extends BaseComponent {
    private numPixels: number;

    // WS2812 decoding state machine
    private lastEdgeTime: number = 0;
    private isHigh: boolean = false;
    private bitCount: number = 0;
    private currentByte: number = 0;
    private colors: number[] = [];
    private _pixels: number[] = [];

    constructor(id: string, manifest: any) {
        super(id, manifest);

        let cols = parseInt(manifest.attrs?.cols || '8', 10);
        let rows = parseInt(manifest.attrs?.rows || '8', 10);
        this.numPixels = cols * rows;

        // Initialize empty black pixels
        const initialPixels = new Array(this.numPixels).fill(0);
        this.state = { pixels: initialPixels };
        this._pixels = initialPixels;
    }

    setPinVoltage(pinId: string, voltage: number, cpuCycles?: number) {
        super.setPinVoltage(pinId, voltage, cpuCycles);

        if (pinId === 'DIN' && cpuCycles !== undefined) {
            const currentHigh = voltage > 2.5;

            if (currentHigh !== this.isHigh) {
                const timeDiff = cpuCycles - this.lastEdgeTime;

                if (!currentHigh) {
                    // Falling edge: analyze the HIGH pulse width
                    const bit = timeDiff > 9 ? 1 : 0;
                    this.currentByte = (this.currentByte << 1) | bit;
                    this.bitCount++;

                    if (this.bitCount === 8) {
                        this.colors.push(this.currentByte);
                        this.currentByte = 0;
                        this.bitCount = 0;
                    }
                } else {
                    // Rising edge: analyze the LOW pulse width (latch check)
                    if (timeDiff > 800 && this.colors.length > 0) {
                        this.latchPixels();
                    }
                }

                this.isHigh = currentHigh;
                this.lastEdgeTime = cpuCycles;
            }
        }
    }

    update(cpuCycles: number, currentWires: any[], allComponents: BaseComponent[]) {
        super.update(cpuCycles, currentWires, allComponents);

        // Latch if line has been kept low for > 50us without a new edge
        if (!this.isHigh && (cpuCycles - this.lastEdgeTime) > 800 && this.colors.length > 0) {
            this.latchPixels();
            this.lastEdgeTime = cpuCycles; // Prevent continuous latching
        }
    }

    private latchPixels() {
        let newPixels = [...this._pixels];
        let dirty = false;

        const maxLamps = Math.min(this.numPixels, Math.floor(this.colors.length / 3));

        for (let i = 0; i < maxLamps; i++) {
            // WS2812 protocol is GRB
            const g = this.colors[i * 3];
            const r = this.colors[i * 3 + 1];
            const b = this.colors[i * 3 + 2];

            const hexColor = (r << 16) | (g << 8) | b;

            if (newPixels[i] !== hexColor) {
                newPixels[i] = hexColor;
                dirty = true;
            }
        }

        if (dirty) {
            this._pixels = newPixels;
            this.state = { ...this.state, pixels: Object.values(newPixels) };
            this.stateChanged = true;
        }

        // Reset buffer for next frame
        this.colors = [];
        this.bitCount = 0;
        this.currentByte = 0;
    }
}
