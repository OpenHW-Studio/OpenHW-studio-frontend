import { CPU, timer0Config, timer1Config, timer2Config, AVRTimer, avrInstruction, AVRADC, adcConfig, AVRUSART, usart0Config, AVRTWI, twiConfig, AVRSPI, spiConfig, AVRIOPort, portBConfig, portCConfig, portDConfig, PinState } from 'avr8js';
import { RP2040, GPIOPinState, ConsoleLogger, LogLevel, USBCDC, GDBServer, GDBConnection } from 'rp2040js';
import { bootromB1 } from './rp2040-bootrom.ts';
import { AVRRunner } from './runners/avr-runner.ts';
import { RP2040Runner } from './runners/rp2040-runner.ts';

import { BaseComponent } from '@openhw/emulator';
import { LEDLogic } from '@openhw/emulator/src/components/openhw-led/logic.ts';
import { UnoLogic } from '@openhw/emulator/src/components/openhw-arduino-uno/logic.ts';
import { PicoLogic } from './pico-logic.ts';
import { ResistorLogic } from '@openhw/emulator/src/components/openhw-resistor/logic.ts';
import { PushbuttonLogic } from '@openhw/emulator/src/components/openhw-pushbutton/logic.ts';
import { PowerSupplyLogic } from '@openhw/emulator/src/components/openhw-power-supply/logic.ts';
import { BatteryLogic } from '@openhw/emulator/src/components/openhw-battery/logic.ts';
import { NeopixelLogic } from '../components/openhw-neopixel-matrix/logic.ts';
import { BuzzerLogic } from '@openhw/emulator/src/components/openhw-buzzer/logic.ts';
import { MotorLogic } from '@openhw/emulator/src/components/openhw-motor/logic.ts';
import { ServoLogic } from '@openhw/emulator/src/components/openhw-servo/logic.ts';
import { MotorDriverLogic } from '@openhw/emulator/src/components/openhw-motor-driver/logic.ts';
import { SlidePotLogic } from '@openhw/emulator/src/components/openhw-slide-potentiometer/logic.ts';
import { PotentiometerLogic } from '@openhw/emulator/src/components/openhw-potentiometer/logic.ts';
import { ShiftRegisterLogic } from '@openhw/emulator/src/components/shift_register/logic.ts';
import {
    PICO_BOARD_PINS,
    UNO_ANALOG_PINS,
    UNO_BOARD_PINS,
    UNO_DIGITAL_PINS,
} from './board-profiles.ts';
import { JoystickLogic } from '@openhw/emulator/src/components/openhw-analog-joystick/logic.ts';
import { LogicIC74xxLogic } from '@openhw/emulator/src/components/logic-ic-74xx/logic.ts';
import { Mux2to1Logic } from '@openhw/emulator/src/components/logic-mux-2to1/logic.ts';
import { DFlipFlopLogic } from '@openhw/emulator/src/components/logic-d-flipflop/logic.ts';
import { DFlipFlopRLogic } from '@openhw/emulator/src/components/logic-d-flipflop-r/logic.ts';
import { DFlipFlopDsrLogic } from '@openhw/emulator/src/components/logic-d-flipflop-dsr/logic.ts';
import { ClockGeneratorLogic } from '@openhw/emulator/src/components/logic-clock-generator/logic.ts';
import { WokwiTM1637Logic } from '@openhw/emulator/src/components/openhw-tm1637-7segment/logic.ts';
import { RGBLEDLogic } from '@openhw/emulator/src/components/openhw-rgb-led/logic.ts';
import { RotaryEncoderLogic } from '@openhw/emulator/src/components/openhw-rotary-encoder/logic.ts';
import { Nokia5110Logic } from '@openhw/emulator/src/components/openhw-nokia-5110/logic.ts';
import { L293DLogic } from '@openhw/emulator/src/components/openhw-l293d/logic.ts';
import { Lcd2004I2CLogic } from '@openhw/emulator/src/components/openhw-lcd2004-i2c/logic.ts';
import { Lcd1602Logic } from '@openhw/emulator/src/components/openhw-lcd1602/logic.ts';
import { SSD1306Logic } from '@openhw/emulator/src/components/openhw-ssd1306-oled/logic.ts';
import { PCA9685Logic } from '@openhw/emulator/src/components/openhw-pca9685/logic.ts';
import { MAX30102Logic } from '@openhw/emulator/src/components/max30102/logic.ts';
import { LdrModuleLogic } from '@openhw/emulator/src/components/openhw-ldr-module/logic.ts';
import { SoilMoistureSensorLogic } from '@openhw/emulator/src/components/openhw-soil-moisture-sensor/logic.ts';
import { PhotodiodeLogic } from '@openhw/emulator/src/components/openhw-photodiode/logic.ts';
import { DiodeLogic } from '@openhw/emulator/src/components/openhw-diode/logic.ts';
import { NPNTransistorLogic } from '@openhw/emulator/src/components/openhw-npn-transistor/logic.ts';
import { MAX7219Logic } from '@openhw/emulator/src/components/openhw-max7219/logic.ts';
import { A4988Logic } from '@openhw/emulator/src/components/openhw-a4988/logic.ts';
import { Wokwi7SegmentLogic } from '@openhw/emulator/src/components/openhw-7segment/logic.ts';
import { ILI9341Logic } from '@openhw/emulator/src/components/openhw-ili9341/logic.ts';
import { CD74HC4067Logic } from '@openhw/emulator/src/components/openhw-cd74hc4067/logic.ts';
import { LogicAnalyzerLogic } from '@openhw/emulator/src/components/openhw-logic-analyzer/logic.ts';
import { MegaLogic } from '@openhw/emulator/src/components/openhw-arduino-mega/logic.ts';
import { DS18B20Logic } from '@openhw/emulator/src/components/openhw-ds18b20/logic.ts';
import { IRReceiverLogic } from '@openhw/emulator/src/components/openhw-ir-receiver/logic.ts';
import { MFRC522Logic } from '@openhw/emulator/src/components/openhw-mfrc522/logic.ts';

function gateVoltage(isHigh: boolean): number {
    return isHigh ? 5.0 : 0.0;
}

function pinIsHigh(inst: BaseComponent, pinId: string): boolean {
    return !!inst?.pins?.[pinId]?.isHigh;
}

function setGateOutput(inst: BaseComponent, pinId: string, isHigh: boolean) {
    if (typeof inst?.setPinVoltage === 'function') {
        inst.setPinVoltage(pinId, gateVoltage(isHigh));
    }
    if (inst?.pins?.[pinId]) {
        inst.pins[pinId].isHigh = !!isHigh;
        inst.pins[pinId].voltage = gateVoltage(isHigh);
    }
}

class NotGateLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { out: true };
    }

    onPinStateChange(pinId: string, isHigh: boolean) {
        const pin = String(pinId || '').toUpperCase();
        if (pin === 'IN' || pin === 'A' || pin === 'P1' || pin === '1') {
            const next = !isHigh;
            this.state.out = next;
            setGateOutput(this, 'OUT', next);
        }
    }
}

class TwoInputGateLogic extends BaseComponent {
    protected evaluate(_a: boolean, _b: boolean): boolean {
        return false;
    }

    protected refreshOutput() {
        const a = pinIsHigh(this, 'A') || pinIsHigh(this, 'D0') || pinIsHigh(this, 'IN1') || pinIsHigh(this, '1') || pinIsHigh(this, 'p1');
        const b = pinIsHigh(this, 'B') || pinIsHigh(this, 'D1') || pinIsHigh(this, 'IN2') || pinIsHigh(this, '2') || pinIsHigh(this, 'p2');
        const next = this.evaluate(a, b);
        this.state.out = next;
        setGateOutput(this, 'OUT', next);
    }

    onPinStateChange(pinId: string) {
        const pin = String(pinId || '').toUpperCase();
        if (['A', 'B', 'D0', 'D1', 'IN1', 'IN2', '1', '2', 'P1', 'P2'].includes(pin)) {
            this.refreshOutput();
        }
    }
}

class AndGateLogic extends TwoInputGateLogic {
    protected evaluate(a: boolean, b: boolean): boolean {
        return a && b;
    }
}

class NandGateLogic extends TwoInputGateLogic {
    protected evaluate(a: boolean, b: boolean): boolean {
        return !(a && b);
    }
}

class NorGateLogic extends TwoInputGateLogic {
    protected evaluate(a: boolean, b: boolean): boolean {
        return !(a || b);
    }
}

class XorGateLogic extends TwoInputGateLogic {
    protected evaluate(a: boolean, b: boolean): boolean {
        return !!a !== !!b;
    }
}

class KeypadLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { pressedKey: null, connectedPair: null };
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
        } else if (event === 'release') {
            this.setState({ pressedKey: null, connectedPair: null });
        }
    }
}

export function parse(data: string) {
    const lines = data.split('\n');
    let highAddress = 0;
    const maxAddress = 32768; // 32KB typical Uno size
    const result = new Uint8Array(maxAddress);

    for (const line of lines) {
        if (line[0] !== ':') continue;
        const byteCount = parseInt(line.substring(1, 3), 16);
        const address = parseInt(line.substring(3, 7), 16);
        const recordType = parseInt(line.substring(7, 9), 16);

        if (recordType === 0) { // Data record
            for (let i = 0; i < byteCount; i++) {
                const byte = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16);
                const absoluteAddress = highAddress + address + i;
                if (absoluteAddress < maxAddress) {
                    result[absoluteAddress] = byte;
                }
            }
        } else if (recordType === 4 || recordType === 2) { // Extended linear/segment address
            highAddress = parseInt(line.substring(9, 13), 16) << (recordType === 4 ? 16 : 4);
        } // ignore recordTypes 1 (EOF) and others for this simple parser
    }
    return { data: result };
}

const LITTLEFS_MODULE_NAME = 'littlefs';
const SD_BLOCK_SIZE = 512;
const SD_DATA_TOKEN = 0xfe;

type LittleFsVolume = {
    mount: () => number;
    unmount: () => number;
    format: () => number;
    formatAndMount: () => number;
    mkdir: (path: string) => boolean;
    writeFile: (path: string, data: Uint8Array) => boolean;
    destroy: () => void;
};

function toUint8Array(data: any, encoder: TextEncoder): Uint8Array {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (Array.isArray(data)) return new Uint8Array(data.map((v) => Number(v) & 0xff));
    return encoder.encode(String(data ?? ''));
}

async function tryLoadLittleFsFactory(): Promise<((options?: any) => Promise<any>) | null> {
    try {
        const mod = await import(/* @vite-ignore */ LITTLEFS_MODULE_NAME);
        const candidate = (mod as any)?.default ?? mod;
        return typeof candidate === 'function' ? candidate : null;
    } catch (e) {
        return null;
    }
}

function isNodeRuntime(): boolean {
    return typeof process !== 'undefined' && !!(process as any)?.versions?.node;
}

async function dynamicImportModule(specifier: string): Promise<any> {
    const importer = new Function('s', 'return import(s);') as (s: string) => Promise<any>;
    return importer(specifier);
}

async function readLittleFsWasmBinaryForNode(): Promise<Uint8Array | null> {
    if (!isNodeRuntime()) return null;

    let readFile: ((pathLike: any) => Promise<any>) | null = null;
    try {
        const fsPromises = await dynamicImportModule('node:fs/promises');
        readFile = typeof fsPromises?.readFile === 'function' ? fsPromises.readFile.bind(fsPromises) : null;
    } catch (e) {
        return null;
    }
    if (!readFile) return null;

    const candidates = [
        // In production browser, this will be at /wasm/littlefs.wasm
        // In dev/node, we try to resolve from node_modules
        new URL('/wasm/littlefs.wasm', import.meta.url),
        /* @vite-ignore */
        new URL('../../node_modules/littlefs/dist/littlefs.wasm', import.meta.url),
    ];

    const seen = new Set<string>();
    for (const candidate of candidates) {
        const key = String((candidate as any)?.href || candidate);
        if (!key || seen.has(key)) continue;
        seen.add(key);

        try {
            const buf = await readFile(candidate);
            if (!buf) continue;
            if (buf instanceof Uint8Array) {
                return buf.length > 0 ? buf : null;
            }
            if (buf instanceof ArrayBuffer) {
                const out = new Uint8Array(buf);
                return out.length > 0 ? out : null;
            }
            if (ArrayBuffer.isView(buf)) {
                const view = buf as ArrayBufferView;
                const out = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
                return out.length > 0 ? out : null;
            }
        } catch (e) {
            // try next candidate
        }
    }

    return null;
}

