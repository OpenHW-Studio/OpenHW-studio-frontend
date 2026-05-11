import { BaseComponent } from '../BaseComponent';

// BMP180 — I2C Barometric Pressure + Temperature Sensor
//
// Real hardware behaviour:
//   - Communicates over I2C bus (address 0x77)
//   - Arduino uses the Adafruit_BMP085 or BMP180 library
//   - Returns temperature (°C) and pressure (Pa)
//   - Can calculate altitude from pressure using:
//       altitude = 44330 * (1 - pow(pressure / 101325.0, 1/5.255))
//
// Typical Arduino sketch:
//   #include <Adafruit_BMP085.h>
//   Adafruit_BMP085 bmp;
//   bmp.begin();
//   float temp = bmp.readTemperature();
//   long  pres = bmp.readPressure();
//   float alt  = bmp.readAltitude();
//
// I2C Address: 0x77 (fixed)
// Simulation approach:
//   We handle I2C register reads via onI2CStart / onI2CByte hooks.
//   The engine routes I2C transactions to the matching component by address.

const BMP180_ADDRESS = 0x77;

// BMP180 register map (read-only registers we simulate)
const REG_CHIP_ID        = 0xD0; // returns 0x55
const REG_TEMP_MSB       = 0xF6;
const REG_TEMP_LSB       = 0xF7;
const REG_PRESSURE_MSB   = 0xF6;
const REG_PRESSURE_LSB   = 0xF7;
const REG_PRESSURE_XLSB  = 0xF8;
const REG_CTRL_MEAS      = 0xF4;
const CMD_TEMP           = 0x2E;
const CMD_PRESSURE_OSS0  = 0x34;

export class BMP180Logic extends BaseComponent {
    private temperature: number = 25.0;   // °C
    private pressure:    number = 101325; // Pa (sea level standard)
    private registerPointer: number = 0;
    private lastCommand:     number = CMD_TEMP;
    private powered:         boolean = false;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.temperature = parseFloat(manifest.attrs?.temperature ?? '25');
        this.pressure    = parseFloat(manifest.attrs?.pressure    ?? '101325');

