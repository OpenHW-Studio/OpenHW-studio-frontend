import { BaseComponent } from '../BaseComponent';

export class Lcd2004I2CLogic extends BaseComponent {
    private backlight = true;
    private mode4bit = false;
    private cursorX = 0;
    private cursorY = 0;
    // 4 lines of 20 spaces
    private linesData: string[] = [
        "                    ", 
        "                    ",
        "                    ",
        "                    "
    ];
    private halfByte = 0;
    private isNibble = false;
    private lastByte = 0;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { lines: [...this.linesData], illuminated: this.backlight };
    }

    onI2CStart(addr: number, isRead: boolean) {
        // Default PCF8574 I2C address is usually 0x27
        if (addr === 0x27) return true; 
        return false;
    }

    onI2CByte(addr: number, value: number) {
        const rs = (value & 0x01) !== 0; 
        const rw = (value & 0x02) !== 0; 
        const en = (value & 0x04) !== 0; 
        const bl = (value & 0x08) !== 0; 

        const lastEn = (this.lastByte & 0x04) !== 0;

        if (lastEn && !en && !rw) {
            const dataNibble = (value & 0xF0);

            if (!this.mode4bit) {
                this.processLCDCommand(rs, dataNibble);
            } else {
                if (!this.isNibble) {
                    this.halfByte = dataNibble;
                    this.isNibble = true;
                } else {
                    const fullByte = this.halfByte | (dataNibble >> 4);
                    this.isNibble = false;
                    this.processLCDCommand(rs, fullByte);
                }
            }
        }

        if (this.backlight !== bl) {
            this.backlight = bl;
            this.stateChanged = true;
        }

        this.lastByte = value;
        this.updateState();
        return true;
    }

    processLCDCommand(rs: boolean, data: number) {
        if (!rs) {
            // Command
            if (data === 0x01) { // Clear display
                this.linesData = ["                    ", "                    ", "                    ", "                    "];
                this.cursorX = 0;
                this.cursorY = 0;
            } else if (data === 0x02 || data === 0x03) { // Return home
                this.cursorX = 0;
                this.cursorY = 0;
            } else if ((data & 0xF0) === 0x20) { // 4-bit mode
                this.mode4bit = true;
            } else if ((data & 0xF0) === 0x30) { // 8-bit mode
                this.mode4bit = false;
                this.isNibble = false;
            } else if ((data & 0x80) === 0x80) { 
                // Set DDRAM address (Memory map for 20x4 LCD)
                const addr = data & 0x7F;
                if (addr >= 0x00 && addr < 0x14) { this.cursorY = 0; this.cursorX = addr; } // Row 1
                else if (addr >= 0x40 && addr < 0x54) { this.cursorY = 1; this.cursorX = addr - 0x40; } // Row 2
                else if (addr >= 0x14 && addr < 0x28) { this.cursorY = 2; this.cursorX = addr - 0x14; } // Row 3
                else if (addr >= 0x54 && addr < 0x68) { this.cursorY = 3; this.cursorX = addr - 0x54; } // Row 4
            }
        } else {
            // Data
            if (this.cursorY < 4 && this.cursorX < 20) {
                const lineArray = this.linesData[this.cursorY].split("");
                lineArray[this.cursorX] = String.fromCharCode(data);
                this.linesData[this.cursorY] = lineArray.join("");
                this.cursorX++;
            }
        }
        this.stateChanged = true;
    }

    updateState() {
        this.state.lines = [...this.linesData];
        this.state.illuminated = this.backlight;
    }

    update(cpuCycles: number, wires: any, allComponents: any) {}

    getSyncState() {
        return { ...this.state };
    }
}