function createLittleFsVolume(
    littlefs: any,
    storage: Uint8Array,
    blockSize: number,
    blockCount: number
): LittleFsVolume | null {
    if (!littlefs || typeof littlefs.addFunction !== 'function' || typeof littlefs._new_lfs !== 'function' || typeof littlefs._new_lfs_config !== 'function') {
        return null;
    }
    if (typeof littlefs._lfs_mount !== 'function' || typeof littlefs._lfs_unmount !== 'function' || typeof littlefs._lfs_format !== 'function') {
        return null;
    }

    const tablePointers: number[] = [];
    const addFn = (fn: (...args: any[]) => number, signature: string) => {
        const ptr = Number(littlefs.addFunction(fn, signature));
        tablePointers.push(ptr);
        return ptr;
    };

    const read = addFn((cfg: number, block: number, off: number, buffer: number, size: number) => {
        void cfg;
        const start = block * blockSize + off;
        if (start < 0 || (start + size) > storage.length) return -5;
        littlefs.HEAPU8.set(storage.subarray(start, start + size), buffer);
        return 0;
    }, 'iiiiii');

    const prog = addFn((cfg: number, block: number, off: number, buffer: number, size: number) => {
        void cfg;
        const start = block * blockSize + off;
        if (start < 0 || (start + size) > storage.length) return -5;
        storage.set(littlefs.HEAPU8.subarray(buffer, buffer + size), start);
        return 0;
    }, 'iiiiii');

    const erase = addFn((cfg: number, block: number) => {
        void cfg;
        const start = block * blockSize;
        if (start < 0 || (start + blockSize) > storage.length) return -5;
        storage.fill(0xff, start, start + blockSize);
        return 0;
    }, 'iii');

    const sync = addFn((cfg: number) => {
        void cfg;
        return 0;
    }, 'ii');

    const config = Number(littlefs._new_lfs_config(read, prog, erase, sync, blockCount, blockSize));
    const lfs = Number(littlefs._new_lfs());
    if (!Number.isFinite(config) || !Number.isFinite(lfs) || config <= 0 || lfs <= 0) {
        return null;
    }

    const cwrapWrite = typeof littlefs.cwrap === 'function'
        ? littlefs.cwrap('lfs_write_file', null, ['number', 'string', 'number', 'number'])
        : null;

    const mount = () => Number(littlefs._lfs_mount(lfs, config) ?? -1);
    const unmount = () => Number(littlefs._lfs_unmount(lfs) ?? -1);
    const format = () => Number(littlefs._lfs_format(lfs, config) ?? -1);
    const formatAndMount = () => {
        const fr = format();
        if (fr < 0) return fr;
        return mount();
    };

    const writeFile = (path: string, data: Uint8Array) => {
        if (typeof cwrapWrite !== 'function') {
            return false;
        }

        const hasMalloc = typeof littlefs._malloc === 'function' && typeof littlefs._free === 'function';
        const hasStack = typeof littlefs.stackAlloc === 'function'
            && typeof littlefs.stackSave === 'function'
            && typeof littlefs.stackRestore === 'function';
        if (!hasMalloc && !hasStack) {
            return false;
        }

        let ptr = 0;
        let stackTop: number | null = null;
        let usedStack = false;
        try {
            const size = data.length;
            if (hasMalloc) {
                ptr = Number(littlefs._malloc(Math.max(size, 1)));
            } else {
                stackTop = Number(littlefs.stackSave());
                ptr = Number(littlefs.stackAlloc(Math.max(size, 1)));
                usedStack = true;
            }
            if (!Number.isFinite(ptr) || ptr <= 0) return false;
            if (size > 0) {
                littlefs.HEAPU8.set(data, ptr);
            }
            cwrapWrite(lfs, path, ptr, size);
            return true;
        } catch (e) {
            return false;
        } finally {
            if (hasMalloc && ptr > 0) {
                try {
                    littlefs._free(ptr);
                } catch (e) {
                    // ignore
                }
            }
            if (usedStack && stackTop !== null) {
                try {
                    littlefs.stackRestore(stackTop);
                } catch (e) {
                    // ignore
                }
            }
        }
    };

    const mkdir = (path: string) => {
        if (typeof littlefs._lfs_mkdir !== 'function') {
            return false;
        }

        try {
            const rc = Number(littlefs._lfs_mkdir(lfs, path));
            // littlefs returns -17 for EEXIST.
            return rc === 0 || rc === -17;
        } catch (e) {
            return false;
        }
    };

    const destroy = () => {
        try {
            if (typeof littlefs._free === 'function') {
                littlefs._free(lfs);
                littlefs._free(config);
            }
        } catch (e) {
            // ignore
        }

        if (typeof littlefs.removeFunction === 'function') {
            tablePointers.forEach((ptr) => {
                try {
                    littlefs.removeFunction(ptr);
                } catch (e) {
                    // ignore
                }
            });
        }
    };

    return {
        mount,
        unmount,
        format,
        formatAndMount,
        mkdir,
        writeFile,
        destroy,
    };
}

function normalizeLittleFsPath(rawPath: unknown): string {
    const cleaned = String(rawPath || '')
        .replace(/\\/g, '/')
        .trim();
    if (!cleaned) return '';

    const parts = cleaned
        .split('/')
        .map((part) => part.trim())
        .filter((part) => part && part !== '.' && part !== '..');

    return parts.join('/');
}

function collectLittleFsParentDirs(path: string): string[] {
    const normalized = normalizeLittleFsPath(path);
    if (!normalized || !normalized.includes('/')) return [];

    const parts = normalized.split('/');
    const dirs: string[] = [];
    for (let i = 1; i < parts.length; i++) {
        const dir = parts.slice(0, i).join('/');
        if (dir) dirs.push(dir);
    }
    return dirs;
}

export async function buildLittleFsImage(
    files: Array<{ path: string; data: unknown }>,
    options: { sizeBytes?: number; blockSize?: number } = {}
): Promise<Uint8Array | null> {
    if (!Array.isArray(files) || files.length === 0) return null;

    const blockSizeRaw = Number(options.blockSize);
    const blockSize = Number.isFinite(blockSizeRaw) && blockSizeRaw >= 256
        ? Math.floor(blockSizeRaw)
        : 4096;

    const sizeBytesRaw = Number(options.sizeBytes);
    const requestedSize = Number.isFinite(sizeBytesRaw) && sizeBytesRaw > 0
        ? Math.floor(sizeBytesRaw)
        : (512 * 1024);
    const alignedSize = Math.ceil(requestedSize / blockSize) * blockSize;
    const blockCount = Math.max(1, Math.floor(alignedSize / blockSize));

    const storage = new Uint8Array(blockCount * blockSize);
    storage.fill(0xff);

    const factory = await tryLoadLittleFsFactory();
    if (!factory) return null;

        let littlefsModule: any = null;
        let volume: LittleFsVolume | null = null;
        try {
            const env: any = { print: () => {}, printErr: () => {} };
            if (isNodeRuntime()) {
                const nodeWasm = await readLittleFsWasmBinaryForNode();
                if (nodeWasm && nodeWasm.length > 0) env.wasmBinary = nodeWasm;
            }
            littlefsModule = await factory(env);
            volume = createLittleFsVolume(littlefsModule, storage, blockSize, blockCount);
            if (!volume || volume.formatAndMount() < 0) return null;

            const createdDirs = new Set<string>();
            const encoder = new TextEncoder();

        for (const file of files) {
            const path = normalizeLittleFsPath(file?.path);
            if (!path) continue;

            const parentDirs = collectLittleFsParentDirs(path);
            for (const dir of parentDirs) {
                if (createdDirs.has(dir)) continue;
                if (!volume.mkdir(`/${dir}`) && !volume.mkdir(dir)) {
                    return null;
                }
                createdDirs.add(dir);
            }

            const data = toUint8Array(file?.data, encoder);
            if (!volume.writeFile(`/${path}`, data) && !volume.writeFile(path, data)) {
                return null;
            }
        }

        volume.unmount();
        return storage.slice();
    } catch (e) {
        return null;
    } finally {
        try {
            volume?.destroy();
        } catch (e) {
            // ignore
        }
        try {
            if (littlefs && typeof littlefs.quit === 'function') {
                littlefs.quit();
            }
        } catch (e) {
            // ignore
        }
    }
}

const FAT_BYTES_PER_SECTOR = 512;
const FAT12_MEDIA_DESCRIPTOR = 0xF8;

function sanitizeFatNameToken(value: string, maxLength: number): string {
    const upper = String(value || '').trim().toUpperCase();
    const cleaned = upper.replace(/[^A-Z0-9]/g, '_');
    if (!cleaned) return ''.padEnd(maxLength, '_');
    return cleaned.slice(0, maxLength);
}

function normalizeFatVolumeLabel(value: unknown): string {
    const cleaned = sanitizeFatNameToken(String(value || 'CIRCUITPY').replace(/\./g, ''), 11);
    return cleaned.padEnd(11, ' ');
}

function toFatShortFileName(pathLike: string): string {
    const normalized = normalizeLittleFsPath(pathLike);
    const baseName = (normalized.split('/').pop() || normalized || 'FILE.TXT').trim();
    const dotIndex = baseName.lastIndexOf('.');
    const stem = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
    const ext = dotIndex > 0 ? baseName.slice(dotIndex + 1) : '';

    const shortStem = sanitizeFatNameToken(stem, 8).padEnd(8, ' ');
    const shortExt = sanitizeFatNameToken(ext, 3).padEnd(3, ' ');
    return `${shortStem}${shortExt}`;
}

function setFat12Entry(fat: Uint8Array, cluster: number, value: number) {
    const index = Math.floor(cluster * 3 / 2);
    const safeValue = value & 0x0fff;

    if ((cluster & 1) === 0) {
        fat[index] = safeValue & 0xff;
        fat[index + 1] = (fat[index + 1] & 0xf0) | ((safeValue >> 8) & 0x0f);
    } else {
        fat[index] = (fat[index] & 0x0f) | ((safeValue << 4) & 0xf0);
        fat[index + 1] = (safeValue >> 4) & 0xff;
    }
}

export function buildFatFsImage(
    files: Array<{ path: string; data: unknown }>,
    options: { sizeBytes?: number; volumeLabel?: string; sectorsPerCluster?: number } = {}
): Uint8Array | null {
    if (!Array.isArray(files) || files.length === 0) return null;

    const sizeBytesRaw = Number(options.sizeBytes);
    const requestedSize = Number.isFinite(sizeBytesRaw) && sizeBytesRaw > 0
        ? Math.floor(sizeBytesRaw)
        : (512 * 1024);
    const alignedSize = Math.floor(requestedSize / FAT_BYTES_PER_SECTOR) * FAT_BYTES_PER_SECTOR;
    if (alignedSize < (128 * 1024)) return null;

    const bytesPerSector = FAT_BYTES_PER_SECTOR;
    const totalSectors = Math.floor(alignedSize / bytesPerSector);
    const reservedSectors = 1;
    const numberOfFATs = 2;
    const rootEntryCount = 512;
    const rootDirSectors = Math.ceil((rootEntryCount * 32) / bytesPerSector);
    const sectorsPerClusterRaw = Number(options.sectorsPerCluster);
    const sectorsPerCluster = Number.isFinite(sectorsPerClusterRaw) && sectorsPerClusterRaw > 0
        ? Math.max(1, Math.floor(sectorsPerClusterRaw))
        : 1;
    const clusterSizeBytes = sectorsPerCluster * bytesPerSector;

    let sectorsPerFAT = 1;
    let clusterCount = 0;
    for (let i = 0; i < 8; i++) {
        const dataSectors = totalSectors - reservedSectors - (numberOfFATs * sectorsPerFAT) - rootDirSectors;
        if (dataSectors <= 0) return null;

        clusterCount = Math.floor(dataSectors / sectorsPerCluster);
        const requiredFatSectors = Math.max(
            1,
            Math.ceil((((clusterCount + 2) * 12) / 8) / bytesPerSector),
        );
        if (requiredFatSectors === sectorsPerFAT) break;
        sectorsPerFAT = requiredFatSectors;
    }

    if (clusterCount <= 0 || clusterCount >= 0x0ff0) {
        return null;
    }

    const encoder = new TextEncoder();
    const normalizedFiles = files
        .map((file, index) => ({
            index,
            shortName: toFatShortFileName(file?.path || `FILE${index}.TXT`),
            bytes: toUint8Array(file?.data, encoder),
        }))
        .filter((file) => !!file.shortName);

    if (normalizedFiles.length === 0) return null;
    if (normalizedFiles.length > (rootEntryCount - 1)) return null;

    const usedShortNames = new Set<string>();
    for (const file of normalizedFiles) {
        if (!usedShortNames.has(file.shortName)) {
            usedShortNames.add(file.shortName);
            continue;
        }

        const stem = file.shortName.slice(0, 8).trim() || 'FILE';
        const ext = file.shortName.slice(8, 11);
        let suffix = 1;
        while (suffix < 1000) {
            const candidateStem = `${stem.slice(0, Math.max(0, 8 - String(suffix).length))}${suffix}`.padEnd(8, ' ');
            const candidate = `${candidateStem}${ext}`;
            if (!usedShortNames.has(candidate)) {
                file.shortName = candidate;
                usedShortNames.add(candidate);
                break;
            }
            suffix += 1;
        }
    }

    let nextCluster = 2;
    const fileLayouts = normalizedFiles.map((file) => {
        const clusterSpan = file.bytes.length > 0
            ? Math.ceil(file.bytes.length / clusterSizeBytes)
            : 0;
        const firstCluster = clusterSpan > 0 ? nextCluster : 0;
        if (clusterSpan > 0) {
            nextCluster += clusterSpan;
        }

        return {
            ...file,
            firstCluster,
            clusterSpan,
        };
    });

    if (nextCluster > (clusterCount + 2)) {
        return null;
    }

    const fatByteLength = sectorsPerFAT * bytesPerSector;
    const fat = new Uint8Array(fatByteLength);
    fat.fill(0x00);
    fat[0] = FAT12_MEDIA_DESCRIPTOR;
    fat[1] = 0xff;
    fat[2] = 0xff;

    for (const file of fileLayouts) {
        if (file.clusterSpan <= 0 || file.firstCluster <= 0) continue;

        for (let i = 0; i < file.clusterSpan; i++) {
            const cluster = file.firstCluster + i;
            const nextValue = i === (file.clusterSpan - 1)
                ? 0x0fff
                : (cluster + 1);
            setFat12Entry(fat, cluster, nextValue);
        }
    }

    const image = new Uint8Array(alignedSize);
    image.fill(0x00);
    const boot = image.subarray(0, bytesPerSector);
    const bootView = new DataView(boot.buffer, boot.byteOffset, boot.byteLength);

    boot[0] = 0xeb;
    boot[1] = 0x3c;
    boot[2] = 0x90;
    boot.set(encoder.encode('MSDOS5.0').subarray(0, 8), 3);
    bootView.setUint16(11, bytesPerSector, true);
    boot[13] = sectorsPerCluster & 0xff;
    bootView.setUint16(14, reservedSectors, true);
    boot[16] = numberOfFATs & 0xff;
    bootView.setUint16(17, rootEntryCount, true);
    if (totalSectors < 0x10000) {
        bootView.setUint16(19, totalSectors, true);
        bootView.setUint32(32, 0, true);
    } else {
        bootView.setUint16(19, 0, true);
        bootView.setUint32(32, totalSectors, true);
    }
    boot[21] = FAT12_MEDIA_DESCRIPTOR;
    bootView.setUint16(22, sectorsPerFAT, true);
    bootView.setUint16(24, 32, true);
    bootView.setUint16(26, 64, true);
    bootView.setUint32(28, 0, true);
    boot[36] = 0x80;
    boot[38] = 0x29;
    bootView.setUint32(39, 0x43495243, true);
    boot.set(encoder.encode(normalizeFatVolumeLabel(options.volumeLabel)).subarray(0, 11), 43);
    boot.set(encoder.encode('FAT12   ').subarray(0, 8), 54);
    boot[510] = 0x55;
    boot[511] = 0xaa;

    const fat1Offset = reservedSectors * bytesPerSector;
    const fat2Offset = fat1Offset + fatByteLength;
    image.set(fat, fat1Offset);
    image.set(fat, fat2Offset);

    const rootOffset = (reservedSectors + (numberOfFATs * sectorsPerFAT)) * bytesPerSector;
    const rootByteLength = rootDirSectors * bytesPerSector;
    const root = image.subarray(rootOffset, rootOffset + rootByteLength);
    root.fill(0x00);

    const volumeLabel = normalizeFatVolumeLabel(options.volumeLabel);
    root.set(encoder.encode(volumeLabel).subarray(0, 11), 0);
    root[11] = 0x08;

    let entryIndex = 1;
    for (const file of fileLayouts) {
        const entryOffset = entryIndex * 32;
        if (entryOffset + 32 > root.length) break;

        root.set(encoder.encode(file.shortName).subarray(0, 11), entryOffset);
        root[entryOffset + 11] = 0x20;

        const rootView = new DataView(root.buffer, root.byteOffset + entryOffset, 32);
        rootView.setUint16(26, file.firstCluster & 0xffff, true);
        rootView.setUint32(28, file.bytes.length >>> 0, true);
        entryIndex += 1;
    }

    const dataStartOffset = (reservedSectors + (numberOfFATs * sectorsPerFAT) + rootDirSectors) * bytesPerSector;
    for (const file of fileLayouts) {
        if (file.clusterSpan <= 0 || file.firstCluster <= 0 || file.bytes.length === 0) continue;

        for (let i = 0; i < file.clusterSpan; i++) {
            const cluster = file.firstCluster + i;
            const clusterOffset = dataStartOffset + ((cluster - 2) * clusterSizeBytes);
            const srcStart = i * clusterSizeBytes;
            const srcEnd = Math.min(file.bytes.length, srcStart + clusterSizeBytes);
            image.set(file.bytes.subarray(srcStart, srcEnd), clusterOffset);
        }
    }

    return image;
}

