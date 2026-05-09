import { BaseComponent } from '../BaseComponent';

export class KeypadLogic extends BaseComponent {
    private pressCount = 0;
    private lastPressedKey: string | null = null;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { pressedKey: null };
    }

    onEvent(event: string) {
        if (event.startsWith('press:')) {
            const key = event.split(':')[1];
            // 4x4 Keypad matrix mapping:
            const matrix: Record<string, [string, string]> = {
                '1': ['R1', 'C1'], '2': ['R1', 'C2'], '3': ['R1', 'C3'], 'A': ['R1', 'C4'],
                '4': ['R2', 'C1'], '5': ['R2', 'C2'], '6': ['R2', 'C3'], 'B': ['R2', 'C4'],
                '7': ['R3', 'C1'], '8': ['R3', 'C2'], '9': ['R3', 'C3'], 'C': ['R3', 'C4'],
                '*': ['R4', 'C1'], '0': ['R4', 'C2'], '#': ['R4', 'C3'], 'D': ['R4', 'C4'],
            };
            this.setState({ pressedKey: key, connectedPair: matrix[key] || null });
            if (key !== this.lastPressedKey) {
                this.pressCount++;
                this.lastPressedKey = key;
                this.stateChanged = true;
            }
        } else if (event === 'release') {
            this.setState({ pressedKey: null, connectedPair: null });
            this.lastPressedKey = null;
            this.stateChanged = true;
        }
    }

    onCustomTelemetry() {
        this.setCustomTelemetry({
            pressedKey: this.state.pressedKey || 'none',
            totalKeyPresses: this.pressCount,
            matrixType: '4x4',
            keys: ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'],
        });
    }
}
