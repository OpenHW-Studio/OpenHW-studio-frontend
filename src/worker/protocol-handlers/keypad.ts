import { BaseComponent } from '@openhw/emulator';

export class KeypadLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { pressedKey: null, connectedPair: null };
    }
    // Electrical short: when firmware drives the pressed row LOW, pull the
    // pressed column LOW on the AVR pin so matrix scans observe it. The
    // net-level bridge is not enough — digitalRead samples the AVR PIN
    // register, which only moves via board-pin drive (same _drivingBus
    // contract as DHT22/OneWire).
    // Change-gated: driveInput synchronously re-runs repropagate, which
    // re-delivers row levels back into onPinStateChange. Driving on every
    // notification would recurse (drive→repropagate→notify→drive) until
    // stack overflow kills the run loop. Drive only on level change.
    private refreshColumnDrive() {
        try {
            const pair = (this as any).state?.connectedPair;
            const netOf = (this as any)._boardNetOf;
            const drive = (this as any)._driveBoardPin;
            const direct = (this as any)._setAvrPinDirect;
            if (!pair) return;
            if (typeof netOf !== 'function') return;
            const rowBoard = netOf(pair[0]);
            const colBoard = netOf(pair[1]);
            if (!rowBoard || !colBoard) return;
            const rowLow = this.getPinVoltage(pair[0]) < 1.8;
            const wantHigh = !rowLow;
            const last = (this as any)._lastColDrive;
            if (last && last.pin === colBoard && last.high === wantHigh) return;
            (this as any)._lastColDrive = { pin: colBoard, high: wantHigh };
            (this as any)._drivingBus = true;
            (this as any)._lastDrivenVoltage = rowLow ? 0.0 : 5.0;
            if (typeof drive === 'function') drive(colBoard, !rowLow);
            else if (typeof direct === 'function') direct(colBoard, !rowLow);
        } catch { /* drive never breaks sim */ }
    }
    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number): void {
        try {
            const u = String(pinId || '').toUpperCase();
            if (u.startsWith('R')) this.refreshColumnDrive();
        } catch { /* ignore */ }
    }
    // Runner repropagate sustain: the periodic input-pin sweep drives the
    // AVR pin from _lastDrivenVoltage for components exposing this method
    // (same contract as DHT22). Returns the pressed column's board pin.
    private getConnectedBoardPin(): string | null {
        try {
            const pair = (this as any).state?.connectedPair;
            const netOf = (this as any)._boardNetOf;
            if (!pair || typeof netOf !== 'function') return null;
            return netOf(pair[1]);
        } catch { return null; }
    }
    private getBoardPin(): string | null {
        try { return (this as any).getConnectedBoardPin?.() ?? null; } catch { return null; }
    }
    onEvent(event: string) {
        if (event.startsWith('press:')) {
            const key = event.split(':')[1];
            const matrix: Record<string, [string, string]> = {
                '1': ['R1', 'C1'], '2': ['R1', 'C2'], '3': ['R1', 'C3'], 'A': ['R1', 'C4'],
                '4': ['R2', 'C1'], '5': ['R2', 'C2'], '6': ['R2', 'C3'], 'B': ['R2', 'C4'],
                '7': ['R3', 'C1'], '8': ['R3', 'C2'], '9': ['R3', 'C3'], 'C': ['R3', 'C4'],
                '*': ['R4', 'C1'], '0': ['R4', 'C2'], '#': ['R4', 'C3'], 'D': ['R4', 'C4']
            };
            this.setState({ pressedKey: key, connectedPair: matrix[key] || null });
            this.refreshColumnDrive();
        } else if (event === 'release') {
            try {
                const pair = (this as any).state?.connectedPair;
                const netOf = (this as any)._boardNetOf;
                const drive = (this as any)._driveBoardPin;
                const direct = (this as any)._setAvrPinDirect;
                if (pair && typeof netOf === 'function') {
                    const colBoard = netOf(pair[1]);
                    if (colBoard) {
                        (this as any)._drivingBus = true;
                        (this as any)._lastDrivenVoltage = 5.0;
                        if (typeof drive === 'function') drive(colBoard, true);
                        else if (typeof direct === 'function') direct(colBoard, true);
                    }
                }
            } catch { /* ignore */ }
            this.setState({ pressedKey: null, connectedPair: null });
        }
    }
}
