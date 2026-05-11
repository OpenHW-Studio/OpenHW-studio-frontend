import { BaseComponent } from '../BaseComponent';

// DS1307 Real-Time Clock — I2C address 0x68
//
// Real hardware behaviour:
//   - Maintains time independently using a 32.768kHz crystal + CR2032 battery
//   - Communicates over I2C (address 0x68)
//   - Registers: seconds(0), minutes(1), hours(2), day(3), date(4), month(5), year(6), control(7)
//   - Values stored in BCD format
//   - Arduino uses RTClib: RTC_DS1307 rtc; rtc.now() returns DateTime
//
// Simulation: time advances in real-time from the configured datetime attr.

const DS1307_ADDRESS = 0x68;

function toBCD(val: number): number {
    return ((Math.floor(val / 10) << 4) | (val % 10));
}

export class DS1307RTCLogic extends BaseComponent {
    private startTime: number = Date.now();
    private baseDate: Date;
    private registerPointer: number = 0;
    private powered: boolean = false;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        const dt = manifest.attrs?.datetime ?? '2024-01-01T00:00:00';
        this.baseDate = new Date(dt);
        this.startTime = Date.now();

        this.state = {
            powered:  false,
            datetime: dt,
            display:  this.formatDisplay(this.baseDate),
        };
    }

    private currentDate(): Date {
        const elapsed = Date.now() - this.startTime;
        return new Date(this.baseDate.getTime() + elapsed);
    }

    private formatDisplay(d: Date): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
        const vcc = this.getPinVoltage('VCC');
        this.powered = vcc >= 2.5;
        const now = this.currentDate();
        this.setState({
            powered:  this.powered,
            datetime: now.toISOString(),
            display:  this.formatDisplay(now),
        });
    }

    private selected: boolean = false;
    private expectingRegister: boolean = true;

    // I2C interface
    onI2CStart(address: number, read: boolean): boolean {
        const addr7 = (address > 0x7F) ? (address >> 1) : address;
        this.selected = (addr7 === DS1307_ADDRESS);
        this.expectingRegister = !read;
        return this.selected;
    }

    onI2CByte(address: number, data: number): boolean {
        if (!this.selected) return false;
        
        if (this.expectingRegister) {
            this.registerPointer = data;
            this.expectingRegister = false;
        } else {
            // Write data to registerPointer
            // (We ignore the write data since simulation time is read-only from the PC)
            this.registerPointer = (this.registerPointer + 1) % 8;
        }
        return true;
    }

    onI2CStop(): void {
        this.selected = false;
        this.expectingRegister = true;
    }

    readI2CByte(): number {
        const now = this.currentDate();
        const regs: Record<number, number> = {
            0: toBCD(now.getSeconds()),
            1: toBCD(now.getMinutes()),
            2: toBCD(now.getHours()),
            3: now.getDay() + 1,
            4: toBCD(now.getDate()),
            5: toBCD(now.getMonth() + 1),
            6: toBCD(now.getFullYear() % 100),
            7: 0x00, // control register
        };
        const val = regs[this.registerPointer] ?? 0xFF;
        this.registerPointer = (this.registerPointer + 1) % 8;
        return val;
    }
}
