import { BaseComponent } from '../BaseComponent';

export class Wokwi7SegmentLogic extends BaseComponent {
    private numDigits: number;
    private isAnode: boolean;
    private segmentsList = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'];

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.numDigits = parseInt(manifest.attrs?.digits || '1', 10);
        this.isAnode = manifest.attrs?.common === 'anode';
        
        this.state = this.getEmptyState();
    }

    private getEmptyState() {
        return {
            digits: Array(this.numDigits).fill(null).map(() => ({
                A: false, B: false, C: false, D: false, E: false, F: false, G: false, DP: false
            })),
            colon: false
        };
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        // Accumulate segment states over the 16.6ms simulation frame
        for (let i = 0; i < this.numDigits; i++) {
            const digPin = `DIG${i + 1}`;
            
            // Cathode: DIG pin LOW activates the digit. Anode: HIGH activates.
            const digActive = this.isAnode ? this.getPinVoltage(digPin) > 2.5 : this.getPinVoltage(digPin) < 2.5;

            if (digActive) {
                this.segmentsList.forEach(seg => {
                    const segVoltage = this.getPinVoltage(seg);
                    const segLit = this.isAnode ? segVoltage < 2.5 : segVoltage > 2.5;
                    
                    if (segLit) {
                        this.state.digits[i][seg] = true;
                        this.stateChanged = true;
                    }
                });
            }
        }

        // Handle Colon
        const colonVoltage = this.getPinVoltage('COLON');
        const colonLit = this.isAnode ? colonVoltage < 2.5 : colonVoltage > 2.5;
        if (colonLit) {
            this.state.colon = true;
            this.stateChanged = true;
        }
    }

    getSyncState() {
        // 1. Clone current accumulated state to send to UI
        const syncData = JSON.parse(JSON.stringify(this.state));
        
        // 2. Clear state for the next frame to prevent digits staying "stuck" on
        this.state = this.getEmptyState();
        
        return syncData;
    }
}