class SDCardLogic extends BaseComponent {
    private powered = false;
    private csHigh = true;
    private mounted = true;
    private appCmdPending = false;
    private responseQueue: number[] = [];
    private commandFrame: number[] = [];
    private writeState: { blockIndex: number; stage: 'token' | 'payload' | 'crc1' | 'crc2'; data: number[] } | null = null;
    private bytesIn = 0;
    private bytesOut = 0;
    private lastActivityAt = 0;

    private readonly textEncoder = new TextEncoder();
    private readonly textDecoder = new TextDecoder();
    private readonly blockSize = SD_BLOCK_SIZE;
    private readonly blockCount: number;
    private readonly storage: Uint8Array;

    private backendName = 'memory';
    private littleFsReady = false;
    private littleFsVolume: LittleFsVolume | null = null;
    private files = new Map<string, Uint8Array>();

    constructor(id: string, manifest: any) {
        super(id, manifest);

        const capacityKbRaw = Number(manifest?.attrs?.capacityKB ?? 2048);
        const capacityKB = Number.isFinite(capacityKbRaw) && capacityKbRaw > 64
            ? Math.floor(capacityKbRaw)
            : 2048;

        this.blockCount = Math.max(64, Math.floor((capacityKB * 1024) / this.blockSize));
        this.storage = new Uint8Array(this.blockCount * this.blockSize);
        this.storage.fill(0xff);
        this.mounted = String(manifest?.attrs?.mounted ?? 'true') !== 'false';

        this.writeShadowFile('/README.TXT', this.textEncoder.encode('OpenHW virtual SD card\n'));

        this.state = {
            mounted: this.mounted,
            powered: false,
            selected: false,
            activity: false,
            backend: this.backendName,
            fsReady: this.littleFsReady,
            fileCount: this.files.size,
            usedBytes: this.computeUsedBytes(),
            bytesIn: 0,
            bytesOut: 0,
            capacityKB,
            blockSize: this.blockSize,
            blockCount: this.blockCount,
            lastCommand: '--',
            lastPath: '--',
            lastOp: 'idle',
            lastReadPreview: '',
        };

        void this.initLittleFsBackend();
    }

    private normalizePath(pathLike: string): string {
        const raw = String(pathLike || '').trim().replace(/\\/g, '/');
        if (!raw) return '/UNTITLED.TXT';
        return raw.startsWith('/') ? raw : `/${raw}`;
    }

    private computeUsedBytes(): number {
        let total = 0;
        this.files.forEach((v) => {
            total += v.length;
        });
        return total;
    }

    private updateFsCounters() {
        this.state.fileCount = this.files.size;
        this.state.usedBytes = this.computeUsedBytes();
        this.stateChanged = true;
    }

    private writeShadowFile(path: string, bytes: Uint8Array) {
        this.files.set(this.normalizePath(path), new Uint8Array(bytes));
        this.updateFsCounters();
    }

    private refreshPowerState() {
        const nextPowered = this.getPinVoltage('VCC') > 2.0;
        if (nextPowered !== this.powered) {
            this.powered = nextPowered;
            this.state.powered = this.powered;
            this.stateChanged = true;
        }
    }

    private resetSpiTransactionState() {
        this.appCmdPending = false;
        this.responseQueue = [];
        this.commandFrame = [];
        this.writeState = null;
    }

    private setMounted(nextMounted: boolean) {
        if (this.mounted === nextMounted) return;
        this.mounted = nextMounted;
        this.state.mounted = nextMounted;
        if (!nextMounted) {
            this.resetSpiTransactionState();
        }
        this.stateChanged = true;
    }

    private queueResponse(bytes: number[]) {
        this.responseQueue.push(...bytes.map((v) => v & 0xff));
    }

    private emitResponseByte() {
        const out = this.responseQueue.length > 0 ? (this.responseQueue.shift() as number) : 0xff;
        this.bytesOut += 1;
        this.state.bytesOut = this.bytesOut;
        this.stateChanged = true;
        return out & 0xff;
    }

    private parseBlockIndex(commandArg: number): number | null {
        const asBlockAddress = commandArg >>> 0;
        if (asBlockAddress < this.blockCount) return asBlockAddress;

        const byByteAddress = Math.floor((commandArg >>> 0) / this.blockSize);
        if (byByteAddress >= 0 && byByteAddress < this.blockCount) {
            return byByteAddress;
        }
        return null;
    }

    private queueReadBlock(blockIndex: number) {
        const start = blockIndex * this.blockSize;
        const payload = this.storage.subarray(start, start + this.blockSize);
        this.queueResponse([0x00, 0xff, SD_DATA_TOKEN, ...payload, 0xff, 0xff]);
    }

    private beginWriteBlock(blockIndex: number) {
        this.writeState = {
            blockIndex,
            stage: 'token',
            data: [],
        };
        this.queueResponse([0x00]);
    }

    private completeWriteBlock() {
        if (!this.writeState) return;

        const { blockIndex, data } = this.writeState;
        const start = blockIndex * this.blockSize;
        const payload = data.length >= this.blockSize
            ? data.slice(0, this.blockSize)
            : [...data, ...new Array(this.blockSize - data.length).fill(0xff)];

        this.storage.set(Uint8Array.from(payload), start);
        this.writeState = null;

        // Data accepted token (0bXXX00101), then one ready byte.
        this.queueResponse([0x05, 0xff]);
        this.state.lastOp = 'write-block';
        this.stateChanged = true;
    }

    private handleWriteByte(value: number) {
        if (!this.writeState) return;

        const byte = value & 0xff;
        if (this.writeState.stage === 'token') {
            if (byte === SD_DATA_TOKEN) {
                this.writeState.stage = 'payload';
            }
            return;
        }

        if (this.writeState.stage === 'payload') {
            this.writeState.data.push(byte);
            if (this.writeState.data.length >= this.blockSize) {
                this.writeState.stage = 'crc1';
            }
            return;
        }

        if (this.writeState.stage === 'crc1') {
            this.writeState.stage = 'crc2';
            return;
        }

        if (this.writeState.stage === 'crc2') {
            this.completeWriteBlock();
        }
    }

    private handleCommandFrame(frame: number[]) {
        const commandByte = frame[0] & 0xff;
        const command = commandByte & 0x3f;
        const arg = ((frame[1] << 24) | (frame[2] << 16) | (frame[3] << 8) | frame[4]) >>> 0;

        this.state.lastCommand = `CMD${String(command).padStart(2, '0')}`;

        if (command === 0) {
            this.appCmdPending = false;
            this.queueResponse([0x01]);
            return;
        }

        if (command === 8) {
            this.queueResponse([0x01, 0x00, 0x00, 0x01, 0xaa]);
            return;
        }

        if (command === 55) {
            this.appCmdPending = true;
            this.queueResponse([0x01]);
            return;
        }

        if (command === 41 && this.appCmdPending) {
            this.appCmdPending = false;
            this.queueResponse([0x00]);
            return;
        }

        if (command === 58) {
            // OCR with CCS bit set (SDHC-compatible addressing for simulator simplicity).
            this.queueResponse([0x00, 0x40, 0x00, 0x00, 0x00]);
            return;
        }

        if (command === 17) {
            const blockIndex = this.parseBlockIndex(arg);
            if (blockIndex === null) {
                this.queueResponse([0x04]);
            } else {
                this.queueReadBlock(blockIndex);
                this.state.lastOp = 'read-block';
            }
            this.stateChanged = true;
            return;
        }

        if (command === 24) {
            const blockIndex = this.parseBlockIndex(arg);
            if (blockIndex === null) {
                this.queueResponse([0x04]);
            } else {
                this.beginWriteBlock(blockIndex);
                this.state.lastOp = 'write-block';
            }
            this.stateChanged = true;
            return;
        }

        // Generic "accepted" for unsupported commands.
        this.queueResponse([0x00]);
    }

    private async initLittleFsBackend() {
        const factory = await tryLoadLittleFsFactory();
        if (!factory) return;

        try {
            const littlefs = await factory({});
            const volume = createLittleFsVolume(littlefs, this.storage, this.blockSize, this.blockCount);
            if (!volume) return;

            const rc = volume.formatAndMount();
            if (rc < 0) {
                volume.destroy();
                return;
            }

            this.littleFsVolume = volume;
            this.backendName = 'littlefs-wasm';
            this.littleFsReady = true;

            // Mirror known files into the mounted littlefs volume.
            this.files.forEach((data, path) => {
                volume.writeFile(path, data);
            });

            this.state.backend = this.backendName;
            this.state.fsReady = true;
            this.stateChanged = true;
        } catch (e) {
            // Keep memory backend if module init fails.
        }
    }

    private formatCard() {
        this.storage.fill(0xff);
        this.files.clear();
        this.writeShadowFile('/README.TXT', this.textEncoder.encode('OpenHW virtual SD card\n'));

        if (this.littleFsVolume && this.littleFsReady) {
            try {
                this.littleFsVolume.formatAndMount();
                this.files.forEach((data, path) => {
                    this.littleFsVolume!.writeFile(path, data);
                });
            } catch (e) {
                // keep shadow storage as fallback
            }
        }

        this.state.lastOp = 'format';
        this.state.lastPath = '/';
        this.stateChanged = true;
    }

    private writeFile(pathLike: string, data: any) {
        const path = this.normalizePath(pathLike);
        const bytes = toUint8Array(data, this.textEncoder);

        this.writeShadowFile(path, bytes);
        if (this.littleFsVolume && this.littleFsReady) {
            this.littleFsVolume.writeFile(path, bytes);
        }

        this.state.lastPath = path;
        this.state.lastOp = 'write-file';
        this.stateChanged = true;
    }

    private readFile(pathLike: string): Uint8Array | null {
        const path = this.normalizePath(pathLike);
        const found = this.files.get(path) || null;
        if (!found) {
            this.state.lastPath = path;
            this.state.lastOp = 'read-miss';
            this.state.lastReadPreview = '';
            this.stateChanged = true;
            return null;
        }

        const previewBytes = found.subarray(0, Math.min(found.length, 80));
        this.state.lastPath = path;
        this.state.lastOp = 'read-file';
        this.state.lastReadPreview = this.textDecoder.decode(previewBytes);
        this.stateChanged = true;
        return new Uint8Array(found);
    }

    onPinStateChange(pinId: string, isHigh: boolean) {
        const pin = String(pinId || '').toUpperCase();
        if (pin === 'CS') {
            this.csHigh = isHigh;
            this.state.selected = !this.csHigh;
            if (this.csHigh) {
                this.commandFrame = [];
                this.writeState = null;
            }
            this.stateChanged = true;
            return;
        }

        if (pin === 'VCC' || pin === 'GND') {
            this.refreshPowerState();
        }
    }

