import { BaseComponent } from '../BaseComponent';

export class SSD1306Logic extends BaseComponent {
  private vram: number[];
  private i2cAddress = 0x3C;
  private isAddressed = false;

  private awaitingControlByte = true;
  private isDataMode = false;
  private burstMode = false;

  // Display configuration
  private addressingMode = 2; // Default to Page Addressing Mode
  private pageStart = 0;
  private pageEnd = 7;
  private colStart = 0;
  private colEnd = 127;
  private page = 0;
  private column = 0;

  // Hardware configuration
  private displayOn = true;
  private invert = false;
  private allOn = false;
  private contrast = 0x7F;
  private displayStartLine = 0;
  private segmentRemap = false;
  private multiplexRatio = 63;
  private comScanDir = false; // false = normal, true = remap
  private displayOffset = 0;
  private comConfig = 0x12;

  private pendingCommand = 0;
  private pendingArgs = 0;
  private args: number[] = [];

  private vramDirty = false;
  private cycleCount = 0;

  constructor(id: string, manifest: any) {
    super(id, manifest);
    this.vram = new Array(1024).fill(0);

    // Safely extract I2C address from manifest attributes or use default
    const i2cAttr = manifest.attrs?.i2cAddress;
    this.i2cAddress = (typeof i2cAttr === 'number') ? i2cAttr : (i2cAttr?.default ?? 0x3C);

    this.state = {
      vram: [...this.vram],
      invert: false,
      allOn: false,
      displayOn: true,
      displayStartLine: 0,
      segmentRemap: false,
      comScanDir: false,
      displayOffset: 0
    };
  }

  update(cpuCycles: number) {
    this.cycleCount += cpuCycles;
    // 60FPS update (16ms @ 16MHz ~= 266666 cycles)
    if (this.cycleCount >= 266666) {
      this.cycleCount = 0;
      if (this.vramDirty) {
        this.vramDirty = false;
        this.setState({
          vram: [...this.vram],
          invert: this.invert,
          allOn: this.allOn,
          displayOn: this.displayOn,
          displayStartLine: this.displayStartLine,
          segmentRemap: this.segmentRemap,
          comScanDir: this.comScanDir,
          displayOffset: this.displayOffset
        });
      }
    }
  }

  onI2CStart(addr: number, read: boolean) {
    if (addr === this.i2cAddress) {
      if (read) return false; // SSD1306 doesn't usually support reads in basic simulations
      this.isAddressed = true;
      this.awaitingControlByte = true;
      return true;
    }
    this.isAddressed = false;
    return false;
  }

  onI2CByte(addr: number, data: number) {
    if (!this.isAddressed) return false;

    if (this.awaitingControlByte) {
      this.isDataMode = (data & 0x40) !== 0;
      this.burstMode = (data & 0x80) === 0;
      this.awaitingControlByte = false;
      return true;
    }

    if (this.isDataMode) {
      this.writeVram(data);
    } else {
      this.processCommand(data);
    }

    if (!this.burstMode) {
      this.awaitingControlByte = true;
    }
    return true;
  }

  onI2CStop() {
    this.isAddressed = false;
  }

  private writeVram(data: number) {
    const index = (this.page * 128) + this.column;
    if (index >= 0 && index < 1024) {
      this.vram[index] = data;
      this.vramDirty = true;
    }

    if (this.addressingMode === 0) { // Horizontal
      this.column++;
      if (this.column > this.colEnd) {
        this.column = this.colStart;
        this.page++;
        if (this.page > this.pageEnd) this.page = this.pageStart;
      }
    } else if (this.addressingMode === 1) { // Vertical
      this.page++;
      if (this.page > this.pageEnd) {
        this.page = this.pageStart;
        this.column++;
        if (this.column > this.colEnd) this.column = this.colStart;
      }
    } else { // Page
      this.column++;
      if (this.column > 127) this.column = 0;
    }
  }

  private getExpectedArgs(cmd: number): number {
    if (this.pendingArgs > 0) return this.pendingArgs;

    switch (cmd) {
      case 0x81: return 1; // Contrast
      case 0x20: return 1; // Addressing Mode
      case 0x21: return 2; // Column Range
      case 0x22: return 2; // Page Range
      case 0xA8: return 1; // Multiplex Ratio
      case 0xD3: return 1; // Display Offset
      case 0xD5: return 1; // Display Clock Divide Ratio
      case 0xD9: return 1; // Pre-charge Period
      case 0xDA: return 1; // COM Pins Config
      case 0xDB: return 1; // VCOMH Deselect Level
      case 0x8D: return 1; // Charge Pump
      default: return 0;
    }
  }

  private processCommand(cmd: number) {
    if (this.pendingArgs > 0) {
      this.args.push(cmd);
      this.pendingArgs--;
      if (this.pendingArgs === 0) this.executeCommand();
      return;
    }

    const expected = this.getExpectedArgs(cmd);
    if (expected > 0) {
      this.pendingCommand = cmd;
      this.pendingArgs = expected;
      this.args = [];
      return;
    }

    // Single byte commands
    if (cmd >= 0xB0 && cmd <= 0xB7) { // Set Page Start for Page Mode
      this.page = cmd & 0x07;
    } else if ((cmd & 0xF0) === 0x00) { // Set Lower Column Address
      this.column = (this.column & 0xF0) | (cmd & 0x0F);
    } else if ((cmd & 0xF0) === 0x10) { // Set Higher Column Address
      this.column = (this.column & 0x0F) | ((cmd & 0x0F) << 4);
    } else if (cmd >= 0x40 && cmd <= 0x7F) { // Set Display Start Line
      this.displayStartLine = cmd & 0x3F;
      this.vramDirty = true;
    } else {
      switch (cmd) {
        case 0xA0: case 0xA1: // Segment Remap
          this.segmentRemap = (cmd === 0xA1);
          this.vramDirty = true;
          break;
        case 0xC0: case 0xC8: // COM Output Scan Direction
          this.comScanDir = (cmd === 0xC8);
          this.vramDirty = true;
          break;
        case 0xA4: this.allOn = false; this.vramDirty = true; break;
        case 0xA5: this.allOn = true; this.vramDirty = true; break;
        case 0xA6: this.invert = false; this.vramDirty = true; break;
        case 0xA7: this.invert = true; this.vramDirty = true; break;
        case 0xAE: this.displayOn = false; this.vramDirty = true; break;
        case 0xAF: this.displayOn = true; this.vramDirty = true; break;
      }
    }
  }

  private executeCommand() {
    switch (this.pendingCommand) {
      case 0x20: this.addressingMode = this.args[0] & 0x03; break;
      case 0x21:
        this.colStart = this.args[0] & 0x7F;
        this.colEnd = this.args[1] & 0x7F;
        this.column = this.colStart;
        break;
      case 0x22:
        this.pageStart = this.args[0] & 0x07;
        this.pageEnd = this.args[1] & 0x07;
        this.page = this.pageStart;
        break;
      case 0x81: this.contrast = this.args[0]; break;
      case 0xA8: this.multiplexRatio = this.args[0] & 0x3F; break;
      case 0xD3: this.displayOffset = this.args[0] & 0x3F; this.vramDirty = true; break;
      case 0xDA: this.comConfig = this.args[0]; this.vramDirty = true; break;
    }
    this.pendingCommand = 0;
  }

  getSyncState() { return { ...this.state }; }
}