        this.state = {
            temperature: this.temperature,
            pressure:    this.pressure,
            altitude:    this.calcAltitude(this.pressure),
            powered:     false,
        };
    }

    onEvent(event: any) {
        if (event.type === 'temperature-change') {
            this.temperature = Math.max(-40, Math.min(85, parseFloat(event.value)));
            this.syncState();
        }
        if (event.type === 'pressure-change') {
            // Clamp to realistic range: ~30000 Pa (Everest) to ~110000 Pa
            this.pressure = Math.max(30000, Math.min(110000, parseFloat(event.value)));
            this.syncState();
        }
    }

    update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
        const vcc = this.getPinVoltage('VIN');
        this.powered = vcc >= 1.8;
        this.setState({ powered: this.powered });
    }

    private selected: boolean = false;

    // ── I2C interface ────────────────────────────────────────────────────────

    onI2CStart(address: number, read: boolean): boolean {
        const addr7 = (address > 0x7F) ? (address >> 1) : address;
        this.selected = (addr7 === BMP180_ADDRESS);
        return this.selected;
    }

    onI2CByte(address: number, data: number): boolean {
        if (!this.selected) return false;

        // If this is a write, it sets the register pointer or a command
        if (data === REG_CTRL_MEAS) {
            // next byte will be the command
            this.registerPointer = REG_CTRL_MEAS;
        } else if (this.registerPointer === REG_CTRL_MEAS) {
            this.lastCommand = data;
            this.registerPointer = REG_TEMP_MSB;
        } else {
            this.registerPointer = data;
        }
        return true;
    }

    onI2CStop(): void {
        this.selected = false;
    }

    // Called by engine when master reads a byte from us
    readI2CByte(): number {
        if (this.registerPointer >= 0xAA && this.registerPointer <= 0xBF) {
            // Calibration registers
            // We use specific magic numbers to make the Adafruit library's internal math linear
            // ac1=0, ac2=0, ac3=0, ac4=32768, ac5=32768, ac6=32768, b1=0, b2=0, mb=0, mc=0, md=1
            let val = 0;
            switch (this.registerPointer) {
                case 0xB0: val = 0x80; break; // ac4 MSB = 0x80 (32768)
                case 0xB2: val = 0x80; break; // ac5 MSB = 0x80 (32768)
                case 0xB4: val = 0x80; break; // ac6 MSB = 0x80 (32768)
                case 0xBF: val = 0x01; break; // md LSB = 1
                default: val = 0x00; break;
            }
            this.registerPointer++;
            return val;
        }

        switch (this.registerPointer) {
            case REG_CHIP_ID:
                this.registerPointer++;
                return 0x55; // BMP180 chip ID

            case REG_TEMP_MSB: {
                const ut = this.getUT();
                this.registerPointer = REG_TEMP_LSB;
                return (ut >> 8) & 0xFF;
            }
            case REG_TEMP_LSB: {
                const ut = this.getUT();
                this.registerPointer++;
                return ut & 0xFF;
            }
            case REG_PRESSURE_MSB: {
                const up = this.getUP();
                this.registerPointer = REG_PRESSURE_LSB;
                return (up >> 16) & 0xFF;
            }
            case REG_PRESSURE_LSB: {
                const up = this.getUP();
                this.registerPointer = REG_PRESSURE_XLSB;
                return (up >> 8) & 0xFF;
            }
            case REG_PRESSURE_XLSB: {
                const up = this.getUP();
                this.registerPointer++;
                return up & 0xFF;
            }
            default:
                return 0xFF;
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    
    private getUT(): number {
        // Temperature formula in Adafruit library with our magic calibration:
        // B5 = UT - 32768
        // temp = (B5 + 8) >> 4 / 10.0
        // We want temp = this.temperature
        // So B5 = this.temperature * 160 - 8
        // UT = B5 + 32768 = this.temperature * 160 + 32760
        let ut = Math.round(this.temperature * 160 + 32760);
        return Math.max(0, Math.min(65535, ut));
    }

    private getUP(): number {
        // Pressure formula in Adafruit library with our magic calibration:
        // B3 = 0, B4 = 32768
        // B7 = UP * (50000 >> oversampling)
        // p_raw = B7 * 2 / 32768 = UP * (50000 >> oversampling) / 16384
        // Then p = p_raw + ((X1 + X2 + 3791) >> 4)
        // where X1 = (p_raw/256)^2 * 3038 / 65536
        //       X2 = -7357 * p_raw / 65536
        
        let oss = 0;
        if (this.lastCommand >= 0x34 && this.lastCommand <= 0xF4) {
            oss = (this.lastCommand - 0x34) >> 6;
        }

        // Iteratively find p_raw that produces target pressure
        let p_raw = this.pressure;
        for (let i = 0; i < 3; i++) {
            const p_raw_256 = p_raw >> 8;
            const x1 = (p_raw_256 * p_raw_256 * 3038) >> 16;
            const x2 = (-7357 * p_raw) >> 16;
            const correction = (x1 + x2 + 3791) >> 4;
            p_raw = this.pressure - correction;
        }

        // UP = p_raw * 16384 / (50000 >> oss)
        const up = Math.round(p_raw * 16384 / (50000 >> oss));
        return Math.max(0, up);
    }

    calcAltitude(pressurePa: number): number {
        // Standard barometric formula
        return parseFloat(
            (44330 * (1 - Math.pow(pressurePa / 101325.0, 1 / 5.255))).toFixed(1)
        );
    }

    syncState() {
        this.setState({
            temperature: this.temperature,
            pressure:    this.pressure,
            altitude:    this.calcAltitude(this.pressure),
            powered:     this.powered,
        });
    }
}