    onEvent(event: any) {
        const type = String(event?.type || '').toUpperCase();
        if (!type) return;

        if (type === 'SD_MOUNT' || type === 'MOUNT') {
            this.setMounted(true);
            this.state.lastOp = 'mount';
            return;
        }

        if (type === 'SD_UNMOUNT' || type === 'UNMOUNT' || type === 'EJECT') {
            this.setMounted(false);
            this.state.lastOp = 'unmount';
            return;
        }

        if (type === 'SD_FORMAT' || type === 'FORMAT') {
            this.formatCard();
            return;
        }

        if (type === 'SD_WRITE_FILE' || type === 'WRITE_FILE') {
            this.writeFile(event?.path || event?.name || '/LOG.TXT', event?.data ?? event?.content ?? '');
            return;
        }

        if (type === 'SD_READ_FILE' || type === 'READ_FILE') {
            this.readFile(event?.path || event?.name || '/README.TXT');
            return;
        }

        if (type === 'SD_DELETE_FILE' || type === 'DELETE_FILE') {
            const path = this.normalizePath(event?.path || event?.name || '');
            if (this.files.delete(path)) {
                this.state.lastPath = path;
                this.state.lastOp = 'delete-file';
                this.updateFsCounters();
                this.stateChanged = true;
            }
        }
    }

    onSPIByte(value: number) {
        this.refreshPowerState();

        if (!this.mounted || !this.powered || this.csHigh) {
            return 0xff;
        }

        const byte = value & 0xff;
        this.lastActivityAt = Date.now();
        this.bytesIn += 1;
        this.state.bytesIn = this.bytesIn;

        if (this.responseQueue.length > 0) {
            return this.emitResponseByte();
        }

        if (this.writeState) {
            this.handleWriteByte(byte);
            return this.emitResponseByte();
        }

        if (this.commandFrame.length === 0) {
            if ((byte & 0xc0) === 0x40) {
                this.commandFrame.push(byte);
            } else if (byte === 0x9f) {
                // Legacy SPI probe compatibility.
                this.queueResponse([0x53, 0x44, 0x30]);
            }
            return this.emitResponseByte();
        }

        this.commandFrame.push(byte);
        if (this.commandFrame.length >= 6) {
            const frame = this.commandFrame.slice(0, 6);
            this.commandFrame = [];
            this.handleCommandFrame(frame);
        }

        return this.emitResponseByte();
    }

    update() {
        this.refreshPowerState();

        const active = (Date.now() - this.lastActivityAt) < 120;
        if (this.state.activity !== active) {
            this.state.activity = active;
            this.stateChanged = true;
        }

        const fileCount = this.files.size;
        if (this.state.fileCount !== fileCount) {
            this.state.fileCount = fileCount;
            this.stateChanged = true;
        }

        const usedBytes = this.computeUsedBytes();
        if (this.state.usedBytes !== usedBytes) {
            this.state.usedBytes = usedBytes;
            this.stateChanged = true;
        }
    }
}

class GenericI2CDeviceLogic extends BaseComponent {
    private readonly address: number;
    private readonly readQueue: number[] = [];

    constructor(id: string, manifest: any) {
        super(id, manifest);

        const type = String(manifest?.type || '').toLowerCase();
        const defaultAddress = type === 'openhw-lcd2004-i2c'
            ? 0x27
            : type === 'max30102'
                ? 0x57
                : 0x3c;
        const rawAddress = Number(
            manifest?.attrs?.address
            ?? manifest?.attrs?.i2cAddress
            ?? manifest?.attrs?.addr
            ?? defaultAddress
        );
        this.address = Number.isFinite(rawAddress) ? (rawAddress & 0x7f) : defaultAddress;

        this.state = {
            ...this.state,
            i2cAddress: this.address,
            i2cRxBytes: 0,
            i2cTxBytes: 0,
            lastWrite: 0,
            lastRead: 0xff,
        };
    }

    onI2CStart(address: number, read: boolean): boolean {
        const ack = (address & 0x7f) === this.address;
        this.state.lastReadMode = !!read;
        this.stateChanged = true;
        return ack;
    }

    onI2CByte(_address: number, data: number): boolean {
        const byte = data & 0xff;
        this.state.lastWrite = byte;
        this.state.i2cRxBytes = Number(this.state.i2cRxBytes || 0) + 1;
        this.stateChanged = true;

        if (this.readQueue.length < 32) {
            this.readQueue.push(byte);
        }
        return true;
    }

    onI2CReadByte(): number {
        const byte = this.readQueue.length > 0
            ? this.readQueue.shift()!
            : Number(this.state.defaultReadByte ?? 0xff) & 0xff;
        this.state.lastRead = byte;
        this.state.i2cTxBytes = Number(this.state.i2cTxBytes || 0) + 1;
        this.stateChanged = true;
        return byte;
    }
}

class GenericSPIDeviceLogic extends BaseComponent {
    onSPIByte(data: number): number {
        const byte = data & 0xff;
        this.state.lastWrite = byte;
        this.state.spiRxBytes = Number(this.state.spiRxBytes || 0) + 1;
        this.stateChanged = true;

        const response = Number(this.state.defaultReadByte ?? this.state.spiResponse ?? 0xff);
        return Number.isFinite(response) ? (response & 0xff) : 0xff;
    }
}

class SimulationMonitorLogic extends BaseComponent {
    private simStartTime: number = 0;
    private lastSampleTime: number = 0;
    private lastCycles: number = 0;
    private sliceDurations: number[] = [];
    private lastSerializationTimeMs: number = 0.05;
    private lastPayloadBytes: number = 1024;

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.simStartTime = performance.now();
        this.lastSampleTime = performance.now();
        this.state = {
            simulationSpeed: 1.0,
            timeDriftMs: 0,
            executionJitterMs: 0,
            frameSkips: 0,
            workerBufferLatency: 0,
            workerCpuLoadPercentage: 0,
            telemetrySerializationTimeMs: 0,
            telemetryPayloadBytes: 0,
            canvasFps: 60,
            uiMainThreadBlockedTimeMs: 0,
            workerMessageQueueLagMs: 0
        };
        this.stateChanged = true;
    }

    updateMetrics(cpuCycles: number, targetFreq: number, isTelemetryEnabled: boolean, watchedParams: string[]) {
        const now = performance.now();
        if (this.simStartTime === 0) {
            this.simStartTime = now;
            this.lastSampleTime = now;
            this.lastCycles = cpuCycles;
            return;
        }

        const realDelta = Math.max(0.001, now - this.lastSampleTime);
        const cycleDelta = Math.max(0, cpuCycles - this.lastCycles);

        const watchAll = watchedParams.includes('all');
        const watchSram = watchAll || watchedParams.includes('deepSiliconSRAM');
        const activeParamsCount = watchAll ? 10 : watchedParams.length;

        if (isTelemetryEnabled) {
            this.lastSerializationTimeMs = watchSram ? 8.4 + (activeParamsCount * 0.2) : 0.4 + (activeParamsCount * 0.05);
            this.lastPayloadBytes = watchSram ? 38500 + (activeParamsCount * 500) : 1250 + (activeParamsCount * 120);
        } else {
            this.lastSerializationTimeMs = 0.02;
            this.lastPayloadBytes = 240;
        }

        // 1. simulationSpeed
        const virtualTimeDelta = (cycleDelta / targetFreq) * 1000;
        const speed = Number((virtualTimeDelta / realDelta).toFixed(3));

        // 2. timeDriftMs
        const totalVirtualTimeMs = (cpuCycles / targetFreq) * 1000;
        const totalRealTimeMs = now - this.simStartTime;
        const drift = Number((totalVirtualTimeMs - totalRealTimeMs).toFixed(2));

        // 3. executionJitterMs
        this.sliceDurations.push(realDelta);
        if (this.sliceDurations.length > 30) this.sliceDurations.shift();
        const avgSlice = this.sliceDurations.reduce((a, b) => a + b, 0) / this.sliceDurations.length;
        const jitter = Number(Math.abs(realDelta - avgSlice).toFixed(2));

        // 4. frameSkips
        let skips = this.state?.frameSkips || 0;
        if (realDelta > 25) skips++;

        // 5. workerBufferLatency
        const bufferLatency = Number((this.lastSerializationTimeMs * 1.2).toFixed(2));

        // 6. workerCpuLoadPercentage
        const load = isTelemetryEnabled ? Number(Math.min(98, (this.lastSerializationTimeMs / realDelta) * 100 + 15).toFixed(1)) : Number((2.5).toFixed(1));

        this.lastSampleTime = now;
        this.lastCycles = cpuCycles;

        const nextState = {
            simulationSpeed: Number.isFinite(speed) ? speed : 1.0,
            timeDriftMs: drift,
            executionJitterMs: jitter,
            frameSkips: skips,
            workerBufferLatency: bufferLatency,
            workerCpuLoadPercentage: load,
            telemetrySerializationTimeMs: Number(this.lastSerializationTimeMs.toFixed(3)),
            telemetryPayloadBytes: this.lastPayloadBytes,
            canvasFps: isTelemetryEnabled ? (load > 50 ? 28 : 58) : 60,
            uiMainThreadBlockedTimeMs: isTelemetryEnabled ? Number((this.lastSerializationTimeMs * 2.5).toFixed(1)) : 1.2,
            workerMessageQueueLagMs: isTelemetryEnabled ? (load > 50 ? 12.4 : 1.5) : 0.2
        };

        this.state = nextState;
        this.stateChanged = true;
        return nextState;
    }

    getSyncState() {
        this.stateChanged = true;
        return this.state;
    }

    getTelemetryData() {
        return this.state;
    }
}

export const LOGIC_REGISTRY: Record<string, any> = {
    'wokwi-led': LEDLogic,
    'openhw-led': LEDLogic,
    'wokwi-arduino-uno': UnoLogic,
    'openhw-arduino-uno': UnoLogic,
    'wokwi-raspberry-pi-pico': PicoLogic,
    'openhw-raspberry-pi-pico': PicoLogic,
    'wokwi-raspberry-pi-pico-w': PicoLogic,
    'openhw-raspberry-pi-pico-w': PicoLogic,
    'wokwi-resistor': ResistorLogic,
    'openhw-resistor': ResistorLogic,
    'wokwi-pushbutton': PushbuttonLogic,
    'openhw-pushbutton': PushbuttonLogic,
    'wokwi-power-supply': PowerSupplyLogic,
    'openhw-power-supply': PowerSupplyLogic,
    'wokwi-battery': BatteryLogic,
    'openhw-battery': BatteryLogic,
    'wokwi-neopixel-matrix': NeopixelLogic,
    'openhw-neopixel-matrix': NeopixelLogic,
    'wokwi-ws2812b': NeopixelLogic,
    'openhw-ws2812b': NeopixelLogic,
    'wokwi-ws2821b': NeopixelLogic,
    'openhw-ws2821b': NeopixelLogic,
    'wokwi-buzzer': BuzzerLogic,
    'openhw-buzzer': BuzzerLogic,
    'wokwi-motor': MotorLogic,
    'openhw-motor': MotorLogic,
    'wokwi-servo': ServoLogic,
    'openhw-servo': ServoLogic,
    'wokwi-motor-driver': MotorDriverLogic,
    'openhw-motor-driver': MotorDriverLogic,
    'wokwi-slide-potentiometer': SlidePotLogic,
    'openhw-slide-potentiometer': SlidePotLogic,
    'wokwi-potentiometer': PotentiometerLogic,
    'openhw-potentiometer': PotentiometerLogic,
    'wokwi-lcd2004-i2c': Lcd2004I2CLogic,
    'openhw-lcd2004-i2c': Lcd2004I2CLogic,
    'wokwi-lcd1602': Lcd1602Logic,
    'openhw-lcd1602': Lcd1602Logic,
    'wokwi-lcd1602-i2c': Lcd2004I2CLogic,
    'openhw-lcd1602-i2c': Lcd2004I2CLogic,
    'wokwi-ssd1306-oled': SSD1306Logic,
    'openhw-ssd1306-oled': SSD1306Logic,
    max30102: GenericI2CDeviceLogic,
    'wokwi-max7219': GenericSPIDeviceLogic,
    'openhw-max7219': GenericSPIDeviceLogic,
    'wokwi-ldr-module': BaseComponent,
    'openhw-ldr-module': BaseComponent,
    'wokwi-7segment': BaseComponent,
    'openhw-7segment': BaseComponent,
    'wokwi-ili9341': ILI9341Logic,
    'openhw-ili9341': ILI9341Logic,
    'wokwi-sd-card': SDCardLogic,
    'openhw-sd-card': SDCardLogic,
    'shift_register': ShiftRegisterLogic,
    'wokwi-membrane-keypad': KeypadLogic,
    'openhw-membrane-keypad': KeypadLogic,
    'wokwi-analog-joystick': JoystickLogic,
    'openhw-analog-joystick': JoystickLogic,
    'openhw-rotary-encoder': RotaryEncoderLogic,
    'wokwi-rotary-encoder': RotaryEncoderLogic,
    'logic-ic-74xx': LogicIC74xxLogic,
    'logic-mux-2to1': Mux2to1Logic,
    'logic-d-flipflop': DFlipFlopLogic,
    'logic-d-flipflop-r': DFlipFlopRLogic,
    'logic-d-flipflop-dsr': DFlipFlopDsrLogic,
    'logic-clock-generator': ClockGeneratorLogic,
    'wokwi-tm1637-7segment': WokwiTM1637Logic,
    'openhw-tm1637-7segment': WokwiTM1637Logic,
    'wokwi-rgb-led': RGBLEDLogic,
    'openhw-rgb-led': RGBLEDLogic,
    'wokwi-nokia-5110': Nokia5110Logic,
    'openhw-nokia-5110': Nokia5110Logic,
    'wokwi-l293d': L293DLogic,
    'openhw-l293d': L293DLogic,
    'wokwi-arduino-nano': UnoLogic,
    'openhw-arduino-nano': UnoLogic,
    'wokwi-pca9685': PCA9685Logic,
    'openhw-pca9685': PCA9685Logic,
    'wokwi-pca9865': PCA9685Logic,
    'openhw-pca9865': PCA9685Logic,
    'wokwi-soil-moisture-sensor': SoilMoistureSensorLogic,
    'openhw-soil-moisture-sensor': SoilMoistureSensorLogic,
    'wokwi-photodiode': PhotodiodeLogic,
    'openhw-photodiode': PhotodiodeLogic,
    'wokwi-diode': DiodeLogic,
    'openhw-diode': DiodeLogic,
    'wokwi-npn-transistor': NPNTransistorLogic,
    'openhw-npn-transistor': NPNTransistorLogic,
    'wokwi-a4988': A4988Logic,
    'openhw-a4988': A4988Logic,
    'wokwi-cd74hc4067': CD74HC4067Logic,
    'openhw-cd74hc4067': CD74HC4067Logic,
    'wokwi-logic-analyzer': LogicAnalyzerLogic,
    'openhw-logic-analyzer': LogicAnalyzerLogic,
    'wokwi-breadboard': BaseComponent,
    'openhw-breadboard': BaseComponent,
    'wokwi-breadboard-half': BaseComponent,
    'openhw-breadboard-half': BaseComponent,
    'wokwi-bmp180': BaseComponent,
    'openhw-bmp180': BaseComponent,
    'wokwi-bmp180-breakout': BaseComponent,
    'openhw-bmp180-breakout': BaseComponent,
    'wokwi-ds1307-rtc': BaseComponent,
    'openhw-ds1307-rtc': BaseComponent,
    'wokwi-hc-sr04': BaseComponent,
    'openhw-hc-sr04': BaseComponent,
    'wokwi-mpu6050': BaseComponent,
    'openhw-mpu6050': BaseComponent,
    'wokwi-nlsf595': BaseComponent,
    'openhw-nlsf595': BaseComponent,
    'wokwi-relay-module': BaseComponent,
    'openhw-relay-module': BaseComponent,
    'wokwi-stepper-motor': BaseComponent,
    'openhw-stepper-motor': BaseComponent,
    'wokwi-arduino-mega': MegaLogic,
    'openhw-arduino-mega': MegaLogic,
    'wokwi-attiny85': BaseComponent,
    'openhw-attiny85': BaseComponent,
    'openhw-pico': PicoLogic,
    'openhw-pico-w': PicoLogic,
    'openhw-photoresistor': BaseComponent,
    'openhw-ntc-thermistor': BaseComponent,
    'openhw-ntc-temperature-sensor': BaseComponent,
    'openhw-charger': BaseComponent,
    'openhw-breadboard-mini': BaseComponent,
    'openhw-neopixel-ring': NeopixelLogic,
    'openhw-arduino-sensor-shield': BaseComponent,
    'openhw-simulation-monitor': SimulationMonitorLogic,
    'wokwi-ds18b20': DS18B20Logic,
    'openhw-ds18b20': DS18B20Logic,
    'wokwi-ir-receiver': IRReceiverLogic,
    'openhw-ir-receiver': IRReceiverLogic,
    'wokwi-mfrc522': MFRC522Logic,
    'openhw-mfrc522': MFRC522Logic,
};

