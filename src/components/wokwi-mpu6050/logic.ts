import { BaseComponent } from '../BaseComponent';

// MPU6050 — 6-axis IMU (3-axis accelerometer + 3-axis gyroscope)
// I2C address: 0x68 (AD0=LOW, default) or 0x69 (AD0=HIGH)
//
// Real hardware registers (simplified):
//   0x3B-0x40: ACCEL_XOUT_H/L, ACCEL_YOUT_H/L, ACCEL_ZOUT_H/L
//   0x41-0x42: TEMP_OUT_H/L
//   0x43-0x48: GYRO_XOUT_H/L, GYRO_YOUT_H/L, GYRO_ZOUT_H/L
//   0x6B: PWR_MGMT_1 (write 0x00 to wake up)
//   0x75: WHO_AM_I → returns 0x68
//
// Arduino uses MPU6050 library or Wire directly.
// Acceleration in units of 1g = 16384 LSB (±2g range)
// Gyroscope in units of 1°/s = 131 LSB (±250°/s range)

const MPU6050_ADDRESS = 0x68;
const ACCEL_SCALE = 16384; // LSB per g  (±2g range)
const GYRO_SCALE  = 131;   // LSB per °/s (±250°/s range)
const TEMP_SCALE  = 340;   // LSB per °C

export class MPU6050Logic extends BaseComponent {
    private accelX: number = 0;
    private accelY: number = 0;
    private accelZ: number = 1;
    private gyroX:  number = 0;
    private gyroY:  number = 0;
    private gyroZ:  number = 0;
    private temperature: number = 25;
    private powered: boolean = false;
    private registerPointer: number = 0;
    private sleeping: boolean = true;
    private selected: boolean = false;
    private expectingRegister: boolean = true;

    // Persist configuration registers
    private registers: Record<number, number> = {
        0x19: 0x00, // SMPLRT_DIV
        0x1A: 0x00, // CONFIG
        0x1B: 0x00, // GYRO_CONFIG
        0x1C: 0x00, // ACCEL_CONFIG
        0x1D: 0x00, // ACCEL_CONFIG_2
        0x23: 0x00, // FIFO_EN
        0x38: 0x00, // INT_ENABLE
        0x6A: 0x00, // USER_CTRL
        0x6B: 0x40, // PWR_MGMT_1 (starts in sleep)
        0x6C: 0x00, // PWR_MGMT_2
    };

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.accelX      = parseFloat(manifest.attrs?.accelX      ?? '0');
        this.accelY      = parseFloat(manifest.attrs?.accelY      ?? '0');
        this.accelZ      = parseFloat(manifest.attrs?.accelZ      ?? '1');
        this.gyroX       = parseFloat(manifest.attrs?.gyroX       ?? '0');
        this.gyroY       = parseFloat(manifest.attrs?.gyroY       ?? '0');
        this.gyroZ       = parseFloat(manifest.attrs?.gyroZ       ?? '0');
        this.temperature = parseFloat(manifest.attrs?.temperature  ?? '25');

        this.state = {
            powered:     false,
            accelX: this.accelX, accelY: this.accelY, accelZ: this.accelZ,
            gyroX:  this.gyroX,  gyroY:  this.gyroY,  gyroZ:  this.gyroZ,
            temperature: this.temperature,
        };
    }

    private reset() {
        this.sleeping = true;
        this.registers = {
            0x19: 0x00, 0x1A: 0x00, 0x1B: 0x00, 0x1C: 0x00, 0x1D: 0x00,
            0x23: 0x00, 0x38: 0x00, 0x6A: 0x00, 0x6B: 0x40, 0x6C: 0x00,
        };
        this.registerPointer = 0;
    }

    onEvent(event: any) {
        if (event.type === 'accel-change') {
            this.accelX = parseFloat(event.x ?? this.accelX);
            this.accelY = parseFloat(event.y ?? this.accelY);
            this.accelZ = parseFloat(event.z ?? this.accelZ);
            this.setState({ accelX: this.accelX, accelY: this.accelY, accelZ: this.accelZ });
        }
        if (event.type === 'gyro-change') {
            this.gyroX = parseFloat(event.x ?? this.gyroX);
            this.gyroY = parseFloat(event.y ?? this.gyroY);
            this.gyroZ = parseFloat(event.z ?? this.gyroZ);
            this.setState({ gyroX: this.gyroX, gyroY: this.gyroY, gyroZ: this.gyroZ });
        }
        if (event.type === 'temp-change') {
            this.temperature = parseFloat(event.value);
            this.setState({ temperature: this.temperature });
        }
    }

    update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
        const vcc = this.getPinVoltage('VCC');
        this.powered = vcc >= 2.375;
        if (this.state.powered !== this.powered) {
            this.setState({ powered: this.powered });
        }
    }

    private getI2CAddress(): number {
        // AD0 pin determines the LSB of the address
        const ad0 = this.getPinVoltage('ADO');
        return ad0 > 2.0 ? 0x69 : 0x68;
    }

    onI2CStart(address: number, read: boolean): boolean {
        if (!this.powered) return false;
        
        const addr7 = (address > 0x7F) ? (address >> 1) : address;
        this.selected = (addr7 === this.getI2CAddress());
        this.expectingRegister = !read;
        return this.selected;
    }

    onI2CByte(address: number, data: number): boolean {
        if (!this.selected) return false;

        if (this.expectingRegister) {
            this.registerPointer = data & 0xFF;
            this.expectingRegister = false;
        } else {
            // Write to register
            const reg = this.registerPointer;
            this.registers[reg] = data & 0xFF;

            // Handle special registers
            if (reg === 0x6B) { // PWR_MGMT_1
                if (data & 0x80) { // DEVICE_RESET
                    this.reset();
                } else {
                    this.sleeping = (data & 0x40) !== 0;
                }
            }

            // Auto-increment register pointer
            this.registerPointer = (this.registerPointer + 1) & 0xFF;
        }
        return true;
    }

    onI2CStop(): void {
        this.selected = false;
        this.expectingRegister = true;
    }

    readI2CByte(): number {
        const raw = this.getRawRegisters();
        const ptr = this.registerPointer;
        const val = raw[ptr] ?? this.registers[ptr] ?? 0x00;
        this.registerPointer = (this.registerPointer + 1) & 0xFF;
        return val & 0xFF;
    }

    private getRawRegisters(): Record<number, number> {
        const toWord = (val: number) => {
            const raw16 = Math.round(val) & 0xFFFF;
            return { high: (raw16 >> 8) & 0xFF, low: raw16 & 0xFF };
        };

        const ax = toWord(this.accelX * ACCEL_SCALE);
        const ay = toWord(this.accelY * ACCEL_SCALE);
        const az = toWord(this.accelZ * ACCEL_SCALE);
        const temp = toWord((this.temperature * TEMP_SCALE) - 12420);
        const gx = toWord(this.gyroX * GYRO_SCALE);
        const gy = toWord(this.gyroY * GYRO_SCALE);
        const gz = toWord(this.gyroZ * GYRO_SCALE);

        const regs: Record<number, number> = {
            0x3B: ax.high,  0x3C: ax.low,
            0x3D: ay.high,  0x3E: ay.low,
            0x3F: az.high,  0x40: az.low,
            0x41: temp.high, 0x42: temp.low,
            0x43: gx.high,  0x44: gx.low,
            0x45: gy.high,  0x46: gy.low,
            0x47: gz.high,  0x48: gz.low,
            0x75: 0x68,                   // WHO_AM_I is always 0x68
        };

        // Merge with persistent registers
        return { ...this.registers, ...regs };
    }
}