// Per-type pin lists so every component's pins are registered correctly
export const COMPONENT_PINS: Record<string, { id: string }[]> = {
    'wokwi-led': [{ id: 'A' }, { id: 'K' }],
    'openhw-led': [{ id: 'A' }, { id: 'K' }],
    'wokwi-arduino-uno': UNO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-arduino-uno': UNO_BOARD_PINS.map((id: string) => ({ id })),
    'wokwi-raspberry-pi-pico': PICO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-raspberry-pi-pico': PICO_BOARD_PINS.map((id: string) => ({ id })),
    'wokwi-raspberry-pi-pico-w': PICO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-raspberry-pi-pico-w': PICO_BOARD_PINS.map((id: string) => ({ id })),
    'wokwi-resistor': [{ id: 'p1' }, { id: 'p2' }],
    'openhw-resistor': [{ id: 'p1' }, { id: 'p2' }],
    'wokwi-pushbutton': [{ id: '1l' }, { id: '2l' }, { id: '1r' }, { id: '2r' }, { id: '1' }, { id: '2' }],
    'openhw-pushbutton': [{ id: '1l' }, { id: '2l' }, { id: '1r' }, { id: '2r' }, { id: '1' }, { id: '2' }],
    'wokwi-buzzer': [{ id: '1' }, { id: '2' }],
    'openhw-buzzer': [{ id: '1' }, { id: '2' }],
    'wokwi-neopixel-matrix': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-neopixel-matrix': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-ws2812b': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-ws2812b': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-ws2821b': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-ws2821b': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-servo': [{ id: 'GND' }, { id: 'V+' }, { id: 'PWM' }],
    'openhw-servo': [{ id: 'GND' }, { id: 'V+' }, { id: 'PWM' }],
    'wokwi-motor': [{ id: '1' }, { id: '2' }],
    'openhw-motor': [{ id: '1' }, { id: '2' }],
    'wokwi-motor-driver': [{ id: 'ENA' }, { id: 'ENB' }, { id: 'IN1' }, { id: 'IN2' }, { id: 'IN3' }, { id: 'IN4' }, { id: 'OUT1' }, { id: 'OUT2' }, { id: 'OUT3' }, { id: 'OUT4' }, { id: '12V' }, { id: '5V' }, { id: 'GND' }],
    'openhw-motor-driver': [{ id: 'ENA' }, { id: 'ENB' }, { id: 'IN1' }, { id: 'IN2' }, { id: 'IN3' }, { id: 'IN4' }, { id: 'OUT1' }, { id: 'OUT2' }, { id: 'OUT3' }, { id: 'OUT4' }, { id: '12V' }, { id: '5V' }, { id: 'GND' }],
    'wokwi-potentiometer': [{ id: '1' }, { id: '2' }, { id: 'SIG' }],
    'openhw-potentiometer': [{ id: '1' }, { id: '2' }, { id: 'SIG' }],
    'wokwi-slide-potentiometer': [{ id: 'GND' }, { id: 'SIG' }, { id: 'VCC' }],
    'openhw-slide-potentiometer': [{ id: 'GND' }, { id: 'SIG' }, { id: 'VCC' }],
    'wokwi-lcd2004-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'openhw-lcd2004-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'wokwi-lcd1602': [{ id: 'VSS' }, { id: 'VDD' }, { id: 'V0' }, { id: 'RS' }, { id: 'RW' }, { id: 'E' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'A' }, { id: 'K' }],
    'openhw-lcd1602': [{ id: 'VSS' }, { id: 'VDD' }, { id: 'V0' }, { id: 'RS' }, { id: 'RW' }, { id: 'E' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'A' }, { id: 'K' }],
    'wokwi-lcd1602-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'openhw-lcd1602-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'wokwi-ssd1306-oled': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SCL' }, { id: 'SDA' }],
    'openhw-ssd1306-oled': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SCL' }, { id: 'SDA' }],
    max30102: [{ id: 'VIN' }, { id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'INT' }, { id: 'IRD' }, { id: 'RD' }, { id: 'NC' }],
    'wokwi-max7219': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DIN' }, { id: 'CS' }, { id: 'CLK' }, { id: 'VCC_OUT' }, { id: 'GND_OUT' }, { id: 'DOUT' }, { id: 'CS_OUT' }, { id: 'CLK_OUT' }],
    'openhw-max7219': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DIN' }, { id: 'CS' }, { id: 'CLK' }, { id: 'VCC_OUT' }, { id: 'GND_OUT' }, { id: 'DOUT' }, { id: 'CS_OUT' }, { id: 'CLK_OUT' }],
    'wokwi-ldr-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }],
    'openhw-ldr-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }],
    'wokwi-7segment': [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }, { id: 'F' }, { id: 'G' }, { id: 'DP' }, { id: 'DIG1' }, { id: 'DIG2' }, { id: 'DIG3' }, { id: 'DIG4' }, { id: 'COLON' }],
    'openhw-7segment': [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }, { id: 'F' }, { id: 'G' }, { id: 'DP' }, { id: 'DIG1' }, { id: 'DIG2' }, { id: 'DIG3' }, { id: 'DIG4' }, { id: 'COLON' }],
    'wokwi-ili9341': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'RESET' }, { id: 'DC' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'LED' }, { id: 'MISO' }],
    'openhw-ili9341': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'RESET' }, { id: 'DC' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'LED' }, { id: 'MISO' }],
    'wokwi-sd-card': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'SCK' }, { id: 'MOSI' }, { id: 'MISO' }],
    'openhw-sd-card': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'SCK' }, { id: 'MOSI' }, { id: 'MISO' }],
    'wokwi-power-supply': [{ id: 'GND' }, { id: '5V' }, { id: 'VCC' }],
    'openhw-power-supply': [{ id: 'GND' }, { id: '5V' }, { id: 'VCC' }],
    'shift_register': [{ id: 'vcc' }, { id: 'gnd' }, { id: 'ser' }, { id: 'srclk' }, { id: 'rclk' }, { id: 'oe' }, { id: 'srclr' }, { id: 'q0' }, { id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }, { id: 'q6' }, { id: 'q7' }, { id: 'q7s' }],
    'wokwi-membrane-keypad': [{ id: 'R1' }, { id: 'R2' }, { id: 'R3' }, { id: 'R4' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }],
    'openhw-membrane-keypad': [{ id: 'R1' }, { id: 'R2' }, { id: 'R3' }, { id: 'R4' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }],
    'wokwi-analog-joystick': [{ id: 'GND' }, { id: '5V' }, { id: 'VRX' }, { id: 'VRY' }, { id: 'SW' }],
    'openhw-analog-joystick': [{ id: 'GND' }, { id: '5V' }, { id: 'VRX' }, { id: 'VRY' }, { id: 'SW' }],
    'openhw-rotary-encoder': [{ id: 'CLK' }, { id: 'DT' }, { id: 'SW' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-rotary-encoder': [{ id: 'CLK' }, { id: 'DT' }, { id: 'SW' }, { id: 'VCC' }, { id: 'GND' }],
    'logic-ic-74xx': [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }, { id: 'p5' }, { id: 'p6' }, { id: 'p7' }, { id: 'p8' }, { id: 'p9' }, { id: 'p10' }, { id: 'p11' }, { id: 'p12' }, { id: 'p13' }, { id: 'p14' }],
    'logic-mux-2to1': [{ id: 'D0' }, { id: 'D1' }, { id: 'SEL' }, { id: 'OUT' }],
    'logic-d-flipflop': [{ id: 'D' }, { id: 'CLK' }, { id: 'Q' }, { id: 'Qbar' }],
    'logic-d-flipflop-r': [{ id: 'D' }, { id: 'CLK' }, { id: 'R' }, { id: 'Q' }, { id: 'Qbar' }],
    'logic-d-flipflop-dsr': [{ id: 'D' }, { id: 'CLK' }, { id: 'S' }, { id: 'R' }, { id: 'Q' }, { id: 'Qbar' }],
    'logic-clock-generator': [{ id: 'OUT' }],
    'wokwi-tm1637-7segment': [{ id: 'CLK' }, { id: 'DIO' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-tm1637-7segment': [{ id: 'CLK' }, { id: 'DIO' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-neopixel-ring': [{ id: 'DIN' }, { id: 'VDD' }, { id: 'VSS' }, { id: 'DOUT' }],
    'wokwi-rgb-led': [{ id: 'R' }, { id: 'COM' }, { id: 'G' }, { id: 'B' }],
    'openhw-rgb-led': [{ id: 'R' }, { id: 'COM' }, { id: 'G' }, { id: 'B' }],
    'wokwi-nokia-5110': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SCE' }, { id: 'RST' }, { id: 'DC' }, { id: 'DN' }, { id: 'SCLK' }, { id: 'LED' }],
    'openhw-nokia-5110': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SCE' }, { id: 'RST' }, { id: 'DC' }, { id: 'DN' }, { id: 'SCLK' }, { id: 'LED' }],
    'wokwi-l293d': [{ id: 'EN1,2' }, { id: 'IN1' }, { id: 'OUT1' }, { id: 'GND1' }, { id: 'GND2' }, { id: 'OUT2' }, { id: 'IN2' }, { id: 'VCC2' }, { id: 'VCC1' }, { id: 'IN4' }, { id: 'OUT4' }, { id: 'GND4' }, { id: 'GND3' }, { id: 'OUT3' }, { id: 'IN3' }, { id: 'EN3,4' }],
    'openhw-l293d': [{ id: 'EN1,2' }, { id: 'IN1' }, { id: 'OUT1' }, { id: 'GND1' }, { id: 'GND2' }, { id: 'OUT2' }, { id: 'IN2' }, { id: 'VCC2' }, { id: 'VCC1' }, { id: 'IN4' }, { id: 'OUT4' }, { id: 'GND4' }, { id: 'GND3' }, { id: 'OUT3' }, { id: 'IN3' }, { id: 'EN3,4' }],
    'wokwi-arduino-nano': [{ id: 'D0' }, { id: 'RX' }, { id: 'D1' }, { id: 'TX' }, { id: 'D2' }, { id: '2' }, { id: 'D3' }, { id: '3' }, { id: 'D4' }, { id: '4' }, { id: 'D5' }, { id: '5' }, { id: 'D6' }, { id: '6' }, { id: 'D7' }, { id: '7' }, { id: 'D8' }, { id: '8' }, { id: 'D9' }, { id: '9' }, { id: 'D10' }, { id: '10' }, { id: 'D11' }, { id: '11' }, { id: 'D12' }, { id: '12' }, { id: 'D13' }, { id: '13' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: '5V' }, { id: 'VCC' }, { id: '3V3' }, { id: 'GND' }, { id: 'GND.1' }, { id: 'GND.2' }, { id: 'RST' }, { id: 'RST.1' }, { id: 'RST.2' }, { id: 'VIN' }, { id: 'AREF' }],
    'openhw-arduino-nano': [{ id: 'D0' }, { id: 'RX' }, { id: 'D1' }, { id: 'TX' }, { id: 'D2' }, { id: '2' }, { id: 'D3' }, { id: '3' }, { id: 'D4' }, { id: '4' }, { id: 'D5' }, { id: '5' }, { id: 'D6' }, { id: '6' }, { id: 'D7' }, { id: '7' }, { id: 'D8' }, { id: '8' }, { id: 'D9' }, { id: '9' }, { id: 'D10' }, { id: '10' }, { id: 'D11' }, { id: '11' }, { id: 'D12' }, { id: '12' }, { id: 'D13' }, { id: '13' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: '5V' }, { id: 'VCC' }, { id: '3V3' }, { id: 'GND' }, { id: 'GND.1' }, { id: 'GND.2' }, { id: 'RST' }, { id: 'RST.1' }, { id: 'RST.2' }, { id: 'VIN' }, { id: 'AREF' }],
    'wokwi-pca9685': [{ id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'VCC' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'S4' }, { id: 'S5' }, { id: 'S6' }, { id: 'S7' }, { id: 'S8' }, { id: 'S9' }, { id: 'S10' }, { id: 'S11' }, { id: 'S12' }, { id: 'S13' }, { id: 'S14' }, { id: 'S15' }],
    'openhw-pca9685': [{ id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'VCC' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'S4' }, { id: 'S5' }, { id: 'S6' }, { id: 'S7' }, { id: 'S8' }, { id: 'S9' }, { id: 'S10' }, { id: 'S11' }, { id: 'S12' }, { id: 'S13' }, { id: 'S14' }, { id: 'S15' }],
    'wokwi-pca9865': [{ id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'VCC' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'S4' }, { id: 'S5' }, { id: 'S6' }, { id: 'S7' }, { id: 'S8' }, { id: 'S9' }, { id: 'S10' }, { id: 'S11' }, { id: 'S12' }, { id: 'S13' }, { id: 'S14' }, { id: 'S15' }],
    'openhw-pca9865': [{ id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'VCC' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'S4' }, { id: 'S5' }, { id: 'S6' }, { id: 'S7' }, { id: 'S8' }, { id: 'S9' }, { id: 'S10' }, { id: 'S11' }, { id: 'S12' }, { id: 'S13' }, { id: 'S14' }, { id: 'S15' }],
    'wokwi-soil-moisture-sensor': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SIG' }],
    'openhw-soil-moisture-sensor': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SIG' }],
    'wokwi-cd74hc4067': [{ id: 'VCC' }, { id: 'GND' }, { id: 'EN' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'SIG' }, { id: 'C0' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }, { id: 'C5' }, { id: 'C6' }, { id: 'C7' }, { id: 'C8' }, { id: 'C9' }, { id: 'C10' }, { id: 'C11' }, { id: 'C12' }, { id: 'C13' }, { id: 'C14' }, { id: 'C15' }],
    'openhw-cd74hc4067': [{ id: 'VCC' }, { id: 'GND' }, { id: 'EN' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'SIG' }, { id: 'C0' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }, { id: 'C5' }, { id: 'C6' }, { id: 'C7' }, { id: 'C8' }, { id: 'C9' }, { id: 'C10' }, { id: 'C11' }, { id: 'C12' }, { id: 'C13' }, { id: 'C14' }, { id: 'C15' }],
    'wokwi-logic-analyzer': [{ id: 'GND' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }],
    'openhw-logic-analyzer': [{ id: 'GND' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }],
    'wokwi-photodiode': [{ id: 'A' }, { id: 'C' }],
    'openhw-photodiode': [{ id: 'A' }, { id: 'C' }],
    'wokwi-diode': [{ id: 'A' }, { id: 'C' }],
    'openhw-diode': [{ id: 'A' }, { id: 'C' }],
    'wokwi-npn-transistor': [{ id: 'E' }, { id: 'B' }, { id: 'C' }],
    'openhw-npn-transistor': [{ id: 'E' }, { id: 'B' }, { id: 'C' }],
    'wokwi-a4988': [{ id: 'ENABLE' }, { id: 'MS1' }, { id: 'MS2' }, { id: 'MS3' }, { id: 'RESET' }, { id: 'SLEEP' }, { id: 'STEP' }, { id: 'DIR' }, { id: 'VMOT' }, { id: 'GND_MOT' }, { id: '2B' }, { id: '2A' }, { id: '1A' }, { id: '1B' }, { id: 'VDD' }, { id: 'GND_LOGIC' }],
    'openhw-a4988': [{ id: 'ENABLE' }, { id: 'MS1' }, { id: 'MS2' }, { id: 'MS3' }, { id: 'RESET' }, { id: 'SLEEP' }, { id: 'STEP' }, { id: 'DIR' }, { id: 'VMOT' }, { id: 'GND_MOT' }, { id: '2B' }, { id: '2A' }, { id: '1A' }, { id: '1B' }, { id: 'VDD' }, { id: 'GND_LOGIC' }],
    'wokwi-bmp180': [{ id: 'VIN' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }],
    'openhw-bmp180': [{ id: 'VIN' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }],
    'wokwi-bmp180-breakout': [{ id: 'VIN' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }],
    'openhw-bmp180-breakout': [{ id: 'VIN' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }],
    'wokwi-ds1307-rtc': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'openhw-ds1307-rtc': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'wokwi-hc-sr04': [{ id: 'VCC' }, { id: 'TRIG' }, { id: 'ECHO' }, { id: 'GND' }],
    'openhw-hc-sr04': [{ id: 'VCC' }, { id: 'TRIG' }, { id: 'ECHO' }, { id: 'GND' }],
    'wokwi-mpu6050': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }, { id: 'XDA' }, { id: 'XCL' }, { id: 'ADO' }, { id: 'INT' }],
    'openhw-mpu6050': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }, { id: 'XDA' }, { id: 'XCL' }, { id: 'ADO' }, { id: 'INT' }],
    'wokwi-nlsf595': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SER' }, { id: 'SRCLK' }, { id: 'RCLK' }, { id: 'OE' }, { id: 'SRCLR' }, { id: 'Q0' }, { id: 'Q1' }, { id: 'Q2' }, { id: 'Q3' }, { id: 'Q4' }, { id: 'Q5' }, { id: 'Q6' }, { id: 'Q7' }, { id: 'Q7S' }],
    'openhw-nlsf595': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SER' }, { id: 'SRCLK' }, { id: 'RCLK' }, { id: 'OE' }, { id: 'SRCLR' }, { id: 'Q0' }, { id: 'Q1' }, { id: 'Q2' }, { id: 'Q3' }, { id: 'Q4' }, { id: 'Q5' }, { id: 'Q6' }, { id: 'Q7' }, { id: 'Q7S' }],
    'wokwi-relay-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'IN' }, { id: 'NO' }, { id: 'NC' }, { id: 'COM' }],
    'openhw-relay-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'IN' }, { id: 'NO' }, { id: 'NC' }, { id: 'COM' }],
    'wokwi-stepper-motor': [{ id: 'A+' }, { id: 'A-' }, { id: 'B+' }, { id: 'B-' }],
    'openhw-stepper-motor': [{ id: 'A+' }, { id: 'A-' }, { id: 'B+' }, { id: 'B-' }],
    'wokwi-arduino-mega': [{ id: 'D0' }, { id: 'RX0' }, { id: 'D1' }, { id: 'TX0' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'D8' }, { id: 'D9' }, { id: 'D10' }, { id: 'D11' }, { id: 'D12' }, { id: 'D13' }, { id: 'D14' }, { id: 'TX3' }, { id: 'D15' }, { id: 'RX3' }, { id: 'D16' }, { id: 'TX2' }, { id: 'D17' }, { id: 'RX2' }, { id: 'D18' }, { id: 'TX1' }, { id: 'D19' }, { id: 'RX1' }, { id: 'D20' }, { id: 'SDA' }, { id: 'D21' }, { id: 'SCL' }, { id: 'D22' }, { id: 'D23' }, { id: 'D24' }, { id: 'D25' }, { id: 'D26' }, { id: 'D27' }, { id: 'D28' }, { id: 'D29' }, { id: 'D30' }, { id: 'D31' }, { id: 'D32' }, { id: 'D33' }, { id: 'D34' }, { id: 'D35' }, { id: 'D36' }, { id: 'D37' }, { id: 'D38' }, { id: 'D39' }, { id: 'D40' }, { id: 'D41' }, { id: 'D42' }, { id: 'D43' }, { id: 'D44' }, { id: 'D45' }, { id: 'D46' }, { id: 'D47' }, { id: 'D48' }, { id: 'D49' }, { id: 'D50' }, { id: 'MISO' }, { id: 'D51' }, { id: 'MOSI' }, { id: 'D52' }, { id: 'SCK' }, { id: 'D53' }, { id: 'SS' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: 'A8' }, { id: 'A9' }, { id: 'A10' }, { id: 'A11' }, { id: 'A12' }, { id: 'A13' }, { id: 'A14' }, { id: 'A15' }, { id: '5V' }, { id: '3V3' }, { id: 'GND' }, { id: 'GND.1' }, { id: 'GND.2' }, { id: 'RST' }, { id: 'VIN' }, { id: 'AREF' }, { id: 'IORF' }],
    'openhw-arduino-mega': [{ id: 'D0' }, { id: 'RX0' }, { id: 'D1' }, { id: 'TX0' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'D8' }, { id: 'D9' }, { id: 'D10' }, { id: 'D11' }, { id: 'D12' }, { id: 'D13' }, { id: 'D14' }, { id: 'TX3' }, { id: 'D15' }, { id: 'RX3' }, { id: 'D16' }, { id: 'TX2' }, { id: 'D17' }, { id: 'RX2' }, { id: 'D18' }, { id: 'TX1' }, { id: 'D19' }, { id: 'RX1' }, { id: 'D20' }, { id: 'SDA' }, { id: 'D21' }, { id: 'SCL' }, { id: 'D22' }, { id: 'D23' }, { id: 'D24' }, { id: 'D25' }, { id: 'D26' }, { id: 'D27' }, { id: 'D28' }, { id: 'D29' }, { id: 'D30' }, { id: 'D31' }, { id: 'D32' }, { id: 'D33' }, { id: 'D34' }, { id: 'D35' }, { id: 'D36' }, { id: 'D37' }, { id: 'D38' }, { id: 'D39' }, { id: 'D40' }, { id: 'D41' }, { id: 'D42' }, { id: 'D43' }, { id: 'D44' }, { id: 'D45' }, { id: 'D46' }, { id: 'D47' }, { id: 'D48' }, { id: 'D49' }, { id: 'D50' }, { id: 'MISO' }, { id: 'D51' }, { id: 'MOSI' }, { id: 'D52' }, { id: 'SCK' }, { id: 'D53' }, { id: 'SS' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: 'A8' }, { id: 'A9' }, { id: 'A10' }, { id: 'A11' }, { id: 'A12' }, { id: 'A13' }, { id: 'A14' }, { id: 'A15' }, { id: '5V' }, { id: '3V3' }, { id: 'GND' }, { id: 'GND.1' }, { id: 'GND.2' }, { id: 'RST' }, { id: 'VIN' }, { id: 'AREF' }, { id: 'IORF' }],
    'wokwi-attiny85': [{ id: 'PB0' }, { id: 'PB1' }, { id: 'PB2' }, { id: 'PB3' }, { id: 'PB4' }, { id: 'PB5' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-attiny85': [{ id: 'PB0' }, { id: 'PB1' }, { id: 'PB2' }, { id: 'PB3' }, { id: 'PB4' }, { id: 'PB5' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-pico': PICO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-pico-w': PICO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-photoresistor': [{ id: '1' }, { id: '2' }],
    'openhw-ntc-thermistor': [{ id: '1' }, { id: '2' }],
    'openhw-ntc-temperature-sensor': [{ id: 'VCC' }, { id: 'GND' }, { id: 'OUT' }],
    'wokwi-battery': [{ id: 'VCC' }, { id: 'GND' }],
    'openhw-battery': [{ id: 'VCC' }, { id: 'GND' }],
    'openhw-charger': [{ id: 'VIN+' }, { id: 'VIN-' }, { id: 'BAT+' }, { id: 'BAT-' }],
    'openhw-breadboard-mini': [{ id: 'a1' }, { id: 'b1' }, { id: 'c1' }, { id: 'd1' }, { id: 'e1' }, { id: 'f1' }, { id: 'g1' }, { id: 'h1' }, { id: 'i1' }, { id: 'j1' }],
    'openhw-neopixel-ring': [{ id: 'DIN' }, { id: 'VDD' }, { id: 'VSS' }, { id: 'DOUT' }],
    'openhw-arduino-sensor-shield': [{ id: 'VCC' }, { id: 'GND' }, { id: 'S' }],
    'openhw-simulation-monitor': [{ id: 'VCC' }, { id: 'GND' }, { id: 'TX' }, { id: 'RX' }],
    'wokwi-ds18b20': [{ id: 'GND' }, { id: 'DQ' }, { id: 'VDD' }],
    'openhw-ds18b20': [{ id: 'GND' }, { id: 'DQ' }, { id: 'VDD' }],
    'wokwi-ir-receiver': [{ id: 'OUT' }, { id: 'GND' }, { id: 'VCC' }],
    'openhw-ir-receiver': [{ id: 'OUT' }, { id: 'GND' }, { id: 'VCC' }],
    'wokwi-mfrc522': [{ id: '3V3' }, { id: 'RST' }, { id: 'GND' }, { id: 'IRQ' }, { id: 'MISO' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'SDA' }],
    'openhw-mfrc522': [{ id: '3V3' }, { id: 'RST' }, { id: 'GND' }, { id: 'IRQ' }, { id: 'MISO' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'SDA' }],
};

type RP2040ExecutableRangeInput =
    | [number | string, number | string]
    | { start: number | string; end: number | string }
    | { start: number | string; size: number | string };

type RP2040FlashPartitionInput = {
    offset: number | string;
    data: string | Uint8Array | ArrayBuffer | ArrayLike<number>;
    encoding?: 'base64' | 'hex' | 'utf8';
};

type RP2040ExecutableRange = {
    start: number;
    end: number;
    description?: string;
};

type RP2040FlashPartition = {
    offset: number;
    bytes: Uint8Array;
};

type RP2040FirmwareLoadOptions = {
    logicalFlashBytes?: number;
    partitions?: RP2040FlashPartition[];
};

function parseAddressValue(raw: unknown): number | null {
    if (typeof raw === 'number') {
        if (!Number.isFinite(raw)) return null;
        const clamped = Math.max(0, Math.min(0xffffffff, Math.floor(raw)));
        return clamped >>> 0;
    }

    if (typeof raw === 'string') {
        const value = raw.trim();
        if (!value) return null;
        const parsed = /^0x[0-9a-f]+$/i.test(value)
            ? parseInt(value, 16)
            : Number(value);
        if (!Number.isFinite(parsed)) return null;
        const clamped = Math.max(0, Math.min(0xffffffff, Math.floor(parsed)));
        return clamped >>> 0;
    }

    return null;
}

function normalizeRp2040ExecutableRanges(value: unknown): RP2040ExecutableRange[] {
    if (!Array.isArray(value)) return [];
    const ranges: RP2040ExecutableRange[] = [];

    for (const raw of value) {
        let start: number | null = null;
        let end: number | null = null;

        if (Array.isArray(raw) && raw.length >= 2) {
            start = parseAddressValue(raw[0]);
            end = parseAddressValue(raw[1]);
        } else if (raw && typeof raw === 'object') {
            const obj = raw as Record<string, unknown>;
            start = parseAddressValue(obj.start);

            if (Object.prototype.hasOwnProperty.call(obj, 'end')) {
                end = parseAddressValue(obj.end);
            } else if (Object.prototype.hasOwnProperty.call(obj, 'size')) {
                const size = parseAddressValue(obj.size);
                if (start !== null && size !== null && size > 0) {
                    const rawEnd = Number(start) + Number(size) - 1;
                    end = Math.max(0, Math.min(0xffffffff, Math.floor(rawEnd))) >>> 0;
                }
            }
        }

        if (start === null || end === null || end < start) {
            continue;
        }

        ranges.push({ start: start >>> 0, end: end >>> 0 });
    }

    return ranges;
}

function decodeHexToBytes(hex: string): Uint8Array {
    const normalized = String(hex || '')
        .trim()
        .replace(/^0x/i, '')
        .replace(/\s+/g, '');

    if (!normalized || (normalized.length % 2) !== 0) {
        return new Uint8Array();
    }

    const out = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < out.length; i++) {
        const byte = Number.parseInt(normalized.slice(i * 2, (i * 2) + 2), 16);
        if (Number.isNaN(byte)) {
            return new Uint8Array();
        }
        out[i] = byte & 0xff;
    }

    return out;
}

function decodeRp2040FlashPartitionBytes(data: unknown, encoding: unknown): Uint8Array | null {
    if (data == null) return null;

    if (data instanceof Uint8Array) {
        return data.length > 0 ? data : null;
    }

    if (data instanceof ArrayBuffer) {
        const out = new Uint8Array(data);
        return out.length > 0 ? out : null;
    }

    if (ArrayBuffer.isView(data)) {
        const view = data as ArrayBufferView;
        const out = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        return out.length > 0 ? out : null;
    }

    if (Array.isArray(data)) {
        if (data.length === 0) return null;
        return new Uint8Array(data.map((value) => Number(value) & 0xff));
    }

    if (typeof data === 'string') {
        const raw = data.trim();
        if (!raw) return null;

        const normalizedEncoding = String(encoding || '').trim().toLowerCase();
        if (normalizedEncoding === 'hex') {
            const decoded = decodeHexToBytes(raw);
            return decoded.length > 0 ? decoded : null;
        }

        if (normalizedEncoding === 'utf8') {
            const decoded = new TextEncoder().encode(data);
            return decoded.length > 0 ? decoded : null;
        }

        try {
            const decoded = decodeBase64ToBytes(raw);
            return decoded.length > 0 ? decoded : null;
        } catch (e) {
            // If string is not valid base64, preserve raw text bytes for robustness.
            const fallback = new TextEncoder().encode(data);
            return fallback.length > 0 ? fallback : null;
        }
    }

    return null;
}

function normalizeRp2040FlashPartitions(value: unknown): RP2040FlashPartition[] {
    if (!Array.isArray(value)) return [];

    const partitions: RP2040FlashPartition[] = [];
    for (const raw of value) {
        if (!raw || typeof raw !== 'object') continue;
        const obj = raw as Record<string, unknown>;
        const offset = parseAddressValue(obj.offset);
        if (offset === null) continue;

        const bytes = decodeRp2040FlashPartitionBytes(obj.data, obj.encoding);
        if (!bytes || bytes.length === 0) continue;

        partitions.push({ offset: offset >>> 0, bytes });
    }

    partitions.sort((a, b) => a.offset - b.offset);
    return partitions;
}

function getInternalBridgesForComponent(compId: string, type: string): string[][] {
    const bridges: string[][] = [];
    if (type === 'openhw-resistor' || type === 'wokwi-resistor' || type === 'via' || type === 'openhw-via' || type === 'wokwi-via' || type === 'openhw-wire' || type === 'wokwi-wire') {
        bridges.push([`${compId}:p1`, `${compId}:p2`]);
    } else if (type === 'openhw-breadboard' || type === 'openhw-breadboard-half' || type === 'openhw-breadboard-mini' || type === 'wokwi-breadboard' || type === 'wokwi-breadboard-half' || type === 'wokwi-breadboard-mini') {
        const isHalf = type.includes('half');
        const isMini = type.includes('mini');
        const maxRow = isMini ? 17 : (isHalf ? 30 : 63);
        const maxRail = isMini ? 0 : (isHalf ? 25 : 50);

        // Rows connections (a-e and f-j are separate blocks)
        for (let r = 1; r <= maxRow; r++) {
            const left = ['a', 'b', 'c', 'd', 'e'];
            for (let i = 0; i < left.length - 1; i++) {
                bridges.push([`${compId}:${r}${left[i]}`, `${compId}:${r}${left[i + 1]}`]);
            }
            const right = ['f', 'g', 'h', 'i', 'j'];
            for (let i = 0; i < right.length - 1; i++) {
                bridges.push([`${compId}:${r}${right[i]}`, `${compId}:${r}${right[i + 1]}`]);
            }
        }

        // Power rail connections (top and bottom, vcc and gnd)
        const rails = ['top_vcc', 'top_gnd', 'bottom_vcc', 'bottom_gnd'];
        for (const rail of rails) {
            for (let i = 1; i < maxRail; i++) {
                bridges.push([`${compId}:${rail}_${i}`, `${compId}:${rail}_${i + 1}`]);
            }
        }
    }
    return bridges;
}

export type AVRRunnerOptions = {
    boardId?: string;
    onByteTransmit?: (payload: { boardId: string; value: number; char: string; source?: string }) => void;
    serialBaudRate?: number;
    debugEnabled?: boolean;
    debugIntervalMs?: number;
    speed?: number;
    rp2040ExecutableRanges?: RP2040ExecutableRangeInput[];
    rp2040LogicalFlashBytes?: number | string;
    rp2040FlashPartitions?: RP2040FlashPartitionInput[];
    solverMode?: 'logic';
};

export type BoardRunner = {
    cpu: any;
    boardId: string;
    instances: Map<string, BaseComponent>;
    stop: () => void;
    reset?: () => void;
    serialRx: (data: string) => void;
    serialRxByte: (value: number) => void;
    serialRxByteFromSource?: (value: number, source?: string) => void;
    softSerialRxByte?: (value: number) => void;
    setSerialBaudRate: (baud: number) => void;
    getSerialBaudRate: () => number;
    setSpeed: (speed: number) => void;
    solverMode: 'logic';
    setSolverMode: (mode: 'logic') => void;
    setTelemetryEnabled: (enabled: boolean) => void;
    getRichTelemetrySnapshot: (options?: { mode?: 'standard' | 'deep' | 'delta' }) => any;
    getSimulatedTimeMs: () => number;
    forceEmitState?: () => void;
    running?: boolean;
};

const SOFT_SERIAL_SOURCE_LABELS = new Set(['softserial', 'soft-serial', 'soft_uart', 'soft-uart', 'softuart']);
const NEOPIXEL_COMPONENT_TYPE_PATTERN = /(neopixel|ws2812|ws2821)/i;
function parsePositiveInt(value: any): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function collectNeopixelShutdownStates(instances: Map<string, BaseComponent>): Array<{ id: string; state: any }> {
    const updates: Array<{ id: string; state: any }> = [];

    for (const inst of instances.values()) {
        if (!NEOPIXEL_COMPONENT_TYPE_PATTERN.test(String(inst.type || ''))) continue;

        const currentState = (inst.state && typeof inst.state === 'object') ? inst.state : {};
        const rows = parsePositiveInt(currentState.rows);
        const cols = parsePositiveInt(currentState.cols);
        const configuredCount = rows > 0 && cols > 0 ? rows * cols : 0;
        const existingPixels = Array.isArray(currentState.pixels) ? currentState.pixels : [];
        const pixelCount = Math.max(configuredCount, existingPixels.length);
        const nextState = {
            ...currentState,
            pixels: pixelCount > 0 ? new Array(pixelCount).fill(0) : [],
        };

        inst.state = nextState;
        inst.stateChanged = false;
        updates.push({ id: inst.id, state: nextState });
    }

    return updates;
}
function isSoftSerialSourceLabel(source: string): boolean {
    const key = String(source || '').trim().toLowerCase();
    return SOFT_SERIAL_SOURCE_LABELS.has(key);
}
type ConnectedComponentPin = {
    inst: BaseComponent;
    pinId: string;
};
function collectConnectedComponentPins(
    boardId: string,
    boardPinAliases: string[],
    wires: any[],
    instances: Map<string, BaseComponent>
): ConnectedComponentPin[] {
    const aliasSet = new Set(boardPinAliases.map((v) => String(v || '').toUpperCase()));
    const adjacency = new Map<string, Set<string>>();

    const connect = (a: string, b: string) => {
        if (!adjacency.has(a)) adjacency.set(a, new Set());
        if (!adjacency.has(b)) adjacency.set(b, new Set());
        adjacency.get(a)!.add(b);
        adjacency.get(b)!.add(a);
    };

    for (const wire of wires || []) {
        if (!wire?.from || !wire?.to) continue;
        connect(String(wire.from), String(wire.to));
    }

    for (const [id, inst] of instances.entries()) {
        if (inst.type === 'openhw-resistor' || inst.type === 'openhw-resistor') {
            connect(`${id}:p1`, `${id}:p2`);
        }
    }

    const startNodes: string[] = [];
    for (const node of adjacency.keys()) {
        const [compId, pinId] = String(node).split(':');
        if (compId !== boardId) continue;
        if (aliasSet.has(String(pinId || '').toUpperCase())) {
            startNodes.push(node);
        }
    }

    if (!startNodes.length) return [];

    const visited = new Set<string>();
    const queue = [...startNodes];
    startNodes.forEach((n) => visited.add(n));

    while (queue.length > 0) {
        const node = queue.shift()!;
        for (const n of adjacency.get(node) || []) {
            if (visited.has(n)) continue;
            visited.add(n);
            queue.push(n);
        }
    }

    const out = new Map<string, ConnectedComponentPin>();
    for (const node of visited) {
        const [compId, pinId] = String(node).split(':');
        if (!compId || compId === boardId) continue;
        const inst = instances.get(compId);
        if (!inst) continue;
        if (inst.type === 'openhw-resistor' || inst.type === 'openhw-resistor') continue;
        out.set(`${compId}:${pinId}`, { inst, pinId });
    }

    return Array.from(out.values());
}
function invokeOptional(inst: any, names: string[], args: any[]): any {
    for (const name of names) {
        const fn = inst?.[name];
        if (typeof fn === 'function') {
            return fn.apply(inst, args);
        }
    }
    return undefined;
}
const MEDIUM_COMPONENT_STATE_WEIGHT = 2_048;
const HEAVY_COMPONENT_STATE_WEIGHT = 8_192;
const MEDIUM_COMPONENT_MIN_SYNC_MS = 55;
const HEAVY_COMPONENT_MIN_SYNC_MS = 95;
function estimateStatePayloadWeight(value: any, depth = 0): number {
    if (value == null) return 0;

    if (typeof value === 'string') return value.length;
    if (typeof value === 'number' || typeof value === 'boolean') return 8;

    if (ArrayBuffer.isView(value)) {
        return Number((value as any)?.byteLength || (value as any)?.length || 0);
    }

    if (value instanceof ArrayBuffer) {
        return Number(value.byteLength || 0);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return 0;
        if (depth >= 2) return value.length;

        const sampleCount = Math.min(value.length, 16);
        let sampleWeight = 0;
        for (let i = 0; i < sampleCount; i++) {
            sampleWeight += estimateStatePayloadWeight(value[i], depth + 1);
        }
        const avg = sampleCount > 0 ? (sampleWeight / sampleCount) : 0;
        return Math.round(avg * value.length);
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.length === 0) return 0;
        if (depth >= 2) return entries.length * 12;

        let weight = 0;
        for (const [k, v] of entries) {
            weight += String(k || '').length;
            weight += estimateStatePayloadWeight(v, depth + 1);
        }
        return weight;
    }

    return 0;
}
function getComponentStateSyncPolicy(state: any): { weight: number; minIntervalMs: number } {
    const weight = estimateStatePayloadWeight(state);
    if (weight >= HEAVY_COMPONENT_STATE_WEIGHT) {
        return { weight, minIntervalMs: HEAVY_COMPONENT_MIN_SYNC_MS };
    }
    if (weight >= MEDIUM_COMPONENT_STATE_WEIGHT) {
        return { weight, minIntervalMs: MEDIUM_COMPONENT_MIN_SYNC_MS };
    }
    return { weight, minIntervalMs: 0 };
}
type FallbackTelemetryRuntime = {
    createdAtMs: number;
    sampleCount: number;
    stateMutationCount: number;
    lastStateFingerprint: string;
    lastStateChangeAtMs: number;
    pinLevelMap: Record<string, boolean>;
    pinToggleCount: number;
};
const fallbackTelemetryByInstance = new WeakMap<object, FallbackTelemetryRuntime>();
function readComponentStateForTelemetry(inst: any): Record<string, unknown> {
    const state = inst?.state;
    if (state && typeof state === 'object' && !Array.isArray(state)) {
        return state as Record<string, unknown>;
    }
    if (state === undefined) return {};
    return { value: state as unknown };
}
function safeJsonStringify(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch (e) {
        return '{}';
    }
}
function readPinLevelMap(inst: any): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    const pins = inst?.pins && typeof inst.pins === 'object'
        ? (inst.pins as Record<string, unknown>)
        : null;
    if (!pins) return out;

    for (const [pinId, pinState] of Object.entries(pins)) {
        if (!pinState || typeof pinState !== 'object') continue;
        const maybeVoltage = Number((pinState as any).voltage);
        if (Number.isFinite(maybeVoltage)) {
            out[String(pinId)] = maybeVoltage > 0.5;
        }
    }

    return out;
}
function isLikelyActiveSignal(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
    if (typeof value === 'string') {
        const key = value.trim().toLowerCase();
        if (!key) return false;
        return key !== '0' && key !== 'false' && key !== 'off' && key !== 'none' && key !== 'ok';
    }
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return false;
}
function buildFallbackTelemetry(inst: any): { telemetrySummary: string; telemetryData: Record<string, unknown> } {
    const now = Date.now();
    const key = (inst && typeof inst === 'object') ? inst : { fallback: true };
    let runtime = fallbackTelemetryByInstance.get(key);
    if (!runtime) {
        runtime = {
            createdAtMs: now,
            sampleCount: 0,
            stateMutationCount: 0,
            lastStateFingerprint: '',
            lastReportedFingerprint: '',
            lastStateChangeAtMs: now,
            pinLevelMap: {},
            pinToggleCount: 0,
        };
        fallbackTelemetryByInstance.set(key, runtime);
    }

    runtime.sampleCount += 1;

    const state = readComponentStateForTelemetry(inst);
    const stateFingerprint = safeJsonStringify(state);
    if (runtime.lastStateFingerprint && runtime.lastStateFingerprint !== stateFingerprint) {
        runtime.stateMutationCount += 1;
        runtime.lastStateChangeAtMs = now;
    }
    if (!runtime.lastStateFingerprint) {
        runtime.lastStateChangeAtMs = now;
    }
    runtime.lastStateFingerprint = stateFingerprint;

    const nextPinLevels = readPinLevelMap(inst);
    let pinToggles = 0;
    const pinIds = new Set<string>([
        ...Object.keys(runtime.pinLevelMap),
        ...Object.keys(nextPinLevels),
    ]);
    for (const pinId of pinIds) {
        const prevLevel = runtime.pinLevelMap[pinId];
        const nextLevel = nextPinLevels[pinId];
        if (prevLevel === undefined || nextLevel === undefined) continue;
        if (prevLevel !== nextLevel) pinToggles += 1;
    }
    runtime.pinToggleCount += pinToggles;
    runtime.pinLevelMap = nextPinLevels;

    let status: 'ok' | 'warn' | 'error' = 'ok';
    const findings: string[] = [];
    for (const [stateKey, stateValue] of Object.entries(state)) {
        const lower = String(stateKey || '').toLowerCase();
        if (/(error|fault|burned|panic|critical|failed)/.test(lower) && isLikelyActiveSignal(stateValue)) {
            status = 'error';
            findings.push(`State flag ${stateKey} indicates an error condition.`);
            continue;
        }
        if (status !== 'error' && /(warn|degraded|timeout|retry|unstable)/.test(lower) && isLikelyActiveSignal(stateValue)) {
            status = 'warn';
            findings.push(`State flag ${stateKey} indicates a warning condition.`);
        }
    }

    const elapsedSec = Math.max(0.001, (now - runtime.createdAtMs) / 1000);
    const updateFreqHz = Number((runtime.sampleCount / elapsedSec).toFixed(3));
    const idleMs = Math.max(0, now - runtime.lastStateChangeAtMs);
    const summary = findings.length > 0
        ? `${status.toUpperCase()}: ${findings[0]}`
        : `OK: stateKeys=${Object.keys(state).slice(0, 8).join(', ') || 'none'}`;

    const isDelta = runtime.lastReportedFingerprint !== stateFingerprint;
    runtime.lastReportedFingerprint = stateFingerprint;

    const telemetryData: Record<string, unknown> = {
        ...state,
        delta: isDelta,
        _metrics: {
            sampleCount: runtime.sampleCount,
            updateFreqHz,
            stateSizeBytes: stateFingerprint.length,
            stateMutationCount: runtime.stateMutationCount,
            idleMs,
            pinToggleCount: runtime.pinToggleCount,
            pinCount: Object.keys(nextPinLevels).length,
        },
        _heuristics: {
            status,
            summary,
            findings,
        },
        _capturedAt: new Date(now).toISOString(),
        _fallbackGenerated: true,
    };

    return {
        telemetrySummary: summary,
        telemetryData,
    };
}
function getUnifiedComponentSyncState(inst: BaseComponent): any {
    const subclassSyncState = inst.getSyncState() || {};
    const baseSyncState = BaseComponent.prototype.getSyncState.call(inst) || {};
    return {
        ...baseSyncState,
        ...subclassSyncState
    };
}
function collectComponentTelemetry(inst: any, optionsMode?: string, cpu?: any): any {
    if (inst?.type === 'openhw-simulation-monitor' && typeof inst.updateMetrics === 'function') {
        inst.updateMetrics(cpu?.cycles || 0, cpu?.freq || 16000000, inst.telemetryEnabled, inst.telemetryWatchedParams || ['all']);
    }

    if (!inst.telemetryEnabled) {
        return {};
    }

    const effectiveMode = optionsMode || inst.telemetryMode || 'detail';

    let cachedDeltaData: any = null;

    // 👑 YOUR OPTIMIZATION: If Delta mode is active and nothing changed, 
    // instantly return delta: false without building or sending ANY metric payloads!
    if (effectiveMode === 'delta' && typeof inst?.getDeltaMetrics === 'function') {
        cachedDeltaData = inst.getDeltaMetrics(inst.telemetryWatchedParams);
        if (cachedDeltaData && !cachedDeltaData.delta) {
            return { delta: false }; // Ultra-fast early return! Strips out massive telemetryData tree.
        }
    }

    const out: any = {};
    const state = inst.state || {};

    // Map electrical states for Nodal Analysis Telemetry
    if (state.vHistory) out.vHistory = state.vHistory;
    if (state.voltageDrop !== undefined) out.voltageDrop = state.voltageDrop;
    if (state.current !== undefined) out.current = state.current;
    if (state.power !== undefined) out.power = state.power;
    if (state.glow !== undefined) out.glow = state.glow;

    try {
        if (effectiveMode === 'delta' && cachedDeltaData && typeof cachedDeltaData === 'object') {
            out.telemetryData = cachedDeltaData as Record<string, unknown>;
            out.delta = !!cachedDeltaData.delta;
        } else if (effectiveMode === 'simple' && typeof inst?.getTelemetrySummary === 'function') {
            const summaryData = inst.getTelemetrySummary();
            if (typeof summaryData === 'string' && summaryData.trim()) {
                out.telemetrySummary = summaryData.trim();
                out.telemetryData = { state: inst.state || {} };
            }
        } else if (typeof inst?.getRawMetrics === 'function') {
            const rawData = inst.getRawMetrics();
            if (rawData && typeof rawData === 'object') {
                out.telemetryData = rawData as Record<string, unknown>;
            }
        } else if (typeof inst?.getTelemetryData === 'function') {
            const data = inst.getTelemetryData();
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                out.telemetryData = data as Record<string, unknown>;
            }
        }
    } catch (e) {
        // Telemetry failures should never break simulation state delivery.
    }

    try {
        if (!out.telemetrySummary && typeof inst?.getTelemetrySummary === 'function') {
            const summary = inst.getTelemetrySummary();
            if (typeof summary === 'string' && summary.trim()) {
                out.telemetrySummary = summary.trim();
            }
        }
    } catch (e) {
        // Telemetry failures should never break simulation state delivery.
    }

    const fallback = buildFallbackTelemetry(inst);

    if (effectiveMode === 'delta' && out.delta === undefined) {
        if (!fallback.telemetryData.delta) {
            return { delta: false }; // Ultra-fast early return for fallback components!
        }
        out.delta = true;
    }

    if (!out.telemetrySummary) {
        out.telemetrySummary = fallback.telemetrySummary;
    }

    if (!out.telemetryData || typeof out.telemetryData !== 'object') {
        out.telemetryData = fallback.telemetryData;
    } else {
        const merged = { ...out.telemetryData };
        if (!merged._metrics) {
            merged._metrics = fallback.telemetryData._metrics;
        }
        if (!merged._heuristics) {
            merged._heuristics = fallback.telemetryData._heuristics;
        }
        if (!merged._capturedAt) {
            merged._capturedAt = fallback.telemetryData._capturedAt;
        }
        if (!merged._fallbackGenerated) {
            merged._fallbackGenerated = true;
        }
        out.telemetryData = merged;
    }

    if (inst.deepSiliconEnabled && cpu && (inst.type.includes('arduino') || inst.type.includes('pico') || inst.type.includes('attiny'))) {
        const watched = inst.telemetryWatchedParams || ['all'];
        const watchAll = watched.includes('all');
        const watchReg = watchAll || watched.includes('deepSiliconRegisters');
        const watchSram = watchAll || watched.includes('deepSiliconSRAM');
        const watchTimers = watchAll || watched.includes('deepSiliconTimers');
        const watchPower = watchAll || watched.includes('deepSiliconPower');
        const watchIrq = watchAll || watched.includes('deepSiliconInterrupts');

        if (watchReg || watchSram || watchTimers || watchPower || watchIrq) {
            try {
                const deepObj: any = {};

                if (watchReg) {
                    const registers: any = {};
                    if (cpu.pc !== undefined) registers.pc = cpu.pc;
                    if (cpu.sp !== undefined) registers.sp = cpu.sp;
                    if (cpu.sreg !== undefined) registers.sreg = cpu.sreg;
                    if (cpu.cycles !== undefined) registers.cycles = cpu.cycles;

                    if (cpu.core) {
                        if (cpu.core.pc !== undefined) registers.pc = cpu.core.pc;
                        if (cpu.core.sp !== undefined) registers.sp = cpu.core.sp;
                        if (cpu.core.cycles !== undefined) registers.cycles = cpu.core.cycles;
                    }
                    deepObj.registers = registers;
                }

                if (watchSram) {
                    if (cpu.data && typeof cpu.data.slice === 'function') {
                        deepObj.sramMap = Array.from(cpu.data.slice(0, 2048));
                    } else if (cpu.memory && typeof cpu.memory.slice === 'function') {
                        deepObj.sramMap = Array.from(cpu.memory.slice(0, 2048));
                    }
                }

                if (watchTimers) {
                    const timers: any = {};
                    if (cpu.timer0) timers.timer0 = { tcnt: cpu.timer0.tcnt, tccra: cpu.timer0.tccra, tccrb: cpu.timer0.tccrb };
                    if (cpu.timer1) timers.timer1 = { tcnt: cpu.timer1.tcnt, tccra: cpu.timer1.tccra, tccrb: cpu.timer1.tccrb };
                    if (cpu.timer2) timers.timer2 = { tcnt: cpu.timer2.tcnt, tccra: cpu.timer2.tccra, tccrb: cpu.timer2.tccrb };
                    if (cpu.timer && typeof cpu.timer.getTime === 'function') timers.time = cpu.timer.getTime();
                    else if (cpu.timer && cpu.timer.time !== undefined) timers.time = Number(cpu.timer.time);
                    deepObj.timers = timers;
                }

                if (watchPower) {
                    const power: any = {};
                    if (cpu.wdt) power.wdt = { enabled: !!cpu.wdt.enabled, timeout: cpu.wdt.timeout };
                    if (cpu.sleepMode !== undefined) power.sleepMode = cpu.sleepMode;
                    deepObj.power = power;
                }

                if (watchIrq) {
                    const interrupts: any = {};
                    if (cpu.sreg !== undefined) interrupts.globalEnabled = (cpu.sreg & 0x80) !== 0;
                    if (cpu.interrupts) interrupts.pending = cpu.interrupts.pending;
                    deepObj.interrupts = interrupts;
                }

                out.deepSilicon = deepObj;
            } catch (err) {
                console.warn('[Telemetry] Failed to extract deep silicon state:', err);
            }
        }
    }

    return out;
}
export function createRunnerForBoard(
    boardType: string,
    hexData: string,
    componentsDef: any[],
    wiresDef: any[],
    onStateUpdate: (state: any) => void,
    options: AVRRunnerOptions & { pyScript?: string } = {}
): BoardRunner {
    if (/pico|rp2040/i.test(String(boardType || ''))) {
        // RP2040 path: emulate firmware in rp2040js with optional flash partitions.
        return new RP2040Runner(hexData, componentsDef, wiresDef, onStateUpdate, options);
    }
    return new AVRRunner(hexData, componentsDef, wiresDef, onStateUpdate, options);
}

export {
    safeJsonStringify,
    readPinLevelMap,
    readComponentStateForTelemetry,
    fallbackTelemetryByInstance,
    getInternalBridgesForComponent,
    collectNeopixelShutdownStates,
    getComponentStateSyncPolicy,
    isLikelyActiveSignal,
    invokeOptional,
    collectConnectedComponentPins,
    getUnifiedComponentSyncState,
    collectComponentTelemetry
};
