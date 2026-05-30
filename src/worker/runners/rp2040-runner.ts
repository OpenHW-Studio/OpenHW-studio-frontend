import { RP2040, GPIOPinState, ConsoleLogger, LogLevel, USBCDC, GDBServer, GDBConnection } from 'rp2040js';
import { bootromB1 } from '../rp2040-bootrom.ts';
import { BaseComponent } from '@openhw/emulator';
import {
    getComponentStateSyncPolicy,
    collectComponentTelemetry,
    getUnifiedComponentSyncState,
    collectNeopixelShutdownStates,
    invokeOptional,
    isLikelyActiveSignal,
    readPinLevelMap,
    safeJsonStringify,
    fallbackTelemetryByInstance,
    readComponentStateForTelemetry,
    collectConnectedComponentPins,
    getInternalBridgesForComponent,
    normalizeRp2040FlashPartitions,
    normalizeRp2040ExecutableRanges,
    LOGIC_REGISTRY,
    COMPONENT_PINS,
    isSoftSerialSourceLabel,
} from '../registries/component-registry.ts';
import type { BoardRunner, AVRRunnerOptions as RP2040FirmwareLoadOptions } from '../registries/component-registry.ts';

const RP2040_FLASH_BASE = 0x10000000;
const RP2040_XIP_NOCACHE_BASE = 0x11000000;
const RP2040_XIP_NOALLOC_BASE = 0x12000000;
const RP2040_XIP_NOCACHE_NOALLOC_BASE = 0x13000000;
const RP2040_FLASH_ALIAS_END = 0x14000000;
const RP2040_FLASH_ALIAS_MASK = 0x00ffffff;
const RP2040_BOOTROM_BASE = 0x00000000;
const RP2040_BOOTROM_SIZE = 0x4000;
const RP2040_SRAM_BASE = 0x20000000;
const RP2040_USB_RAM_BASE = 0x50100000;
const RP2040_USB_RAM_SIZE = 0x1000;
const RP2040_CLOCKS_BASE = 0x40008000;
const RP2040_CLOCKS_CLK_REF_CTRL_OFFSET = 0x30;
const RP2040_CLOCKS_CLK_REF_SELECTED_OFFSET = 0x38;
const RP2040_CLOCKS_CLK_SYS_CTRL_OFFSET = 0x3c;
const RP2040_CLOCKS_CLK_SYS_SELECTED_OFFSET = 0x44;
const RP2040_SIO_FIFO_ST_OFFSET = 0x50;
const RP2040_SIO_FIFO_WR_OFFSET = 0x54;
const RP2040_SIO_FIFO_RD_OFFSET = 0x58;
const UF2_PAYLOAD_PREFIX = 'UF2BASE64:';
const UF2_BLOCK_SIZE = 512;
const UF2_MAGIC_START0 = 0x0a324655;
const UF2_MAGIC_START1 = 0x9e5d5157;
const UF2_MAGIC_END = 0x0ab16f30;
const RP2040_DEFAULT_LOGICAL_FLASH_BYTES = 2 * 1024 * 1024;


function normalizeRp2040FlashAliasAddress(rawAddress: number): number {
    const address = Number(rawAddress) >>> 0;
    if (address >= RP2040_FLASH_BASE && address < RP2040_FLASH_ALIAS_END) {
        return (RP2040_FLASH_BASE + (address & RP2040_FLASH_ALIAS_MASK)) >>> 0;
    }
    return address;
}

function rp2040FlashAddressToIndex(rawAddress: number, logicalFlashLength: number): number {
    const normalizedAddress = normalizeRp2040FlashAliasAddress(rawAddress);
    if (normalizedAddress >= RP2040_FLASH_BASE && normalizedAddress < (RP2040_FLASH_BASE + logicalFlashLength)) {
        return (normalizedAddress - RP2040_FLASH_BASE) >>> 0;
    }

    const address = Number(rawAddress) >>> 0;
    if (address < logicalFlashLength) {
        return address;
    }

    return -1;
}



const RP2040_I2C_SOURCE_PINS = {
    i2c0: {
        sda: ['SDA', 'GP0', 'GPIO0', 'D0', '0', 'GP4', 'GPIO4', 'D4', '4', 'GP8', 'GPIO8', 'D8', '8', 'GP12', 'GPIO12', 'D12', '12', 'GP16', 'GPIO16', 'D16', '16', 'GP20', 'GPIO20', 'D20', '20', 'GP24', 'GPIO24', 'D24', '24', 'GP28', 'GPIO28', 'D28', '28'],
        scl: ['SCL', 'GP1', 'GPIO1', 'D1', '1', 'GP5', 'GPIO5', 'D5', '5', 'GP9', 'GPIO9', 'D9', '9', 'GP13', 'GPIO13', 'D13', '13', 'GP17', 'GPIO17', 'D17', '17', 'GP21', 'GPIO21', 'D21', '21', 'GP25', 'GPIO25', 'D25', '25'],
    },
    i2c1: {
        sda: ['SDA1', 'GP2', 'GPIO2', 'D2', '2', 'GP6', 'GPIO6', 'D6', '6', 'GP10', 'GPIO10', 'D10', '10', 'GP14', 'GPIO14', 'D14', '14', 'GP18', 'GPIO18', 'D18', '18', 'GP22', 'GPIO22', 'D22', '22', 'GP26', 'GPIO26', 'D26', '26'],
        scl: ['SCL1', 'GP3', 'GPIO3', 'D3', '3', 'GP7', 'GPIO7', 'D7', '7', 'GP11', 'GPIO11', 'D11', '11', 'GP15', 'GPIO15', 'D15', '15', 'GP19', 'GPIO19', 'D19', '19', 'GP23', 'GPIO23', 'D23', '23', 'GP27', 'GPIO27', 'D27', '27'],
    },
};

type RP2040I2CBus = 'i2c0' | 'i2c1';

type RP2040I2CBusPins = {
    sda: string;
    scl: string;
};

type RP2040I2CBitBangState = {
    initialized: boolean;
    prevSdaHigh: boolean;
    prevSclHigh: boolean;
    inFrame: boolean;
    phase: number;
    shift: number;
    byteIndex: number;
    read: boolean;
    activeSlave: BaseComponent | null;
    ackShouldBeLow: boolean;
    ackDriveActive: boolean;
};

const RP2040_SPI_SOURCE_PINS = {
    spi0: {
        mosi: ['MOSI', 'TX0', 'GP3', 'GPIO3', 'D3', '3', 'GP7', 'GPIO7', 'D7', '7', 'GP19', 'GPIO19', 'D19', '19', 'GP23', 'GPIO23', 'D23', '23'],
        miso: ['MISO', 'RX0', 'GP0', 'GPIO0', 'D0', '0', 'GP4', 'GPIO4', 'D4', '4', 'GP16', 'GPIO16', 'D16', '16', 'GP20', 'GPIO20', 'D20', '20'],
        sck: ['SCK', 'CLK', 'SCLK', 'GP2', 'GPIO2', 'D2', '2', 'GP6', 'GPIO6', 'D6', '6', 'GP18', 'GPIO18', 'D18', '18', 'GP22', 'GPIO22', 'D22', '22'],
        cs: ['CS', 'SS', 'CSN', 'NSS', 'GP1', 'GPIO1', 'D1', '1', 'GP5', 'GPIO5', 'D5', '5', 'GP17', 'GPIO17', 'D17', '17', 'GP21', 'GPIO21', 'D21', '21'],
    },
    spi1: {
        mosi: ['MOSI1', 'TX1', 'GP11', 'GPIO11', 'D11', '11', 'GP15', 'GPIO15', 'D15', '15', 'GP27', 'GPIO27', 'D27', '27'],
        miso: ['MISO1', 'RX1', 'GP8', 'GPIO8', 'D8', '8', 'GP12', 'GPIO12', 'D12', '12', 'GP24', 'GPIO24', 'D24', '24', 'GP28', 'GPIO28', 'D28', '28'],
        sck: ['SCK1', 'CLK1', 'SCLK1', 'GP10', 'GPIO10', 'D10', '10', 'GP14', 'GPIO14', 'D14', '14', 'GP26', 'GPIO26', 'D26', '26'],
        cs: ['CS1', 'SS1', 'CSN1', 'NSS1', 'GP9', 'GPIO9', 'D9', '9', 'GP13', 'GPIO13', 'D13', '13', 'GP25', 'GPIO25', 'D25', '25'],
    },
};

const RP2040_GPIO_FUNC_PWM = 4;
const RP2040_GPIO_FUNC_PIO0 = 6;
const RP2040_GPIO_FUNC_PIO1 = 7;
















type HexSegment = {
    address: number;
    bytes: Uint8Array;
};


type RP2040EntryInfo = {
    vectorBase: number;
    initialSP: number;
    initialPC: number;
    resolvedPC: number;
    usedFallback: boolean;
    strategy?: string;
    fallbackReason?: string;
    probe0100SP?: number;
    probe0100PC?: number;
    probe0000SP?: number;
    probe0000PC?: number;
};

function parseIntelHexSegments(data: string): HexSegment[] {
    const lines = String(data || '').split(/\r?\n/);
    let highAddress = 0;
    const segments: HexSegment[] = [];

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line[0] !== ':') continue;
        const byteCount = parseInt(line.substring(1, 3), 16);
        const address = parseInt(line.substring(3, 7), 16);
        const recordType = parseInt(line.substring(7, 9), 16);

        if (recordType === 0) {
            const bytes = new Uint8Array(byteCount);
            for (let i = 0; i < byteCount; i++) {
                bytes[i] = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16);
            }
            segments.push({
                address: highAddress + address,
                bytes,
            });
        } else if (recordType === 4 || recordType === 2) {
            highAddress = parseInt(line.substring(9, 13), 16) << (recordType === 4 ? 16 : 4);
        }
    }

    return segments;
}

function flashContainsAsciiToken(flash: Uint8Array, token: string, maxBytes: number): boolean {
    const text = String(token || '');
    if (!flash || !text) return false;

    const needle = new TextEncoder().encode(text);
    if (needle.length === 0) return false;

    const limit = Math.max(0, Math.min(flash.length, Math.floor(maxBytes || flash.length)));
    if (limit < needle.length) return false;

    for (let i = 0; i <= (limit - needle.length); i++) {
        let matched = true;
        for (let j = 0; j < needle.length; j++) {
            if (flash[i + j] !== needle[j]) {
                matched = false;
                break;
            }
        }
        if (matched) return true;
    }

    return false;
}

function loadRP2040Entry(rp2040: RP2040, logicalFlashBytes?: number): RP2040EntryInfo {
    const logicalFlashLength = getRp2040LogicalFlashLength(rp2040, logicalFlashBytes);
    const flashEnd = (RP2040_FLASH_BASE + logicalFlashLength) >>> 0;
    const sramStart = RP2040_SRAM_BASE;
    const sramEnd = (RP2040_SRAM_BASE + rp2040.sram.length) >>> 0;

    const resolvePcAddress = (rawAddress: number): number => {
        const raw = rawAddress >>> 0;
        if (raw < logicalFlashLength) {
            return (RP2040_FLASH_BASE + raw) >>> 0;
        }
        if (raw >= RP2040_FLASH_BASE && raw < RP2040_FLASH_ALIAS_END) {
            return normalizeRp2040FlashAliasAddress(raw);
        }
        return raw;
    };

    const isExecutableAddress = (addr: number): boolean => {
        const a = addr >>> 0;
        if (a >= RP2040_FLASH_BASE && a < RP2040_FLASH_ALIAS_END) {
            const normalized = normalizeRp2040FlashAliasAddress(a);
            if (normalized >= RP2040_FLASH_BASE && normalized < flashEnd) {
                return true;
            }
        }

        return (a >= sramStart && a < sramEnd)
            || (a >= RP2040_BOOTROM_BASE && a < (RP2040_BOOTROM_BASE + RP2040_BOOTROM_SIZE))
            || (a >= RP2040_USB_RAM_BASE && a < (RP2040_USB_RAM_BASE + RP2040_USB_RAM_SIZE));
    };

    const hasInstructionWord = (addr: number): boolean => {
        const a = addr >>> 0;
        const flashIndex = rp2040FlashAddressToIndex(a, logicalFlashLength);

        if (flashIndex < 0) return true;
        if (flashIndex + 1 >= logicalFlashLength) return false;
        return !(rp2040.flash[flashIndex] === 0xff && rp2040.flash[flashIndex + 1] === 0xff);
    };

    const readWord = (addr: number): number => {
        const a = addr >>> 0;
        const flashIndex = rp2040FlashAddressToIndex(a, logicalFlashLength);

        if (flashIndex >= 0 && flashIndex + 3 < logicalFlashLength) {
            return (
                (rp2040.flash[flashIndex])
                | (rp2040.flash[flashIndex + 1] << 8)
                | (rp2040.flash[flashIndex + 2] << 16)
                | (rp2040.flash[flashIndex + 3] << 24)
            ) >>> 0;
        }

        return rp2040.readUint32(a) >>> 0;
    };

    const probe0100SP = readWord((RP2040_FLASH_BASE + 0x100) >>> 0) >>> 0;
    const probe0100PC = readWord((RP2040_FLASH_BASE + 0x104) >>> 0) >>> 0;
    const probe0000SP = readWord(RP2040_FLASH_BASE) >>> 0;
    const probe0000PC = readWord((RP2040_FLASH_BASE + 4) >>> 0) >>> 0;

    type RP2040VectorCandidate = {
        base: number;
        initialSP: number;
        initialPC: number;
        resolvedPC: number;
        strategy: string;
        score: number;
    };

    const evaluateVectorBase = (base: number, strategy: string): RP2040VectorCandidate | null => {
        const initialSP = readWord(base) >>> 0;
        const initialPC = readWord((base + 4) >>> 0) >>> 0;

        if (initialSP === 0 || initialPC === 0 || initialSP === 0xffffffff || initialPC === 0xffffffff) {
            return null;
        }

        const resolvedPC = resolvePcAddress((initialPC & ~1) >>> 0);
        const validSP = initialSP >= sramStart
            && initialSP <= sramEnd
            && (initialSP & 0x3) === 0;
        const validPC = isExecutableAddress(resolvedPC) && hasInstructionWord(resolvedPC);
        if (!validSP || !validPC) {
            return null;
        }

        let score = 100;

        // Penalize vectors that resolve inside early boot2 area; these are often false positives.
        if (resolvedPC >= RP2040_FLASH_BASE && resolvedPC < (RP2040_FLASH_BASE + 0x800)) {
            score -= 35;
        }

        // Reward vectors that point into application flash region.
        if (resolvedPC >= (RP2040_FLASH_BASE + 0x800) && resolvedPC < flashEnd) {
            score += 15;
        }

        let populatedVectors = 0;
        let validVectorHandlers = 0;
        for (let i = 2; i < 16; i++) {
            const rawHandler = readWord((base + (i * 4)) >>> 0) >>> 0;
            if (rawHandler === 0 || rawHandler === 0xffffffff) {
                continue;
            }

            populatedVectors += 1;
            const handlerAddr = resolvePcAddress((rawHandler & ~1) >>> 0);
            const looksThumb = (rawHandler & 0x1) === 0x1;
            if (looksThumb && isExecutableAddress(handlerAddr)) {
                validVectorHandlers += 1;
                score += 3;
            } else {
                score -= 5;
            }
        }

        if (populatedVectors === 0) {
            score -= 10;
        }
        if (validVectorHandlers >= 6) {
            score += 12;
        }

        return {
            base: base >>> 0,
            initialSP,
            initialPC,
            resolvedPC: resolvedPC >>> 0,
            strategy,
            score,
        };
    };

    const candidates: RP2040VectorCandidate[] = [];
    const preferredBases = [
        { offset: 0x100, strategy: 'vector+0x100' },
        { offset: 0x000, strategy: 'vector+0x000' },
    ];
    for (const preferred of preferredBases) {
        const candidate = evaluateVectorBase((RP2040_FLASH_BASE + preferred.offset) >>> 0, preferred.strategy);
        if (candidate) candidates.push(candidate);
    }

    // Arduino-Pico and other RP2040 toolchains may place the vector table beyond +0x100.
    // Scan a reasonable early-flash window in 0x100-byte aligned steps.
    const scanLimit = Math.min(logicalFlashLength, 0x80000);
    for (let offset = 0x200; offset < scanLimit; offset += 0x100) {
        const candidate = evaluateVectorBase(
            (RP2040_FLASH_BASE + offset) >>> 0,
            `vector+0x${offset.toString(16)}`
        );
        if (candidate) {
            candidates.push(candidate);
        }
    }

    if (candidates.length > 0) {
        candidates.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.base - b.base;
        });

        let best = candidates[0];

        const firmwareLooksCircuitPython = flashContainsAsciiToken(
            rp2040.flash,
            'CIRCUITPY',
            Math.min(logicalFlashLength, 0x180000)
        );

        if (firmwareLooksCircuitPython) {
            const cpBootVectorBase = (RP2040_FLASH_BASE + 0x100) >>> 0;
            const cpBootCandidate = candidates.find((candidate) => {
                if ((candidate.base >>> 0) !== cpBootVectorBase) return false;
                const pcOffset = (candidate.resolvedPC - RP2040_FLASH_BASE) >>> 0;
                return pcOffset < 0x8000;
            });

            if (cpBootCandidate) {
                best = cpBootCandidate;
            }
        }

        rp2040.core.SP = best.initialSP;
        rp2040.core.VTOR = best.base >>> 0;
        rp2040.core.BXWritePC(((best.resolvedPC | 1) >>> 0));
        rp2040.core.xPSR = 0x01000000;

        return {
            vectorBase: best.base >>> 0,
            initialSP: best.initialSP,
            initialPC: best.initialPC,
            resolvedPC: best.resolvedPC >>> 0,
            usedFallback: false,
            strategy: `${best.strategy} score=${best.score}`,
            probe0100SP,
            probe0100PC,
            probe0000SP,
            probe0000PC,
        };
    }

    const fallbackBase = (RP2040_FLASH_BASE + 0x100) >>> 0;
    const fallbackVectorSp = readWord(fallbackBase) >>> 0;
    const fallbackVectorPc = readWord((fallbackBase + 4) >>> 0) >>> 0;
    const fallbackResolvedPc = resolvePcAddress((fallbackVectorPc & ~1) >>> 0);

    const fallbackSp = (fallbackVectorSp >= sramStart
        && fallbackVectorSp <= sramEnd
        && (fallbackVectorSp & 0x3) === 0)
        ? fallbackVectorSp
        : (Math.max(sramStart + 0x100, (sramEnd - 0x100) >>> 0) >>> 0);

    const fallbackPc = (fallbackVectorPc !== 0
        && fallbackVectorPc !== 0xffffffff
        && isExecutableAddress(fallbackResolvedPc))
        ? fallbackResolvedPc
        : fallbackBase;

    rp2040.core.SP = fallbackSp;
    rp2040.core.VTOR = fallbackBase >>> 0;
    rp2040.core.BXWritePC((fallbackPc | 1) >>> 0);
    rp2040.core.xPSR = 0x01000000;

    return {
        vectorBase: fallbackBase,
        initialSP: fallbackSp,
        initialPC: (fallbackVectorPc !== 0 && fallbackVectorPc !== 0xffffffff)
            ? fallbackVectorPc
            : ((fallbackPc | 1) >>> 0),
        resolvedPC: fallbackPc,
        usedFallback: true,
        strategy: 'fallback+0x100',
        fallbackReason: 'no_valid_vector_table',
        probe0100SP,
        probe0100PC,
        probe0000SP,
        probe0000PC,
    };
}

function decodeBase64ToBytes(base64: string): Uint8Array {
    const normalized = String(base64 || '').replace(/\s+/g, '');
    const binary = atob(normalized);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) & 0xff;
    return out;
}

function getRp2040LogicalFlashLength(rp2040: RP2040, logicalFlashBytes?: number): number {
    const physicalSize = Math.max(0, Number(rp2040?.flash?.length || 0));
    if (physicalSize <= 0) return 0;
    if (!Number.isFinite(Number(logicalFlashBytes)) || Number(logicalFlashBytes) <= 0) {
        return physicalSize;
    }
    return Math.max(1, Math.min(physicalSize, Math.floor(Number(logicalFlashBytes))));
}

function mapRp2040FlashAddress(targetAddr: number, logicalFlashLength: number): number {
    if (logicalFlashLength <= 0) return -1;
    return rp2040FlashAddressToIndex(targetAddr, logicalFlashLength);
}

function loadRP2040FirmwareFromUF2Payload(rp2040: RP2040, uf2Payload: string, logicalFlashBytes?: number): RP2040EntryInfo {
    const payload = String(uf2Payload || '').startsWith(UF2_PAYLOAD_PREFIX)
        ? String(uf2Payload).slice(UF2_PAYLOAD_PREFIX.length)
        : String(uf2Payload || '');
    const logicalFlashLength = getRp2040LogicalFlashLength(rp2040, logicalFlashBytes);

    const bytes = decodeBase64ToBytes(payload);
    const blockCount = Math.floor(bytes.length / UF2_BLOCK_SIZE);

    for (let i = 0; i < blockCount; i++) {
        const offset = i * UF2_BLOCK_SIZE;
        const dv = new DataView(bytes.buffer, bytes.byteOffset + offset, UF2_BLOCK_SIZE);
        const m0 = dv.getUint32(0, true);
        const m1 = dv.getUint32(4, true);
        const mEnd = dv.getUint32(508, true);
        if (m0 !== UF2_MAGIC_START0 || m1 !== UF2_MAGIC_START1 || mEnd !== UF2_MAGIC_END) continue;

        const targetAddr = dv.getUint32(12, true) >>> 0;
        const payloadSize = dv.getUint32(16, true) >>> 0;
        if (payloadSize === 0 || payloadSize > 476) continue;

        const dstStart = mapRp2040FlashAddress(targetAddr, logicalFlashLength);
        if (dstStart < 0 || dstStart >= logicalFlashLength) continue;

        const maxCopy = Math.min(payloadSize, logicalFlashLength - dstStart);
        if (maxCopy <= 0) continue;

        const payloadOffset = offset + 32;
        rp2040.flash.set(bytes.subarray(payloadOffset, payloadOffset + maxCopy), dstStart);
    }

    return loadRP2040Entry(rp2040, logicalFlashLength);
}

function loadRP2040FirmwareFromHex(rp2040: RP2040, firmwareHex: string, logicalFlashBytes?: number): RP2040EntryInfo {
    const segments = parseIntelHexSegments(firmwareHex);
    const logicalFlashLength = getRp2040LogicalFlashLength(rp2040, logicalFlashBytes);
    let flashBytesWritten = 0;

    for (const seg of segments) {
        const segStart = seg.address >>> 0;
        const segEnd = (seg.address + seg.bytes.length) >>> 0;
        const flashStart = RP2040_FLASH_BASE;
        const flashEnd = RP2040_FLASH_BASE + logicalFlashLength;

        if (segEnd <= flashStart || segStart >= flashEnd) {
            continue;
        }

        const copyStart = Math.max(segStart, flashStart);
        const copyEnd = Math.min(segEnd, flashEnd);
        const srcOffset = copyStart - segStart;
        const dstOffset = copyStart - flashStart;
        const copyLength = copyEnd - copyStart;

        rp2040.flash.set(seg.bytes.subarray(srcOffset, srcOffset + copyLength), dstOffset);
        flashBytesWritten += copyLength;
    }

    if (flashBytesWritten === 0 && segments.length > 0) {
        // Some toolchains emit HEX with low addresses; treat them as flash offsets.
        for (const seg of segments) {
            if (seg.address < logicalFlashLength) {
                const dstOffset = seg.address;
                const maxCopy = Math.max(0, Math.min(seg.bytes.length, logicalFlashLength - dstOffset));
                if (maxCopy > 0) {
                    rp2040.flash.set(seg.bytes.subarray(0, maxCopy), dstOffset);
                    flashBytesWritten += maxCopy;
                }
            }
        }
    }

    return loadRP2040Entry(rp2040, logicalFlashLength);
}

function applyRP2040FlashPartitions(
    rp2040: RP2040,
    partitions: RP2040FlashPartition[],
    logicalFlashBytes?: number
) {
    if (!partitions.length) return;
    const logicalFlashLength = getRp2040LogicalFlashLength(rp2040, logicalFlashBytes);
    if (logicalFlashLength <= 0) return;

    for (const partition of partitions) {
        const dstOffset = partition.offset >>> 0;
        if (dstOffset >= logicalFlashLength) continue;
        const maxCopy = Math.min(partition.bytes.length, logicalFlashLength - dstOffset);
        if (maxCopy <= 0) continue;

        rp2040.flash.set(partition.bytes.subarray(0, maxCopy), dstOffset);
    }
}

function loadRP2040Firmware(rp2040: RP2040, firmware: string, options: RP2040FirmwareLoadOptions = {}): RP2040EntryInfo {
    // Reset flash contents before each load so stale data cannot execute.
    rp2040.flash.fill(0xff);
    const logicalFlashLength = getRp2040LogicalFlashLength(rp2040, options.logicalFlashBytes);
    const partitions = Array.isArray(options.partitions) ? options.partitions : [];

    const source = String(firmware || '').trim();
    let entryInfo: RP2040EntryInfo;

    if (!source) {
        entryInfo = loadRP2040Entry(rp2040, logicalFlashLength);
    } else if (source.startsWith(UF2_PAYLOAD_PREFIX)) {
        entryInfo = loadRP2040FirmwareFromUF2Payload(rp2040, source, logicalFlashLength);
    } else {
        entryInfo = loadRP2040FirmwareFromHex(rp2040, source, logicalFlashLength);
    }

    if (partitions.length > 0) {
        applyRP2040FlashPartitions(rp2040, partitions, logicalFlashLength);
        entryInfo = loadRP2040Entry(rp2040, logicalFlashLength);
    }

    return entryInfo;
}

class RP2040MockClock {
    private _micros = 0;
    private timers: Array<{ micros: number; callback: () => void }> = [];
    
    get micros() { return this._micros; }
    get nanos() { return this._micros * 1000; }
    
    pause() { /* Idle */ }
    resume() { /* Idle */ }
    
    createTimer(deltaMicros: number, callback: () => void) {
        const timer = { micros: this._micros + deltaMicros, callback };
        this.timers.push(timer);
        this.timers.sort((a, b) => a.micros - b.micros);
        return timer;
    }
    
    deleteTimer(timer: any) {
        const index = this.timers.indexOf(timer);
        if (index >= 0) this.timers.splice(index, 1);
    }
    
    tick(nanos: number) {
        this.advance(nanos / 1000);
    }

    advance(deltaMicros: number) {
        const targetTime = this._micros + Math.max(deltaMicros, 0);
        while (this.timers.length > 0 && this.timers[0].micros <= targetTime) {
            const timer = this.timers.shift()!;
            this._micros = timer.micros;
            timer.callback();
        }
        this._micros = targetTime;
    }

    get nanosToNextAlarm(): number {
        if (this.timers.length === 0) return -1;
        return Math.max(0, (this.timers[0].micros - this._micros) * 1000);
    }
}

export class RP2040Runner implements BoardRunner {
    cpu: RP2040 | null = null;
    gdbWs: WebSocket | null = null;
    running: boolean = false;
    pinStates: Record<string, boolean> = {};
    currentWires: any[] = [];
    instances: Map<string, BaseComponent> = new Map();
    lastTime: number = 0;
    statusInterval: any;
    pinsChanged: boolean = true;
    speed: number = 1.0;
    boardId: string;
    solverMode: 'logic';
    private serialBaudRate: number = 115200;
    private softSerialBaudRate: number = 9600;
    private serialByteBudget: number = 0;
    private readonly onStateUpdate: (state: any) => void;
    private readonly onByteTransmitCb?: (payload: { boardId: string; value: number; char: string; source?: string }) => void;
    private readonly softSerialTxPin = 'GP10';
    private readonly softSerialRxPin = 'GP11';
    private softSerialRxQueue: number[] = [];
    private softSerialRxFrame: { levels: number[]; bitIndex: number; nextBitCycle: number; bitCycles: number } | null = null;
    private softSerialRxLevelHigh = true;
    private softSerialRxOverrideActive = false;
    private softSerialNextInjectCycle = 0;
    private softSerialDecodeState = {
        receiving: false,
        sampleCycle: 0,
        sampleIndex: 0,
        currentByte: 0,
        lastLevel: true,
    };
    private readonly firmwareHex: string;
    private serialBuffer: Array<{ value: number; source: number }> = [];
    private activeUartIndex: number = 0;
    private gdbStatus: 'disabled' | 'connecting' | 'connected' | 'error' | 'closed' = 'disabled';
    private gdbLastError: string = '';
    private usbCdc: USBCDC | null = null;
    private usbCdcReady: boolean = false;
    private gpioUnsubscribers: Array<() => boolean> = [];
    private protocolEndpointsCache = new Map<string, ConnectedComponentPin[]>();
    private i2cDeviceCache = new Map<'i2c0' | 'i2c1', BaseComponent[]>();
    private i2cBusPinPairs = new Map<RP2040I2CBus, RP2040I2CBusPins>();
    private i2cBitBangState = new Map<RP2040I2CBus, RP2040I2CBitBangState>();
    private i2cHardwareSeen = new Map<RP2040I2CBus, boolean>([['i2c0', false], ['i2c1', false]]);
    private spiDeviceCache = new Map<'spi0' | 'spi1', BaseComponent[]>();
    private spiDeviceBusById = new Map<string, Set<'spi0' | 'spi1'>>();
    private peripheralDeviceCacheReady: boolean = false;
    private pwmState = new Map<string, { lastRiseCycle: number; lastFallCycle: number; lastPeriodCycles: number }>();
    private i2sState = new Map<string, { bclkLast: boolean; wsLast: boolean; shiftBuf: number; bitCount: number }>();
    private oneWireState = new Map<string, { lowStartCycle: number | null; highStartCycle: number | null }>();
    private spiFrameState = new Map<'spi0' | 'spi1', { bytes: number[]; lastByteTime: number }>();
    private componentSyncMeta = new Map<string, { lastSentAt: number; lastWeight: number }>();
    private hasFaulted: boolean = false;
    private bootromLoaded: boolean = false;
    private cpuCyclesAtStart: number = 0;
    private pioSignalCycle: number = 0;
    private circuitDirty: boolean = true;
    private topologyDirty: boolean = true;
    private lastPhysicsSolveAt: number = 0;
    private lastStateEmitCycle: number = 0;
    private lastStateEmitTime: number = 0;
    private statusIntervalEmitCount: number = 0;
    private lastPhysicsMs: number = 0;
    private lastRunLoopMs: number = 0;
    private lastComponentUpdateMs: number = 0;
    private netToNode = new Map<number, number>();
    private pinToNet = new Map<string, number>();
    private physicsWorker: Worker | null = null;
    private physicsWorkerBusy: boolean = false;

    private readonly debugEnabled: boolean;
    private readonly debugIntervalMs: number;
    private debugLastEmitAt: number = 0;
    private debugLastStepCount: number = 0;
    private debugStepCount: number = 0;
    private totalCyclesIntended: number = 0;
    private pio0Accum = 0;
    private pio1Accum = 0;
    private pioStepAccum = 0;
    private debugSerialTxBytes: number = 0;
    private debugSerialRxBytes: number = 0;
    private debugSpiTxBytes: number = 0;
    private debugSpiTxTransactions: number = 0;
    private debugLastSpiLogAt: number = 0;
    private debugGpioTransitions: number = 0;
    private debugLastGpioPin: string = '';
    private debugLastPc: number = 0;
    private debugPcStallTicks: number = 0;
    private lastSerialByte: number = -1;
    private lastSerialSource: number = -1;
    private lastSerialEmitAt: number = 0;
    private lastUsbSerialAt: number = 0;

    getSimulatedTimeMs() {
        if (!this.cpu) return 0;
        return Math.floor(((Number(this.cpu.core.cycles) - this.cpuCyclesAtStart) / 125_000_000) * 1000);
    }

    writeDirectMemory(address: number, data: Uint8Array) {
        if (!this.cpu) return;
        const targetAddress = address >>> 0;
        
        // Handle SRAM writes (0x20000000 -> 0x20040000)
        if (targetAddress >= 0x20000000 && targetAddress < (0x20000000 + this.cpu.sram.length)) {
            const offset = targetAddress - 0x20000000;
            const maxLen = Math.min(data.length, this.cpu.sram.length - offset);
            this.cpu.sram.set(data.subarray(0, maxLen), offset);
        }
        // Handle USB RAM writes if needed (0x50100000)
        else if (targetAddress >= 0x50100000 && targetAddress < (0x50100000 + 0x1000)) {
            const offset = targetAddress - 0x50100000;
            const maxLen = Math.min(data.length, 0x1000 - offset);
            for (let i = 0; i < maxLen; i++) {
                this.cpu.writeUint8(targetAddress + i, data[i]);
            }
        } else {
            // Memory mapped peripheral registers (e.g. PIO RX FIFO at 0x50200020)
            if (data.length === 4 && (targetAddress & 3) === 0) {
                const val32 = (data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24)) >>> 0;
                this.cpu.writeUint32(targetAddress, val32);
            } else {
                for (let i = 0; i < data.length; i++) {
                    this.cpu.writeUint8(targetAddress + i, data[i]);
                }
            }
        }
    }

    readDirectMemory(address: number, length: number): Uint8Array | null {
        if (!this.cpu) return null;
        const targetAddress = address >>> 0;
        
        // Handle SRAM reads (0x20000000 -> 0x20040000)
        if (targetAddress >= 0x20000000 && targetAddress < (0x20000000 + this.cpu.sram.length)) {
            const offset = targetAddress - 0x20000000;
            const maxLen = Math.min(length, this.cpu.sram.length - offset);
            return new Uint8Array(this.cpu.sram.buffer, this.cpu.sram.byteOffset + offset, maxLen);
        }
        
        // Slow fallback for other memory mapped regions
        const result = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            result[i] = this.cpu.readUint8(targetAddress + i);
        }
        return result;
    }


    setTelemetryEnabled(enabled: boolean, mode?: string, watchedParamsMap?: Record<string, string[]>, deepSilicon?: boolean) {
        for (const inst of this.instances.values()) {
            inst.telemetryEnabled = !!enabled;
            inst.telemetryMode = mode || 'detail';
            inst.telemetryWatchedParams = watchedParamsMap?.[inst.id] || ['all'];
            inst.deepSiliconEnabled = !!deepSilicon;
        }
    }

    getRichTelemetrySnapshot(options: { mode?: 'standard' | 'deep' | 'delta' } = {}) {
        const components: any[] = [];
        const mode = options.mode || 'deep';

        for (const inst of this.instances.values()) {
            if (mode === 'standard') {
                const data = (inst as any).getTelemetryData?.() || getUnifiedComponentSyncState(inst);
                components.push({
                    id: inst.id,
                    ...data
                });
            } else if (mode === 'delta') {
                components.push(inst.getDeltaMetrics());
            } else {
                // 'deep' mode provides the FULL diagnostic report
                components.push(inst.getRawMetrics());
            }
        }
        return {
            boardId: this.boardId,
            components,
            capturedAt: new Date().toISOString(),
            mode,
            isDelta: mode === 'delta'
        };
    }
    private lowPcAliasCandidate: number = -1;
    private lowPcAliasRepeatCount: number = 0;
    private invalidPcStrikeCount: number = 0;
    private readonly extraExecutableRanges: RP2040ExecutableRange[];
    private readonly configuredLogicalFlashBytes: number;
    private readonly flashPartitions: RP2040FlashPartition[];
    private readonly uartLedOffTimers = new Map<'GP0' | 'GP1' | 'GP4' | 'GP5', ReturnType<typeof setTimeout>>();
    private entryInfo: RP2040EntryInfo | null = null;
    private picoWirelessStub: {
        mode: 'off' | 'compat-stub';
        ssid: string;
        ip: string;
        status: 'off' | 'booting' | 'connected';
        startedAtMs: number;
        lastEmitMs: number;
    } | null = null;
    private static readonly FAULT_GRACE_CYCLES = 6_000_000; // ~48ms simulated @ 125MHz – covers bootrom + MicroPython init
    private static readonly LOW_PC_ALIAS_REPEAT_LIMIT = 50_000_000;
    private static readonly INVALID_PC_STRIKE_LIMIT = 64;
    private static readonly PC_VALIDATION_INTERVAL_STEPS = 1024;
    private static readonly HARD_INVALID_PC_BASE = 0x80000000;
    private static readonly SERIAL_DEDUP_WINDOW_MS = 2;
    private static readonly USB_SERIAL_PREFER_WINDOW_MS = 250;
    private static readonly UART_LED_PULSE_MS = 40;
    private static readonly WIRELESS_STUB_EMIT_INTERVAL_MS = 2000;

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions = {}
    ) {
        this.currentWires = wiresDef || [];
        this.onStateUpdate = onStateUpdate;
        this.onByteTransmitCb = options.onByteTransmit;
        this.firmwareHex = String(hexData || '');
        console.log(`RP2040Runner: firmware hex length=${this.firmwareHex.length}`);
        this.speed = options.speed ?? 1.0;
        this.solverMode = 'logic';

        const fallbackBoard = (componentsDef || []).find((c: any) => /(rp2040|pico)/i.test(String(c.type || '')));
        this.boardId = options.boardId || fallbackBoard?.id || 'openhw-raspberry-pi-pico_0';
        const boardCompDef = (componentsDef || []).find((c: any) => String(c.id || '') === this.boardId) || fallbackBoard;
        this.setSerialBaudRate(options.serialBaudRate ?? 115200);
        this.debugEnabled = options.debugEnabled !== false;
        this.debugIntervalMs = Math.max(150, Number(options.debugIntervalMs || 800));
        this.extraExecutableRanges = normalizeRp2040ExecutableRanges(options.rp2040ExecutableRanges);
        const parsedLogicalFlashBytes = parseAddressValue(options.rp2040LogicalFlashBytes);
        this.configuredLogicalFlashBytes = (
            parsedLogicalFlashBytes !== null && parsedLogicalFlashBytes > 0
                ? parsedLogicalFlashBytes
                : RP2040_DEFAULT_LOGICAL_FLASH_BYTES
        ) >>> 0;
        this.flashPartitions = normalizeRp2040FlashPartitions(options.rp2040FlashPartitions);

        this.cpu = new RP2040(new RP2040MockClock() as any);
        const wrapFlashAliasAddressMethod = (methodName: string) => {
            const original = (this.cpu as any)?.[methodName];
            if (typeof original !== 'function') return;

            (this.cpu as any)[methodName] = (rawAddress: number, ...args: any[]) => {
                const sourceAddress = Number(rawAddress) >>> 0;
                const mappedAddress = normalizeRp2040FlashAliasAddress(sourceAddress);
                try {
                    return original.call(this.cpu, mappedAddress, ...args);
                } catch (err: any) {
                    const srcHex = `0x${sourceAddress.toString(16)}`;
                    const mappedHex = `0x${mappedAddress.toString(16)}`;
                    const reason = String(err?.message || err || `${methodName} error`);
                    throw new Error(`${methodName}(${srcHex} -> ${mappedHex}) failed: ${reason}`);
                }
            };
        };

        wrapFlashAliasAddressMethod('readUint32');
        wrapFlashAliasAddressMethod('readUint16');
        wrapFlashAliasAddressMethod('readUint8');
        wrapFlashAliasAddressMethod('writeUint32');
        wrapFlashAliasAddressMethod('writeUint16');
        wrapFlashAliasAddressMethod('writeUint8');
        this.patchClockSelectedReads();
        this.patchSioFifoAccess();
        this.cpu.loadBootrom(bootromB1);
        this.cpu.logger = new ConsoleLogger(LogLevel.Error, true);

        // -- Patch PIO to use synchronous stepping instead of redundant setTimeout --
        // This is a critical 'Velxio' optimization that prevents event-loop congestion.
        for (const pio of (this.cpu as any).pio) {
            pio.run = function(this: any) {
                if (this.runTimer) {
                    clearTimeout(this.runTimer);
                    this.runTimer = null;
                }
            };
        }
        this.pioStepAccum = 0;

        const enableGdbBridge = (this as any).enableGdbBridge === true;
        if (enableGdbBridge) {
            try {
                const gdbWs = new WebSocket('ws://localhost:3333');
                this.gdbStatus = 'connecting';
                this.emitGdbStatus('connecting', 'Attempting ws://localhost:3333');
                const gdbServer = new GDBServer(this.cpu);
                const gdbConn = new GDBConnection(gdbServer, (res) => {
                    if (gdbWs.readyState === WebSocket.OPEN) gdbWs.send(res);
                });
                gdbWs.onopen = () => {
                    this.gdbStatus = 'connected';
                    this.gdbLastError = '';
                    this.emitGdbStatus('connected', 'GDB bridge connected');
                };
                gdbWs.onmessage = (e) => {
                    if (typeof e.data === 'string') gdbConn.feedData(e.data);
                };
                gdbWs.onerror = () => {
                    this.gdbStatus = 'disabled';
                    this.gdbLastError = 'GDB bridge unavailable';
                    this.emitGdbStatus('stopped', this.gdbLastError);
                };
                gdbWs.onclose = (evt: any) => {
                    this.gdbStatus = 'disabled';
                    const reason = String(evt?.reason || '').trim();
                    const detail = `code=${Number(evt?.code || 0)}${reason ? ` reason=${reason}` : ''}`;
                    this.emitGdbStatus('stopped', detail);
                };
                this.gdbWs = gdbWs;
            } catch (err) {
                console.warn('Silent failure opening GDB Bridge ws://localhost:3333', err);
                this.gdbStatus = 'disabled';
                this.gdbLastError = String((err as any)?.message || err || 'Unknown GDB bridge error');
                this.emitGdbStatus('stopped', this.gdbLastError);
            }
        } else {
            this.gdbStatus = 'disabled';
            this.gdbLastError = 'GDB bridge disabled';
            this.emitGdbStatus('stopped', this.gdbLastError);
        }
        this.bootromLoaded = true;
        this.entryInfo = loadRP2040Firmware(this.cpu, this.firmwareHex, {
            logicalFlashBytes: this.getLogicalFlashLength(),
            partitions: this.flashPartitions,
        });
        this.cpuCyclesAtStart = this.cpu.core.cycles;
        this.pioSignalCycle = this.cpu.core.cycles;

        (componentsDef || []).forEach((cDef) => {
            const LogicClass = LOGIC_REGISTRY[cDef.type];
            if (LogicClass) {
                const pins = COMPONENT_PINS[cDef.type] || [{ id: 'A' }, { id: 'K' }, { id: 'GND' }, { id: 'VSS' }];
                const manifest = { type: cDef.type, attrs: cDef.attrs || {}, pins };
                const inst = new LogicClass(cDef.id, manifest);
                (inst as any)._runner = this;
                
                // Hack: Pass the component attributes so logic can read them
                if (cDef.attrs) {
                    inst.state = { ...inst.state, ...cDef.attrs };
                }
                inst.onTelemetryFinding = (finding: any) => {
                    this.onStateUpdate({
                        type: 'telemetry_finding',
                        boardId: this.boardId,
                        componentId: inst.id,
                        ...finding
                    });
                };
                this.instances.set(cDef.id, inst);
            }
        });
        this.initWirelessStub(boardCompDef);

        this.attachGPIOListeners();
        this.attachUART();
        this.attachUSBSerial();
        this.rebuildPeripheralDeviceCache();
        this.installRp2040I2cAdapters();
        this.installRp2040SpiAdapters();

        // Seed default pin values as LOW so dependent components can initialize.
        for (let gp = 0; gp <= 28; gp++) {
            const pin = `GP${gp}`;
            this.pinStates[pin] = false;
            this.propagateBoardPin(pin, false);
        }
        this.setSoftSerialRxLevel(true);

        this.running = true;
        this.lastTime = performance.now();
        this.lastStateEmitTime = this.lastTime;
        if (this.debugEnabled) {
            const spi0Ids = this.spiDeviceCache.get('spi0')?.map((inst) => inst.id) || [];
            const spi1Ids = this.spiDeviceCache.get('spi1')?.map((inst) => inst.id) || [];
            console.log(`[RP2040 START] board=${this.boardId} gdb=${this.gdbStatus} spi0=[${spi0Ids.join(', ')}] spi1=[${spi1Ids.join(', ')}]`);
        }
        this.emitDebugSnapshot('start', this.lastTime, true);
        this.emitWirelessStubStatus('start', true);
        this.runLoop();
    }

    private shouldEmitComponentState(componentId: string, state: any, nowMs: number): boolean {
        const policy = getComponentStateSyncPolicy(state);
        const prev = this.componentSyncMeta.get(componentId);
        if (policy.minIntervalMs > 0 && prev && (nowMs - prev.lastSentAt) < policy.minIntervalMs) {
            return false;
        }
        this.componentSyncMeta.set(componentId, { lastSentAt: nowMs, lastWeight: policy.weight });
        return true;
    }

    private initWirelessStub(boardCompDef: any) {
        const boardType = String(boardCompDef?.type || '').toLowerCase();
        if (!(boardType.includes('pico-w') || boardType.includes('picow'))) return;

        const modeRaw = String(boardCompDef?.attrs?.wirelessMode || 'compat-stub').toLowerCase();
        const mode: 'off' | 'compat-stub' = modeRaw === 'off' ? 'off' : 'compat-stub';
        const ssid = String(boardCompDef?.attrs?.wirelessSsid || 'Velxio-GUEST').trim() || 'Velxio-GUEST';
        const ip = String(boardCompDef?.attrs?.wirelessIp || '192.168.4.2').trim() || '192.168.4.2';
        const now = performance.now();

        this.picoWirelessStub = {
            mode,
            ssid,
            ip,
            status: mode === 'off' ? 'off' : 'booting',
            startedAtMs: now,
            lastEmitMs: 0,
        };
        this.applyWirelessStubStateToBoard();
    }

    private applyWirelessStubStateToBoard() {
        if (!this.picoWirelessStub) return;
        const boardInst = this.instances.get(this.boardId);
        if (!boardInst) return;

        const { mode, ssid, ip, status } = this.picoWirelessStub;
        boardInst.setState({
            wirelessMode: mode,
            wirelessStatus: status,
            wirelessConnected: mode !== 'off' && status === 'connected',
            wirelessSsid: mode === 'off' ? '' : ssid,
            wirelessIp: mode === 'off' ? '' : ip,
            wirelessNote: mode === 'off'
                ? 'Wireless compatibility stub disabled.'
                : 'Compatibility stub only. Pico W radio/network emulation is not implemented.',
        });
    }

    private emitWirelessStubStatus(reason: 'start' | 'tick' | 'reset' = 'tick', force = false) {
        if (!this.picoWirelessStub) return;

        const now = performance.now();
        if (!force && (now - this.picoWirelessStub.lastEmitMs) < RP2040Runner.WIRELESS_STUB_EMIT_INTERVAL_MS) {
            return;
        }

        if (this.picoWirelessStub.mode === 'off') {
            this.picoWirelessStub.status = 'off';
        } else {
            const elapsed = now - this.picoWirelessStub.startedAtMs;
            this.picoWirelessStub.status = elapsed >= 1200 ? 'connected' : 'booting';
        }

        this.applyWirelessStubStateToBoard();

        const connected = this.picoWirelessStub.mode !== 'off' && this.picoWirelessStub.status === 'connected';
        this.onStateUpdate({
            type: 'debug',
            boardId: this.boardId,
            category: 'rp2040-wireless-stub',
            reason,
            wireless: {
                mode: this.picoWirelessStub.mode,
                status: this.picoWirelessStub.status,
                connected,
                ssid: this.picoWirelessStub.mode === 'off' ? '' : this.picoWirelessStub.ssid,
                ip: this.picoWirelessStub.mode === 'off' ? '' : this.picoWirelessStub.ip,
                note: this.picoWirelessStub.mode === 'off'
                    ? 'Wireless compatibility stub disabled.'
                    : 'Compatibility stub only. Pico W radio/network emulation is not implemented.',
            },
        });

        this.picoWirelessStub.lastEmitMs = now;
    }

    private emitGdbStatus(reason: 'connecting' | 'connected' | 'closed' | 'error' | 'stopped', detail = '') {
        this.onStateUpdate({
            type: 'debug',
            boardId: this.boardId,
            category: 'rp2040-gdb',
            reason,
            gdb: {
                status: this.gdbStatus,
                detail: String(detail || ''),
                lastError: this.gdbLastError,
            },
        });
    }

    private patchClockSelectedReads() {
        if (!this.cpu) return;

        try {
            const clocksPeripheral: any = this.cpu.findPeripheral(RP2040_CLOCKS_BASE);
            if (!clocksPeripheral || typeof clocksPeripheral.readUint32 !== 'function') return;

            const originalReadUint32 = clocksPeripheral.readUint32.bind(clocksPeripheral);
            const originalWriteUint32 = typeof clocksPeripheral.writeUint32 === 'function'
                ? clocksPeripheral.writeUint32.bind(clocksPeripheral)
                : null;
            const ctrlShadow: Record<number, number> = {
                [RP2040_CLOCKS_CLK_REF_CTRL_OFFSET]: 0,
                [RP2040_CLOCKS_CLK_SYS_CTRL_OFFSET]: 0,
            };

            clocksPeripheral.readUint32 = (offset: number) => {
                if (offset === RP2040_CLOCKS_CLK_REF_CTRL_OFFSET || offset === RP2040_CLOCKS_CLK_SYS_CTRL_OFFSET) {
                    return ctrlShadow[offset] >>> 0;
                }

                if (offset === RP2040_CLOCKS_CLK_REF_SELECTED_OFFSET || offset === RP2040_CLOCKS_CLK_SYS_SELECTED_OFFSET) {
                    // Emulate glitchless selected source bits from the corresponding CTRL source field.
                    // This unblocks startup loops used by Arduino-Pico and MicroPython clock init.
                    const ctrlOffset = offset === RP2040_CLOCKS_CLK_REF_SELECTED_OFFSET
                        ? RP2040_CLOCKS_CLK_REF_CTRL_OFFSET
                        : RP2040_CLOCKS_CLK_SYS_CTRL_OFFSET;
                    const srcMask = offset === RP2040_CLOCKS_CLK_REF_SELECTED_OFFSET ? 0x3 : 0x1;
                    const src = (ctrlShadow[ctrlOffset] >>> 0) & srcMask;
                    return (1 << src) >>> 0;
                }
                return originalReadUint32(offset);
            };

            clocksPeripheral.writeUint32 = (offset: number, value: number) => {
                if (offset === RP2040_CLOCKS_CLK_REF_CTRL_OFFSET || offset === RP2040_CLOCKS_CLK_SYS_CTRL_OFFSET) {
                    ctrlShadow[offset] = value >>> 0;
                }
                if (originalWriteUint32) {
                    originalWriteUint32(offset, value);
                }
            };
        } catch (e) {
            // Non-fatal: if this fails we keep default rp2040js behavior.
        }
    }

    private patchSioFifoAccess() {
        if (!this.cpu) return;

        try {
            const sio: any = (this.cpu as any).sio;
            if (!sio || typeof sio.readUint32 !== 'function') return;

            const originalReadUint32 = sio.readUint32.bind(sio);
            const originalWriteUint32 = typeof sio.writeUint32 === 'function'
                ? sio.writeUint32.bind(sio)
                : null;

            // Minimal multicore FIFO facade used by SDK startup probes.
            // ST[0]=VLD (no data), ST[1]=RDY (write slot available).
            const fifoStatus = 0x2;

            sio.readUint32 = (offset: number) => {
                if (offset === RP2040_SIO_FIFO_ST_OFFSET) {
                    return fifoStatus;
                }
                if (offset === RP2040_SIO_FIFO_RD_OFFSET) {
                    return 0;
                }
                return originalReadUint32(offset);
            };

            sio.writeUint32 = (offset: number, value: number) => {
                if (offset === RP2040_SIO_FIFO_ST_OFFSET || offset === RP2040_SIO_FIFO_WR_OFFSET) {
                    return;
                }
                if (originalWriteUint32) {
                    originalWriteUint32(offset, value);
                }
            };
        } catch (e) {
            // Non-fatal: if this fails we keep default rp2040js behavior.
        }
    }

    private getLogicalFlashLength(): number {
        if (!this.cpu) return 0;
        return getRp2040LogicalFlashLength(this.cpu, this.configuredLogicalFlashBytes);
    }

    private isExecutableAddress(addr: number): boolean {
        const pc = (addr >>> 0);
        const logicalFlashLength = this.getLogicalFlashLength();
        const flashEnd = (RP2040_FLASH_BASE + logicalFlashLength) >>> 0;
        const sramEnd = (RP2040_SRAM_BASE + this.cpu!.sram.length) >>> 0;

        if (this.bootromLoaded && pc >= RP2040_BOOTROM_BASE && pc < (RP2040_BOOTROM_BASE + RP2040_BOOTROM_SIZE)) return true;
        if (pc >= RP2040_FLASH_BASE && pc < RP2040_FLASH_ALIAS_END) {
            const normalized = normalizeRp2040FlashAliasAddress(pc);
            if (normalized >= RP2040_FLASH_BASE && normalized < flashEnd) {
                return true;
            }
        }
        if (pc >= RP2040_SRAM_BASE && pc < sramEnd) return true;
        if (pc >= RP2040_USB_RAM_BASE && pc < (RP2040_USB_RAM_BASE + RP2040_USB_RAM_SIZE)) return true;
        for (const range of this.extraExecutableRanges) {
            if (pc >= range.start && pc <= range.end) return true;
        }
        return false;
    }

    private faultAndStop(reason: string, pc: number) {
        if (this.hasFaulted) return;
        this.hasFaulted = true;
        this.running = false;
        this.clearPendingUartLedTimers();
        clearInterval(this.statusInterval);
        this.emitDebugSnapshot('fault', performance.now(), true, reason, pc >>> 0);
        this.onStateUpdate({
            type: 'fault',
            boardId: this.boardId,
            reason,
            pc: pc >>> 0,
        });
    }

    private emitDebugSnapshot(
        reason: 'start' | 'tick' | 'fault' | 'reset' = 'tick',
        now = performance.now(),
        force = false,
        faultReason = '',
        faultPc?: number
    ) {
        if (!this.debugEnabled || !this.cpu) return;
        if (!force && (now - this.debugLastEmitAt) < this.debugIntervalMs) return;

        const pc = this.cpu.core.PC >>> 0;
        if (pc === this.debugLastPc) this.debugPcStallTicks++;
        else this.debugPcStallTicks = 0;
        this.debugLastPc = pc;

        const firstLed = Array.from(this.instances.values()).find((inst) => inst.type === 'openhw-led' || inst.type === 'openhw-led');
        const ledAnodeV = firstLed ? Number(firstLed.getPinVoltage('A') || 0) : null;
        const ledCathodeV = firstLed ? Number(firstLed.getPinVoltage('K') || 0) : null;
        const ledDeltaV = (ledAnodeV !== null && ledCathodeV !== null)
            ? Number((ledAnodeV - ledCathodeV).toFixed(3))
            : null;
        const ledOn = firstLed ? !!firstLed.state?.illuminated : null;
        const highPins = Object.keys(this.pinStates)
            .filter((pin) => !!this.pinStates[pin])
            .sort((a, b) => Number(a.replace('GP', '')) - Number(b.replace('GP', '')));
        const pinBitmap = Array.from({ length: 29 }, (_, idx) => (this.pinStates[`GP${idx}`] ? '1' : '0')).join('');
        const spi0Devices = this.spiDeviceCache.get('spi0')?.map((inst) => inst.id) || [];
        const spi1Devices = this.spiDeviceCache.get('spi1')?.map((inst) => inst.id) || [];

        const payload = {
            type: 'debug',
            boardId: this.boardId,
            category: 'rp2040-runtime',
            reason,
            metrics: {
                running: this.running,
                faulted: this.hasFaulted,
                gdbStatus: this.gdbStatus,
                gdbLastError: this.gdbLastError,
                pc,
                sp: this.cpu.core.SP >>> 0,
                cycles: this.cpu.core.cycles >>> 0,
                activeUart: this.activeUartIndex,
                serialTxBytes: this.debugSerialTxBytes,
                serialRxBytes: this.debugSerialRxBytes,
                spiTxBytes: this.debugSpiTxBytes,
                spiTxTransactions: this.debugSpiTxTransactions,
                spiDevices: {
                    spi0: spi0Devices,
                    spi1: spi1Devices,
                },
                usbCdcReady: this.usbCdcReady,
                serialInputQueue: this.serialBuffer.length,
                stepCount: this.debugStepCount,
                gpioTransitions: this.debugGpioTransitions,
                lastGpioPin: this.debugLastGpioPin,
                gp20: !!this.pinStates.GP20,
                gp25: !!this.pinStates.GP25,
                highPins,
                pinBitmap,
                ledId: firstLed?.id || '',
                ledOn,
                ledAnodeV,
                ledCathodeV,
                ledDeltaV,
                stepsSinceLastEmit: this.debugStepCount - this.debugLastStepCount,
                pcStallTicks: this.debugPcStallTicks,
                lastRunLoopMs: Number(this.lastRunLoopMs.toFixed(3)),
                lastPhysicsMs: Number(this.lastPhysicsMs.toFixed(3)),
                lastComponentUpdateMs: Number(this.lastComponentUpdateMs.toFixed(3)),
                interruptsEnabled: this.cpu.core.enabledInterrupts >>> 0,
                interruptsPending: this.cpu.core.pendingInterrupts >>> 0,
                primask: !!this.cpu.core.PM,
                entry: this.entryInfo,
            },
            fault: faultReason
                ? {
                    reason: faultReason,
                    pc: Number.isFinite(Number(faultPc)) ? (Number(faultPc) >>> 0) : pc,
                }
                : undefined,
        };

        this.debugLastEmitAt = now;
        this.debugLastStepCount = this.debugStepCount;
        this.onStateUpdate(payload);
    }

    private rebaseProgramCounterAlias(stepWeight = 1) {
        if (!this.cpu) return;
        const pc = this.cpu.core.PC >>> 0;
        const logicalFlashLength = this.getLogicalFlashLength();
        // Some firmware images carry flash-relative addresses in branch tables.
        // Map plausible flash aliases into XIP immediately, and for low ROM-range
        // addresses only recover after detecting a sustained local PC stall.
        if (!(pc > 0 && pc < logicalFlashLength)) {
            this.lowPcAliasCandidate = -1;
            this.lowPcAliasRepeatCount = 0;
            return;
        }

        const flashIndex = pc & ~1;
        const hasFlashData = flashIndex + 1 < logicalFlashLength
            && (this.cpu.flash[flashIndex] !== 0xff || this.cpu.flash[flashIndex + 1] !== 0xff);
        if (!hasFlashData) {
            this.lowPcAliasCandidate = -1;
            this.lowPcAliasRepeatCount = 0;
            return;
        }

        const rebased = ((RP2040_FLASH_BASE + pc) | 1) >>> 0;
        const inBootromRange = this.bootromLoaded && pc < RP2040_BOOTROM_SIZE;
        if (!inBootromRange) {
            this.lowPcAliasCandidate = -1;
            this.lowPcAliasRepeatCount = 0;
            this.cpu.core.BXWritePC(rebased);
            this.invalidPcStrikeCount = 0;
            return;
        }

        // Boot ROM can be entered legitimately. Only force alias recovery when
        // execution is visibly stuck at the same low PC for many consecutive steps.
        const repeatIncrement = Math.max(1, stepWeight | 0);
        if (this.lowPcAliasCandidate === pc) {
            this.lowPcAliasRepeatCount += repeatIncrement;
        } else {
            this.lowPcAliasCandidate = pc;
            this.lowPcAliasRepeatCount = 0;
        }

        // Only force rebase if we are stuck at the EXACT same PC for a long time.
        // Also don't rebase if we are at address 0 (waiting for something) or in a wait state.
        if (this.lowPcAliasRepeatCount >= RP2040Runner.LOW_PC_ALIAS_REPEAT_LIMIT && pc !== 0) {
            this.cpu.core.BXWritePC(rebased);
            this.lowPcAliasRepeatCount = 0;
            this.invalidPcStrikeCount = 0;
        }
    }

    private shouldFaultForInvalidPc(pc: number): boolean {
        if (!this.cpu) return false;
        const stepPc = pc >>> 0;
        const cyclesSinceStart = (this.cpu.core.cycles - this.cpuCyclesAtStart) >>> 0;
        const pastGracePeriod = cyclesSinceStart > RP2040Runner.FAULT_GRACE_CYCLES;
        const hardInvalidPc = stepPc >= RP2040Runner.HARD_INVALID_PC_BASE;
        const recoveringLowAlias = !hardInvalidPc
            && this.lowPcAliasCandidate === stepPc
            && this.lowPcAliasRepeatCount > 0;

        if (recoveringLowAlias) {
            this.invalidPcStrikeCount = 0;
            return false;
        }

        const invalidPc = (pastGracePeriod || hardInvalidPc) && !this.isExecutableAddress(stepPc);

        if (invalidPc) {
            this.invalidPcStrikeCount += 1;
        } else {
            this.invalidPcStrikeCount = 0;
        }

        return this.invalidPcStrikeCount >= RP2040Runner.INVALID_PC_STRIKE_LIMIT;
    }

    private getSoftSerialBitCycles(): number {
        const baud = Math.max(300, this.softSerialBaudRate | 0);
        const clockHz = this.getRp2040ClockHz();
        return Math.max(1, Math.floor(clockHz / baud));
    }

    private setSoftSerialRxLevel(isHigh: boolean) {
        this.softSerialRxLevelHigh = isHigh;
        this.cpu?.gpio?.[11]?.setInputValue(isHigh);
    }

    private emitSoftSerialByte(value: number) {
        const byte = value & 0xff;
        const char = String.fromCharCode(byte);
        this.debugSerialTxBytes += 1;
        this.pulseBoardUartLed('GP0');
        if (this.onByteTransmitCb) {
            this.onByteTransmitCb({ boardId: this.boardId, value: byte, char, source: 'softserial' });
        } else {
            this.onStateUpdate({ type: 'serial', data: char, value: byte, boardId: this.boardId, source: 'softserial' });
        }
    }

    private processSoftSerialDecode(cycles: number) {
        const state = this.softSerialDecodeState;
        if (!state.receiving) return;
        const bitCycles = this.getSoftSerialBitCycles();

        while (state.receiving && state.sampleCycle <= cycles) {
            if (state.sampleIndex < 8) {
                if (state.lastLevel) {
                    state.currentByte |= (1 << state.sampleIndex);
                }
                state.sampleIndex += 1;
                state.sampleCycle += bitCycles;
                continue;
            }

            // Stop bit: valid frame when line is HIGH.
            if (state.lastLevel) {
                this.emitSoftSerialByte(state.currentByte);
            }
            state.receiving = false;
            state.sampleIndex = 0;
            state.currentByte = 0;
        }
    }

    private observeSoftSerialTx(pinId: string, isHigh: boolean, cycles: number) {
        if (this.normalizeToGpPin(pinId) !== this.softSerialTxPin) return;
        const state = this.softSerialDecodeState;

        this.processSoftSerialDecode(cycles);

        const prev = state.lastLevel;
        state.lastLevel = isHigh;

        // Falling edge while idle => start bit.
        if (!state.receiving && prev && !isHigh) {
            const bitCycles = this.getSoftSerialBitCycles();
            state.receiving = true;
            state.currentByte = 0;
            state.sampleIndex = 0;
            state.sampleCycle = cycles + (bitCycles * 1.5);
        }
    }

    private advanceSoftSerialIngress(cycles: number) {
        if (!this.cpu) return;

        if (!this.softSerialRxFrame && this.softSerialRxQueue.length > 0) {
            const byte = this.softSerialRxQueue.shift()! & 0xff;
            const bitCycles = this.getSoftSerialBitCycles();
            const startCycle = Math.max(cycles + 1, this.softSerialNextInjectCycle || (cycles + 1));
            const levels: number[] = [0];
            for (let i = 0; i < 8; i++) {
                levels.push((byte >> i) & 1);
            }
            levels.push(1);
            this.softSerialRxFrame = {
                levels,
                bitIndex: 0,
                nextBitCycle: startCycle,
                bitCycles,
            };
            this.softSerialNextInjectCycle = startCycle + (levels.length * bitCycles);
            this.softSerialRxOverrideActive = true;
        }

        while (this.softSerialRxFrame && cycles >= this.softSerialRxFrame.nextBitCycle) {
            const frame = this.softSerialRxFrame;
            const level = frame.levels[frame.bitIndex] === 1;
            this.setSoftSerialRxLevel(level);
            frame.bitIndex += 1;
            frame.nextBitCycle += frame.bitCycles;

            if (frame.bitIndex >= frame.levels.length) {
                this.softSerialRxFrame = null;
                break;
            }
        }

        if (!this.softSerialRxFrame && this.softSerialRxQueue.length === 0 && this.softSerialRxOverrideActive) {
            this.setSoftSerialRxLevel(true);
            this.softSerialRxOverrideActive = false;
        }
    }

    private attachUART() {
        if (!this.cpu?.uart) return;

        const bindUart = (uartIndex: 0 | 1) => {
            const uart = this.cpu?.uart?.[uartIndex];
            if (!uart) return;

            uart.onByte = (value: number) => {
                this.emitSerialByte(value, uartIndex);
            };
        };

        bindUart(0);
        bindUart(1);
    }

    private attachUSBSerial() {
        if (!this.cpu?.usbCtrl) return;

        const cdc = new USBCDC(this.cpu.usbCtrl);
        this.usbCdc = cdc;
        this.usbCdcReady = false;

        cdc.onDeviceConnected = () => {
            this.usbCdcReady = true;
        };

        cdc.onSerialData = (buffer: Uint8Array) => {
            for (let i = 0; i < buffer.length; i++) {
                this.emitSerialByte(buffer[i] & 0xff, 2);
            }
        };
    }

    private buildBoardAliasSet(boardPins: string[]): Set<string> {
        const aliases = new Set<string>();
        for (const pin of boardPins) {
            const raw = String(pin || '').toUpperCase();
            aliases.add(raw);
            aliases.add(this.normalizeToGpPin(raw));
        }
        return aliases;
    }

    private findExistingPinName(inst: BaseComponent, candidates: string[]): string | null {
        for (const name of candidates) {
            if (inst.pins[name]) return name;
            const upper = name.toUpperCase();
            if (inst.pins[upper]) return upper;
            const lower = name.toLowerCase();
            if (inst.pins[lower]) return lower;
        }
        return null;
    }

    private isComponentPinConnectedToBoardPins(componentId: string, componentPin: string, boardPins: string[]): boolean {
        const aliasSet = this.buildBoardAliasSet(boardPins);
        const endpoint = `${componentId}:${componentPin}`;

        for (const wire of this.currentWires) {
            let boardEndpoint: string | null = null;
            if (wire.from === endpoint) boardEndpoint = wire.to;
            else if (wire.to === endpoint) boardEndpoint = wire.from;
            if (!boardEndpoint) continue;

            const [boardId, boardPin] = String(boardEndpoint).split(':');
            if (boardId !== this.boardId) continue;

            const raw = String(boardPin || '').toUpperCase();
            const normalized = this.normalizeToGpPin(raw);
            if (aliasSet.has(raw) || aliasSet.has(normalized)) {
                return true;
            }
        }

        return false;
    }

    private rebuildPeripheralDeviceCache() {
        this.i2cDeviceCache.set('i2c0', this.scanRp2040ConnectedI2CDevices('i2c0'));
        this.i2cDeviceCache.set('i2c1', this.scanRp2040ConnectedI2CDevices('i2c1'));
        this.i2cBusPinPairs.clear();
        const i2c0Pins = this.scanRp2040I2CBusPins('i2c0');
        const i2c1Pins = this.scanRp2040I2CBusPins('i2c1');
        if (i2c0Pins) this.i2cBusPinPairs.set('i2c0', i2c0Pins);
        if (i2c1Pins) this.i2cBusPinPairs.set('i2c1', i2c1Pins);
        this.i2cHardwareSeen.set('i2c0', false);
        this.i2cHardwareSeen.set('i2c1', false);
        this.i2cBitBangState.clear();
        this.spiDeviceBusById.clear();
        this.spiDeviceCache.set('spi0', this.scanRp2040ConnectedSPIDevices('spi0'));
        this.spiDeviceCache.set('spi1', this.scanRp2040ConnectedSPIDevices('spi1'));
        for (const [bus, devices] of this.spiDeviceCache.entries()) {
            for (const inst of devices) {
                let buses = this.spiDeviceBusById.get(inst.id);
                if (!buses) {
                    buses = new Set();
                    this.spiDeviceBusById.set(inst.id, buses);
                }
                buses.add(bus);
            }
        }
        this.peripheralDeviceCacheReady = true;

        if (this.debugEnabled) {
            const spi0Ids = this.spiDeviceCache.get('spi0')?.map((inst) => inst.id) || [];
            const spi1Ids = this.spiDeviceCache.get('spi1')?.map((inst) => inst.id) || [];
            console.log(`[RP2040 SPI CACHE] spi0=[${spi0Ids.join(', ')}] spi1=[${spi1Ids.join(', ')}]`);
            this.onStateUpdate({
                type: 'debug',
                boardId: this.boardId,
                category: 'rp2040-spi',
                reason: 'cache-rebuilt',
                spi: {
                    spi0: spi0Ids,
                    spi1: spi1Ids,
                },
            });
        }
    }

    private getRp2040ConnectedI2CDevices(bus: 'i2c0' | 'i2c1'): BaseComponent[] {
        if (!this.peripheralDeviceCacheReady) {
            this.rebuildPeripheralDeviceCache();
        }
        const wiredDevices = this.i2cDeviceCache.get(bus) || [];
        if (wiredDevices.length > 0) {
            return wiredDevices;
        }

        // Fallback: if bus-pin topology detection misses a supported device,
        // allow address-based matching to keep common display modules functional.
        return this.getI2CCallbackDevices();
    }

    private getRp2040ConnectedSPIBusesForDevice(componentId: string): Array<'spi0' | 'spi1'> {
        if (!this.peripheralDeviceCacheReady) {
            this.rebuildPeripheralDeviceCache();
        }
        return Array.from(this.spiDeviceBusById.get(componentId) || []);
    }

    private getI2CCallbackDevices(): BaseComponent[] {
        const devices: BaseComponent[] = [];
        for (const inst of this.instances.values()) {
            const hasI2cCallbacks = !!(
                inst.onI2CStart
                || inst.onI2CByte
                || inst.onI2CStop
                || typeof (inst as any).onI2CReadByte === 'function'
                || typeof (inst as any).readByte === 'function'
            );
            if (hasI2cCallbacks) {
                devices.push(inst);
            }
        }
        return devices;
    }

    private scanRp2040I2CBusPins(bus: RP2040I2CBus): RP2040I2CBusPins | null {
        const pinMap = RP2040_I2C_SOURCE_PINS[bus];
        if (!pinMap) return null;

        const sdaAliases = this.buildBoardAliasSet(pinMap.sda);
        const sclAliases = this.buildBoardAliasSet(pinMap.scl);

        for (const inst of this.instances.values()) {
            const hasI2cCallbacks = !!(
                inst.onI2CStart
                || inst.onI2CByte
                || inst.onI2CStop
                || typeof (inst as any).onI2CReadByte === 'function'
                || typeof (inst as any).readByte === 'function'
            );
            if (!hasI2cCallbacks) continue;

            const sdaPin = this.findExistingPinName(inst, ['SDA', 'SDA1']);
            const sclPin = this.findExistingPinName(inst, ['SCL', 'SCL1']);
            if (!sdaPin || !sclPin) continue;

            const boardSda = this.resolveBoardPinForComponentPin(inst.id, sdaPin);
            const boardScl = this.resolveBoardPinForComponentPin(inst.id, sclPin);
            if (!boardSda || !boardScl) continue;

            const sda = this.normalizeToGpPin(boardSda);
            const scl = this.normalizeToGpPin(boardScl);
            if (sda === scl) continue;
            if (!sdaAliases.has(sda) || !sclAliases.has(scl)) continue;

            return { sda, scl };
        }

        return null;
    }

    private scanRp2040ConnectedI2CDevices(bus: 'i2c0' | 'i2c1'): BaseComponent[] {
        const pinMap = RP2040_I2C_SOURCE_PINS[bus];
        if (!pinMap) return [];

        const devices: BaseComponent[] = [];
        for (const inst of this.instances.values()) {
            const hasI2cCallbacks = !!(
                inst.onI2CStart
                || inst.onI2CByte
                || inst.onI2CStop
                || typeof (inst as any).onI2CReadByte === 'function'
                || typeof (inst as any).readByte === 'function'
            );
            if (!hasI2cCallbacks) continue;

            const sdaPin = this.findExistingPinName(inst, ['SDA', 'SDA1']);
            const sclPin = this.findExistingPinName(inst, ['SCL', 'SCL1']);
            if (!sdaPin || !sclPin) continue;

            const sdaConnected = this.isComponentPinConnectedToBoardPins(inst.id, sdaPin, pinMap.sda);
            const sclConnected = this.isComponentPinConnectedToBoardPins(inst.id, sclPin, pinMap.scl);
            if (sdaConnected && sclConnected) {
                devices.push(inst);
            }
        }

        return devices;
    }

    private isRp2040SpiSelected(inst: BaseComponent): boolean {
        const csNames = ['CS', 'CE', 'SS', 'SSEL', 'NSS', 'CSN', 'CS_N', 'NCE'];
        const csPin = this.findExistingPinName(inst, csNames);
        if (!csPin) return true;
        return inst.getPinVoltage(csPin) < 0.5;
    }

    private parseGpIndex(pinId: string): number | null {
        const norm = this.normalizeToGpPin(pinId);
        const match = /^GP(\d+)$/.exec(norm);
        if (!match) return null;
        const idx = Number(match[1]);
        if (!Number.isFinite(idx) || idx < 0 || idx > 28) return null;
        return idx;
    }

    private sampleBoardPinHigh(pinId: string): boolean {
        if (!this.cpu) return false;
        const idx = this.parseGpIndex(pinId);
        if (idx == null) return false;
        const state = this.cpu.gpio[idx].value;
        return state === GPIOPinState.High || state === GPIOPinState.InputPullUp;
    }

    private resolveBoardPinForComponentPin(componentId: string, componentPin: string): string | null {
        const endpoint = `${componentId}:${componentPin}`;
        for (const wire of this.currentWires) {
            let boardEndpoint: string | null = null;
            if (wire.from === endpoint) boardEndpoint = wire.to;
            else if (wire.to === endpoint) boardEndpoint = wire.from;
            if (!boardEndpoint) continue;

            const [boardId, boardPin] = String(boardEndpoint).split(':');
            if (boardId !== this.boardId) continue;
            return this.normalizeToGpPin(String(boardPin || ''));
        }
        return null;
    }

    private syncSpiControlPins(inst: BaseComponent) {
        if (!this.cpu) return;

        const controlAliases = [
            ['CS', 'CE', 'SS', 'SSEL', 'NSS', 'CSN', 'CS_N', 'NCE'],
            ['DC', 'D_C', 'A0', 'RS'],
            ['RESET', 'RST', 'RES', 'NRST'],
        ];

        for (const aliases of controlAliases) {
            const pinName = this.findExistingPinName(inst, aliases);
            if (!pinName) continue;

            const gpPin = this.resolveBoardPinForComponentPin(inst.id, pinName);
            if (!gpPin) continue;

            const isHigh = this.sampleBoardPinHigh(gpPin);
            const nextVoltage = isHigh ? 3.3 : 0.0;
            if (!inst.pins[pinName]) {
                inst.pins[pinName] = { voltage: nextVoltage, mode: 'INPUT' };
            }
            inst.setPinVoltage(pinName, nextVoltage);
            inst.onPinStateChange(pinName, isHigh, this.cpu.core.cycles);
        }
    }

    private getRp2040ConnectedSPIDevices(bus: 'spi0' | 'spi1'): BaseComponent[] {
        if (!this.peripheralDeviceCacheReady) {
            this.rebuildPeripheralDeviceCache();
        }
        const wired = this.spiDeviceCache.get(bus) || [];
        if (wired.length > 0) return wired;

        // Fallback: if wire trace missed it, return all components implementing onSPIByte
        const fallback: BaseComponent[] = [];
        for (const inst of this.instances.values()) {
            if (typeof inst.onSPIByte === 'function') {
                fallback.push(inst);
            }
        }
        return fallback;
    }

    private getSpiControlPinRole(pinId: string): 'CS' | 'DC' | 'RESET' | null {
        const key = String(pinId || '').toUpperCase();
        if (['CS', 'CE', 'SS', 'SSEL', 'NSS', 'CSN', 'CS_N', 'NCE'].includes(key)) return 'CS';
        if (['DC', 'D_C', 'A0', 'RS'].includes(key)) return 'DC';
        if (['RESET', 'RST', 'RES', 'NRST'].includes(key)) return 'RESET';
        return null;
    }

    private flushRp2040SpiFrame(bus: 'spi0' | 'spi1', reason: string) {
        const state = this.spiFrameState.get(bus);
        if (!state || state.bytes.length === 0) return;

        const devices = this.getRp2040ConnectedSPIDevices(bus);
        this.onStateUpdate({
            type: 'protocol:spi',
            boardId: this.boardId,
            data: [...state.bytes],
            timestamp: state.lastByteTime,
        });
        this.debugSpiTxTransactions += 1;

        this.onStateUpdate({
            type: 'debug',
            boardId: this.boardId,
            category: 'rp2040-spi',
            reason: 'frame',
            spi: {
                bus,
                frameBytes: state.bytes.length,
                txBytes: this.debugSpiTxBytes,
                txTransactions: this.debugSpiTxTransactions,
                deviceCount: devices.length,
                deviceIds: devices.map((d) => d.id),
                flushReason: reason,
            },
        });

        if (this.debugEnabled) {
            console.log(
                `[RP2040 SPI] ${bus} frame=${state.bytes.length} reason=${reason} devices=${devices.length}`
            );
        }

        state.bytes = [];
    }

    private scanRp2040ConnectedSPIDevices(bus: 'spi0' | 'spi1'): BaseComponent[] {
        const pinMap = RP2040_SPI_SOURCE_PINS[bus];
        if (!pinMap) return [];

        const devices: BaseComponent[] = [];
        for (const inst of this.instances.values()) {
            if (typeof inst.onSPIByte !== 'function') continue;

            const mosiPin = this.findExistingPinName(inst, ['MOSI', 'DIN', 'SI', 'SDI']);
            const sckPin = this.findExistingPinName(inst, ['SCK', 'CLK', 'SCLK']);
            if (!mosiPin || !sckPin) continue;

            if (!this.isComponentPinConnectedToBoardPins(inst.id, mosiPin, pinMap.mosi)) continue;
            if (!this.isComponentPinConnectedToBoardPins(inst.id, sckPin, pinMap.sck)) continue;

            const csPin = this.findExistingPinName(inst, ['CS', 'SS', 'CSN', 'NSS', 'CE', 'CS_N']);
            if (!csPin) continue;

            devices.push(inst);
        }

        return devices;
    }

    private installRp2040I2cAdapters() {
        if (!this.cpu) return;

        const attachBus = (index: 0 | 1, bus: 'i2c0' | 'i2c1') => {
            const i2c: any = (this.cpu as any)?.i2c?.[index];
            if (!i2c) return;

            let activeSlave: BaseComponent | null = null;
            let transactionBytes: number[] = [];
            let currentAddress: number = 0;
            let isWriteMode = true;

            i2c.onStart = (repeatedStart: boolean) => {
                void repeatedStart;
                activeSlave = null;
                i2c.completeStart();
            };

            i2c.onConnect = (address: number, mode: number) => {
                transactionBytes = [];
                currentAddress = address & 0x7f;
                this.i2cHardwareSeen.set(bus, true);
                const isRead = Number(mode) === 1;
                isWriteMode = !isRead;
                const devices = this.getRp2040ConnectedI2CDevices(bus);
                let ack = false;
                activeSlave = null;

                for (const inst of devices) {
                    if (!inst.onI2CStart) continue;
                    if (inst.onI2CStart(address, isRead)) {
                        ack = true;
                        if (!activeSlave) activeSlave = inst;
                    }
                }

                i2c.completeConnect(ack);

                if (this.debugEnabled) {
                    this.onStateUpdate({
                        type: 'debug',
                        boardId: this.boardId,
                        category: 'rp2040-i2c',
                        reason: 'connect',
                        i2c: {
                            bus,
                            address: address & 0x7f,
                            isRead,
                            ack,
                            deviceCount: devices.length,
                            activeSlaveId: activeSlave?.id || '',
                        },
                    });
                }
            };

            i2c.onWriteByte = (value: number) => {
                transactionBytes.push(value & 0xff);
                const devices = activeSlave ? [activeSlave] : this.getRp2040ConnectedI2CDevices(bus);
                let ack = false;
                for (const inst of devices) {
                    if (!inst.onI2CByte) continue;
                    if (inst.onI2CByte(-1, value & 0xff)) {
                        ack = true;
                    }
                }
                i2c.completeWrite(ack);
            };

            i2c.onReadByte = (ack: boolean) => {
                void ack;
                let byte = 0xff;
                if (activeSlave) {
                    const slave: any = activeSlave;
                    if (typeof slave.onI2CReadByte === 'function') {
                        byte = slave.onI2CReadByte() & 0xff;
                    } else if (typeof slave.readByte === 'function') {
                        byte = slave.readByte() & 0xff;
                    }
                }
                transactionBytes.push(byte);
                i2c.completeRead(byte);
            };

            i2c.onStop = () => {
                if (transactionBytes.length > 0) {
                    this.onStateUpdate({
                        type: 'protocol:i2c',
                        boardId: this.boardId,
                        address: currentAddress,
                        data: [...transactionBytes],
                        isWrite: isWriteMode,
                        timestamp: this.getSimulatedTimeMs()
                    });
                }
                const devices = activeSlave ? [activeSlave] : this.getRp2040ConnectedI2CDevices(bus);
                for (const inst of devices) {
                    if (inst.onI2CStop) inst.onI2CStop();
                }
                activeSlave = null;
                const bitBang = this.i2cBitBangState.get(bus);
                if (bitBang) {
                    bitBang.inFrame = false;
                    bitBang.phase = 0;
                    bitBang.shift = 0;
                    bitBang.byteIndex = 0;
                    bitBang.read = false;
                    bitBang.activeSlave = null;
                    bitBang.ackShouldBeLow = false;
                    bitBang.ackDriveActive = false;
                }
                i2c.completeStop();
            };
        };

        attachBus(0, 'i2c0');
        attachBus(1, 'i2c1');
    }

    private installRp2040SpiAdapters() {
        if (!this.cpu) return;

        const attachBus = (index: 0 | 1, bus: 'spi0' | 'spi1') => {
            const spi: any = (this.cpu as any)?.spi?.[index];
            const frameState = this.spiFrameState.get(bus) || { bytes: [], lastByteTime: 0 };
            this.spiFrameState.set(bus, frameState);
            if (!spi) {
                this.onStateUpdate({
                    type: 'debug',
                    boardId: this.boardId,
                    category: 'rp2040-spi',
                    reason: 'missing-bus',
                    spi: { bus, attached: false, deviceCount: 0 },
                });
                return;
            }

            this.onStateUpdate({
                type: 'debug',
                boardId: this.boardId,
                category: 'rp2040-spi',
                reason: 'attach-bus',
                spi: { bus, attached: true, deviceCount: 0 },
            });

            // rp2040js SPI doTX currently sets busy=true after invoking onTransmit().
            // Under high-throughput writes this can stall and/or drop bytes because
            // firmware keeps writing while TX stays artificially busy. Patch doTX once
            // so busy is asserted before callback, then cleared by completeTransmit().
            if (!spi.__openhwPatchedDoTX && typeof spi.doTX === 'function' && spi.txFIFO) {
                spi.__openhwPatchedDoTX = true;
                spi.doTX = function patchedDoTX(this: any) {
                    if (!this.busy && !this.txFIFO.empty) {
                        const value = this.txFIFO.pull();
                        this.busy = true;
                        this.onTransmit(value);
                        this.fifosUpdated();
                    }
                };
            }

            spi.onTransmit = (value: number) => {
                const nowMs = this.getSimulatedTimeMs();
                if (nowMs - frameState.lastByteTime > 2.0 && frameState.bytes.length > 0) {
                    this.flushRp2040SpiFrame(bus, 'idle-gap');
                }
                frameState.lastByteTime = nowMs;
                frameState.bytes.push(value & 0xff);
                this.debugSpiTxBytes += 1;

                const byte = value & 0xff;
                const byteIndex = frameState.bytes.length - 1;
                let response = 0xff;
                const devices = this.getRp2040ConnectedSPIDevices(bus);

                if (frameState.bytes.length === 1 || nowMs - this.debugLastSpiLogAt > 500) {
                    this.debugLastSpiLogAt = nowMs;
                }

                for (const inst of devices) {
                    this.syncSpiControlPins(inst);
                    if (!this.isRp2040SpiSelected(inst)) continue;
                    const out = inst.onSPIByte?.(byte);
                    if (out !== undefined) {
                        response = Number(out) & 0xff;
                    }
                }

                spi.completeTransmit(response);
            };
        };

        attachBus(0, 'spi0');
        attachBus(1, 'spi1');
    }

    private emitSerialByte(value: number, source: number) {
        const byte = value & 0xff;
        const char = String.fromCharCode(byte);
        const now = performance.now();

        if (source === 2) {
            this.lastUsbSerialAt = now;
        } else if (
            this.usbCdcReady
            && (now - this.lastUsbSerialAt) <= RP2040Runner.USB_SERIAL_PREFER_WINDOW_MS
        ) {
            // When USB CDC is actively producing serial, suppress near-concurrent
            // UART echoes to avoid doubled/garbled monitor output.
            return;
        }

        this.activeUartIndex = source;

        // MicroPython UF2 can emit identical bytes over UART and USB CDC nearly
        // simultaneously. Drop the second copy to keep the monitor readable.
        if (
            source !== this.lastSerialSource
            && byte === this.lastSerialByte
            && (now - this.lastSerialEmitAt) <= RP2040Runner.SERIAL_DEDUP_WINDOW_MS
        ) {
            this.lastSerialSource = source;
            this.lastSerialEmitAt = now;
            return;
        }

        this.lastSerialByte = byte;
        this.lastSerialSource = source;
        this.lastSerialEmitAt = now;
        this.debugSerialTxBytes += 1;
        this.pulseBoardUartLed(source === 1 ? 'GP4' : 'GP0');
        const sourceLabel = source === 2 ? 'usb' : source === 1 ? 'uart1' : 'uart0';

        if (this.onByteTransmitCb) {
            this.onByteTransmitCb({ boardId: this.boardId, value: byte, char, source: sourceLabel });
        } else {
            this.onStateUpdate({ type: 'serial', data: char, value: byte, boardId: this.boardId, source: sourceLabel });
        }
    }

    private pulseBoardUartLed(pinId: 'GP0' | 'GP1' | 'GP4' | 'GP5') {
        const boardInst = this.instances.get(this.boardId);
        if (!boardInst || !this.cpu) return;
        boardInst.onPinStateChange(pinId, true, this.cpu.core.cycles);

        const previousTimer = this.uartLedOffTimers.get(pinId);
        if (previousTimer) {
            clearTimeout(previousTimer);
        }

        const offTimer = setTimeout(() => {
            this.uartLedOffTimers.delete(pinId);
            if (!this.cpu) return;
            const liveBoardInst = this.instances.get(this.boardId);
            if (!liveBoardInst) return;
            liveBoardInst.onPinStateChange(pinId, false, this.cpu.core.cycles);
        }, RP2040Runner.UART_LED_PULSE_MS);
        this.uartLedOffTimers.set(pinId, offTimer);
    }

    private clearPendingUartLedTimers() {
        for (const timerId of this.uartLedOffTimers.values()) {
            clearTimeout(timerId);
        }
        this.uartLedOffTimers.clear();
    }

    private normalizeToGpPin(pinId: string): string {
        const raw = String(pinId || '').toUpperCase();
        if (/^GP\d+$/.test(raw)) return raw;
        if (/^GPIO\d+$/.test(raw)) return `GP${raw.slice(4)}`;
        if (/^D\d+$/.test(raw)) return `GP${raw.slice(1)}`;
        if (/^\d+$/.test(raw)) return `GP${raw}`;
        return raw;
    }

    private boardPinAliases(pinId: string): string[] {
        const gp = this.normalizeToGpPin(pinId);
        const match = /^GP(\d+)$/.exec(gp);
        if (!match) return [pinId, gp];
        const n = match[1];
        return [pinId, gp, `GPIO${n}`, `D${n}`, n];
    }

    private isBoardPin(wireCoord: string, targetGpPin: string): boolean {
        const [compId, compPin] = wireCoord.split(':');
        if (compId !== this.boardId) return false;
        const norm = this.normalizeToGpPin(compPin);
        return this.boardPinAliases(targetGpPin).includes(norm) || this.boardPinAliases(targetGpPin).includes(compPin);
    }

    private getRp2040ClockHz(): number {
        const hz = Number(this.cpu?.clkSys || 125_000_000);
        return Number.isFinite(hz) && hz > 0 ? hz : 125_000_000;
    }

    private getProtocolEndpointsForGpPin(gpPin: string): ConnectedComponentPin[] {
        const key = this.normalizeToGpPin(gpPin);
        const cached = this.protocolEndpointsCache.get(key);
        if (cached) return cached;

        const endpoints = collectConnectedComponentPins(
            this.boardId,
            this.boardPinAliases(key),
            this.currentWires,
            this.instances
        );
        this.protocolEndpointsCache.set(key, endpoints);
        return endpoints;
    }

    /** Finds the first existing pin on `inst` from a list of candidate names
     *  (case-insensitive, lower then UPPER checked). */
    private findI2SPinName(inst: BaseComponent, candidates: string[]): string | null {
        for (const name of candidates) {
            if (inst.pins[name])               return name;
            if (inst.pins[name.toUpperCase()]) return name.toUpperCase();
        }
        return null;
    }

    private tickI2S(inst: BaseComponent, compId: string, compPin: string, isHigh: boolean) {
        if (!inst || typeof (inst as any).onI2SFrame !== 'function') return;

        // Try to identify if the transitioning pin is BCLK or WS
        const isBclk = ['bclk', 'bck', 'sck'].includes(compPin.toLowerCase());
        const isWs   = ['ws', 'lrck', 'lrc', 'lrclk'].includes(compPin.toLowerCase());
        if (!isBclk && !isWs) return;

        if (!this.i2sState.has(compId)) {
            this.i2sState.set(compId, { bclkLast: false, wsLast: false, shiftBuf: 0, bitCount: 0 });
        }
        const state = this.i2sState.get(compId)!;

        if (isWs) {
            if (state.wsLast !== isHigh) {
                // WS edge → end of the current-channel frame
                const bpf = (inst.state?.i2sBitsPerFrame as number | undefined) ?? 16;
                if (state.bitCount >= bpf) {
                    const channel = state.wsLast ? 1 : 0;
                    const sample  = (state.shiftBuf << (32 - bpf)) | 0; // sign-extend
                    (inst as any).onI2SFrame(channel, sample, bpf);
                }
                state.wsLast   = isHigh;
                state.shiftBuf = 0;
                state.bitCount = 0;
            }
            return;
        }

        // BCLK edge
        const rising = isHigh && !state.bclkLast;
        state.bclkLast = isHigh;

        if (rising) {
            // Sample SDATA (accept several common pin names)
            const sdPin = this.findI2SPinName(inst, ['sdata', 'sdin', 'din', 'sd', 'dout', 'data']);
            const bit   = sdPin !== null ? (inst.getPinVoltage(sdPin) > 0.5 ? 1 : 0) : 0;

            const bpf = (inst.state?.i2sBitsPerFrame as number | undefined) ?? 16;
            state.shiftBuf = ((state.shiftBuf << 1) | bit) >>> 0;
            state.bitCount++;

            if (state.bitCount >= bpf) {
                const channel = state.wsLast ? 1 : 0;
                const sample  = (state.shiftBuf << (32 - bpf)) | 0;
                (inst as any).onI2SFrame(channel, sample, bpf);
                state.shiftBuf = 0;
                state.bitCount = 0;
            }
        }
    }

    private dispatchOptionalPwm(gpPin: string, isHigh: boolean, cycles: number, functionSelect: number) {
        const key = this.normalizeToGpPin(gpPin);
        let state = this.pwmState.get(key);
        if (!state) {
            state = { lastRiseCycle: -1, lastFallCycle: -1, lastPeriodCycles: -1 };
            this.pwmState.set(key, state);
        }

        const clockHz = this.getRp2040ClockHz();
        let frequencyHz = 0;
        let dutyCycle = 0;
        let pulseUs = 0;
        let periodUs = 0;

        if (isHigh) {
            if (state.lastRiseCycle >= 0 && state.lastFallCycle > state.lastRiseCycle) {
                const periodCycles = Math.max(1, cycles - state.lastRiseCycle);
                const highCycles = Math.max(0, state.lastFallCycle - state.lastRiseCycle);
                state.lastPeriodCycles = periodCycles;
                frequencyHz = clockHz / periodCycles;
                dutyCycle = Math.max(0, Math.min(1, highCycles / periodCycles));
                periodUs = (periodCycles * 1_000_000) / clockHz;
                pulseUs = (highCycles * 1_000_000) / clockHz;
            }
            state.lastRiseCycle = cycles;
        } else {
            state.lastFallCycle = cycles;
            if (state.lastRiseCycle >= 0) {
                const highCycles = Math.max(0, cycles - state.lastRiseCycle);
                pulseUs = (highCycles * 1_000_000) / clockHz;
                if (state.lastPeriodCycles > 0) {
                    frequencyHz = clockHz / state.lastPeriodCycles;
                    dutyCycle = Math.max(0, Math.min(1, highCycles / state.lastPeriodCycles));
                    periodUs = (state.lastPeriodCycles * 1_000_000) / clockHz;
                }
            }
        }

        if (frequencyHz <= 0 && dutyCycle <= 0 && pulseUs <= 0) return;

        const meta = {
            protocol: 'pwm',
            boardPin: key,
            isHigh,
            frequencyHz,
            dutyCycle,
            pulseUs,
            periodUs,
            functionSelect,
            source: functionSelect === RP2040_GPIO_FUNC_PWM ? 'pwm' : 'gpio',
            cycles,
        };

        for (const endpoint of this.getProtocolEndpointsForGpPin(key)) {
            invokeOptional(endpoint.inst as any, ['onPWM', 'onPwm', 'onPWMSignal'], [endpoint.pinId, meta]);
        }
    }

    private dispatchOptionalPio(gpPin: string, isHigh: boolean, cycles: number, functionSelect: number) {
        if (functionSelect !== RP2040_GPIO_FUNC_PIO0 && functionSelect !== RP2040_GPIO_FUNC_PIO1) {
            return;
        }

        const key = this.normalizeToGpPin(gpPin);
        const pioIndex = functionSelect === RP2040_GPIO_FUNC_PIO1 ? 1 : 0;
        const meta = {
            protocol: 'pio',
            boardPin: key,
            isHigh,
            pioIndex,
            functionSelect,
            cycles,
        };

        for (const endpoint of this.getProtocolEndpointsForGpPin(key)) {
            invokeOptional(endpoint.inst as any, ['onPIOPinChange', 'onPioPinChange', 'onPIO', 'onPio'], [endpoint.pinId, isHigh, meta]);
        }
    }

    private dispatchOptionalOneWire(gpPin: string, isHigh: boolean, cycles: number) {
        const key = this.normalizeToGpPin(gpPin);
        let state = this.oneWireState.get(key);
        if (!state) {
            state = { lowStartCycle: null, highStartCycle: null };
            this.oneWireState.set(key, state);
        }

        const endpoints = this.getProtocolEndpointsForGpPin(key);
        if (!endpoints.length) {
            if (isHigh) {
                state.lowStartCycle = null;
                state.highStartCycle = cycles;
            } else {
                state.highStartCycle = null;
                state.lowStartCycle = cycles;
            }
            return;
        }

        const clockHz = this.getRp2040ClockHz();

        if (!isHigh) {
            if (state.highStartCycle != null) {
                const highCycles = Math.max(0, cycles - state.highStartCycle);
                const highUs = (highCycles * 1_000_000) / clockHz;
                if (highUs > 0) {
                    const pulseMeta = {
                        protocol: 'pulse',
                        boardPin: key,
                        pulseUs: highUs,
                        highUs,
                        edge: 'falling',
                        cycles,
                    };
                    for (const endpoint of endpoints) {
                        invokeOptional(endpoint.inst as any, ['onPulseHigh', 'onDigitalPulseHigh', 'onOneWirePulseHigh'], [endpoint.pinId, pulseMeta]);
                    }
                }
            }

            state.highStartCycle = null;
            state.lowStartCycle = cycles;
            return;
        }

        if (state.lowStartCycle == null) return;

        const lowCycles = Math.max(0, cycles - state.lowStartCycle);
        state.lowStartCycle = null;
        state.highStartCycle = cycles;
        const lowUs = (lowCycles * 1_000_000) / clockHz;

        if (lowUs > 0) {
            const pulseMeta = {
                protocol: 'pulse',
                boardPin: key,
                pulseUs: lowUs,
                lowUs,
                edge: 'rising',
                cycles,
            };
            for (const endpoint of endpoints) {
                invokeOptional(endpoint.inst as any, ['onPulseLow', 'onDigitalPulseLow', 'onOneWirePulseLow'], [endpoint.pinId, pulseMeta]);
            }
        }

        if (lowUs >= 360) {
            const meta = {
                protocol: 'onewire',
                boardPin: key,
                pulseUs: lowUs,
                kind: 'reset',
                cycles,
            };
            for (const endpoint of endpoints) {
                invokeOptional(endpoint.inst as any, ['onOneWireReset', 'onOnewireReset'], [endpoint.pinId, meta]);
            }
            return;
        }

        if (lowUs >= 1 && lowUs <= 120) {
            const bit = lowUs < 20 ? 1 : 0;
            const meta = {
                protocol: 'onewire',
                boardPin: key,
                pulseUs: lowUs,
                kind: 'slot',
                bit,
                cycles,
            };
            for (const endpoint of endpoints) {
                invokeOptional(endpoint.inst as any, ['onOneWireWriteBit', 'onOnewireWriteBit'], [endpoint.pinId, bit, meta]);
                invokeOptional(endpoint.inst as any, ['onOneWireSlot', 'onOnewireSlot'], [endpoint.pinId, meta]);
            }
        }
    }

    private getRp2040I2CBitBangState(bus: RP2040I2CBus, pins: RP2040I2CBusPins): RP2040I2CBitBangState {
        let state = this.i2cBitBangState.get(bus);
        const currentSdaHigh = !!this.pinStates[pins.sda];
        const currentSclHigh = !!this.pinStates[pins.scl];

        if (!state) {
            state = {
                initialized: true,
                prevSdaHigh: currentSdaHigh,
                prevSclHigh: currentSclHigh,
                inFrame: false,
                phase: 0,
                shift: 0,
                byteIndex: 0,
                read: false,
                activeSlave: null,
                ackShouldBeLow: false,
                ackDriveActive: false,
            };
            this.i2cBitBangState.set(bus, state);
            return state;
        }

        if (!state.initialized) {
            state.initialized = true;
            state.prevSdaHigh = currentSdaHigh;
            state.prevSclHigh = currentSclHigh;
        }

        return state;
    }

    private setRp2040I2CFallbackSdaInput(pin: string, isHigh: boolean) {
        if (!this.cpu) return;
        const idx = this.parseGpIndex(pin);
        if (idx == null) return;
        this.cpu.gpio[idx].setInputValue(!!isHigh);
    }

    private consumeRp2040I2CBitBangByte(bus: RP2040I2CBus, state: RP2040I2CBitBangState, value: number): boolean {
        const byte = value & 0xff;
        let ack = false;

        if (state.byteIndex === 0) {
            const address = (byte >>> 1) & 0x7f;
            const isRead = (byte & 0x01) !== 0;
            const devices = this.getRp2040ConnectedI2CDevices(bus);

            let activeSlave: BaseComponent | null = null;
            for (const inst of devices) {
                if (!inst.onI2CStart) continue;
                if (inst.onI2CStart(address, isRead)) {
                    if (!activeSlave) activeSlave = inst;
                }
            }

            state.activeSlave = activeSlave;
            state.read = isRead;
            ack = !!activeSlave;

            if (this.debugEnabled) {
                this.onStateUpdate({
                    type: 'debug',
                    boardId: this.boardId,
                    category: 'rp2040-i2c',
                    reason: 'connect-bitbang',
                    i2c: {
                        bus,
                        address,
                        isRead,
                        ack,
                        deviceCount: devices.length,
                        activeSlaveId: activeSlave?.id || '',
                    },
                });
            }
        } else if (state.activeSlave && !state.read && state.activeSlave.onI2CByte) {
            ack = !!state.activeSlave.onI2CByte(-1, byte);
        } else if (state.activeSlave) {
            ack = true;
        }

        state.byteIndex += 1;
        return ack;
    }

    private dispatchOptionalI2CFallback(gpPin: string) {
        const pin = this.normalizeToGpPin(gpPin);
        const buses: RP2040I2CBus[] = ['i2c0', 'i2c1'];

        for (const bus of buses) {
            if (this.i2cHardwareSeen.get(bus)) continue;

            const pins = this.i2cBusPinPairs.get(bus);
            if (!pins) continue;
            if (pin !== pins.sda && pin !== pins.scl) continue;

            const state = this.getRp2040I2CBitBangState(bus, pins);
            const sdaNow = !!this.pinStates[pins.sda];
            const sclNow = !!this.pinStates[pins.scl];

            const startCondition = state.prevSdaHigh && !sdaNow && state.prevSclHigh && sclNow;
            const stopCondition = !state.prevSdaHigh && sdaNow && state.prevSclHigh && sclNow;
            const fallingScl = state.prevSclHigh && !sclNow;

            if (startCondition) {
                if (state.ackDriveActive) {
                    this.setRp2040I2CFallbackSdaInput(pins.sda, true);
                    state.ackDriveActive = false;
                }
                state.inFrame = true;
                state.phase = 0;
                state.shift = 0;
                state.byteIndex = 0;
                state.read = false;
                state.activeSlave = null;
                state.ackShouldBeLow = false;
            }

            const risingScl = !state.prevSclHigh && sclNow;
            if (state.inFrame && risingScl) {
                const bit = sdaNow ? 1 : 0;
                if (state.phase < 8) {
                    state.shift = ((state.shift << 1) | bit) & 0xff;
                    state.phase += 1;
                    if (state.phase === 8) {
                        state.ackShouldBeLow = this.consumeRp2040I2CBitBangByte(bus, state, state.shift);
                    }
                } else {
                    // ACK/NACK bit sampled by master.
                    state.phase = 0;
                    state.shift = 0;
                    state.ackShouldBeLow = false;
                }
            }

            if (fallingScl) {
                if (state.phase === 8 && state.ackShouldBeLow && !state.ackDriveActive) {
                    // Drive ACK while SCL is low so SDA is stable before master's rising-edge sample.
                    this.setRp2040I2CFallbackSdaInput(pins.sda, false);
                    state.ackDriveActive = true;
                } else if (state.phase === 0 && state.ackDriveActive) {
                    this.setRp2040I2CFallbackSdaInput(pins.sda, true);
                    state.ackDriveActive = false;
                }
            }

            if (stopCondition) {
                if (state.activeSlave && state.activeSlave.onI2CStop) {
                    state.activeSlave.onI2CStop();
                }
                if (state.ackDriveActive) {
                    this.setRp2040I2CFallbackSdaInput(pins.sda, true);
                    state.ackDriveActive = false;
                }
                state.inFrame = false;
                state.phase = 0;
                state.shift = 0;
                state.byteIndex = 0;
                state.read = false;
                state.activeSlave = null;
                state.ackShouldBeLow = false;
            }

            state.prevSdaHigh = sdaNow;
            state.prevSclHigh = sclNow;
        }
    }

    private dispatchOptionalProtocols(gpPin: string, isHigh: boolean, cycles: number, functionSelect: number) {
        this.dispatchOptionalPwm(gpPin, isHigh, cycles, functionSelect);
        this.dispatchOptionalPio(gpPin, isHigh, cycles, functionSelect);
        this.dispatchOptionalOneWire(gpPin, isHigh, cycles);
        this.dispatchOptionalI2CFallback(gpPin);
    }

    private traversePassive(inst: BaseComponent, compId: string, pinId: string, voltage: number, visit: (target: string) => void) {
        if (inst.type === 'openhw-resistor' || inst.type === 'openhw-resistor') {
            const otherPin = pinId === 'p1' ? 'p2' : pinId === 'p2' ? 'p1' : null;
            if (!otherPin) return;
            inst.setPinVoltage(otherPin, voltage);
            visit(`${compId}:${otherPin}`);
        } else if (inst.type === 'openhw-pushbutton' || inst.type === 'wokwi-pushbutton') {
            // Internal short-circuit connections
            if (pinId === '1l' || pinId === '1') {
                inst.setPinVoltage('1r', voltage);
                visit(`${compId}:1r`);
                inst.setPinVoltage('1', voltage);
                visit(`${compId}:1`);
                inst.setPinVoltage('1l', voltage);
                visit(`${compId}:1l`);
            } else if (pinId === '1r') {
                inst.setPinVoltage('1l', voltage);
                visit(`${compId}:1l`);
                inst.setPinVoltage('1', voltage);
                visit(`${compId}:1`);
            } else if (pinId === '2l' || pinId === '2') {
                inst.setPinVoltage('2r', voltage);
                visit(`${compId}:2r`);
                inst.setPinVoltage('2', voltage);
                visit(`${compId}:2`);
                inst.setPinVoltage('2l', voltage);
                visit(`${compId}:2l`);
            } else if (pinId === '2r') {
                inst.setPinVoltage('2l', voltage);
                visit(`${compId}:2l`);
                inst.setPinVoltage('2', voltage);
                visit(`${compId}:2`);
            }

            // Tactile switch crossing
            if (inst.state?.pressed) {
                if (pinId.startsWith('1')) {
                    inst.setPinVoltage('2l', voltage);
                    visit(`${compId}:2l`);
                    inst.setPinVoltage('2r', voltage);
                    visit(`${compId}:2r`);
                    inst.setPinVoltage('2', voltage);
                    visit(`${compId}:2`);
                } else if (pinId.startsWith('2')) {
                    inst.setPinVoltage('1l', voltage);
                    visit(`${compId}:1l`);
                    inst.setPinVoltage('1r', voltage);
                    visit(`${compId}:1r`);
                    inst.setPinVoltage('1', voltage);
                    visit(`${compId}:1`);
                }
            }
        }
    }

    private updatePhysicsInternal() {}

    private propagateBoardPin(gpPin: string, isHigh: boolean) {
        const voltage = isHigh ? 3.3 : 0.0;

        const boardInst = this.instances.get(this.boardId);
        if (boardInst && this.cpu) {
            boardInst.onPinStateChange(gpPin, isHigh, this.cpu.cycles);
        }

        const visitedEdges = new Set<string>();
        const visitedNodes = new Set<string>();

        const visitNode = (node: string) => {
            if (visitedNodes.has(node)) return;
            visitedNodes.add(node);

            const [compId, compPin] = node.split(':');
            for (const wire of this.currentWires) {
                const edgeKey = `${wire.from}|${wire.to}`;
                if (visitedEdges.has(edgeKey)) continue;
                if (wire.from === node || wire.to === node) {
                    visitedEdges.add(edgeKey);
                    const next = wire.from === node ? wire.to : wire.from;
                    visitNode(next);
                }
            }

            const inst = this.instances.get(compId);
            if (!inst) return;
            if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: 'INPUT' };
            inst.setPinVoltage(compPin, voltage);
            this.circuitDirty = true;
            if (this.cpu) {
                inst.onPinStateChange(compPin, voltage > 1.8, this.cpu.cycles);
            }
            this.tickI2S(inst, compId, compPin, voltage > 1.8);

            this.traversePassive(inst, compId, compPin, voltage, (forwardNode) => {
                visitNode(forwardNode);
            });
        };

        for (const wire of this.currentWires) {
            const edgeKey = `${wire.from}|${wire.to}`;
            const fromBoard = this.isBoardPin(wire.from, gpPin);
            const toBoard = this.isBoardPin(wire.to, gpPin);
            if (!fromBoard && !toBoard) continue;
            visitedEdges.add(edgeKey);
            visitNode(fromBoard ? wire.to : wire.from);
        }

        // Drive fixed board rails
        this.instances.forEach((inst) => {
            Object.keys(inst.pins).forEach((pinKey) => {
                const upper = pinKey.toUpperCase();
                if (upper === 'GND' || upper === 'AGND' || upper === 'VSS' || upper.startsWith('GND_') || upper.startsWith('GND.') || upper === 'K') {
                    inst.setPinVoltage(pinKey, 0.0);
                }
                if (upper === '3V3' || upper === 'VCC' || upper.startsWith('3V3.')) {
                    inst.setPinVoltage(pinKey, 3.3);
                }
            });
        });
    }

    private onPinChange(pin: number, isHigh: boolean, cycleOverride?: number) {
        const pinName = `GP${pin}`;
        if (this.pinStates[pinName] === isHigh) return;

        this.pinStates[pinName] = isHigh;
        this.pinsChanged = true;
        this.debugGpioTransitions += 1;
        this.debugLastGpioPin = pinName;

        const rawCycles = Number.isFinite(Number(cycleOverride))
            ? Number(cycleOverride)
            : Number(this.cpu?.core.cycles ?? 0);
        const cycles = rawCycles >= this.pioSignalCycle ? rawCycles : this.pioSignalCycle;
        this.pioSignalCycle = cycles;
        
        const boardInst = this.instances.get(this.boardId);
        const clockScale = 16_000_000 / this.getRp2040ClockHz();
        const normalizedCycles = Math.floor(cycles * clockScale);

        if (boardInst) {
            boardInst.onPinStateChange(pinName, isHigh, normalizedCycles);
        }

        for (const endpoint of this.getProtocolEndpointsForGpPin(pinName)) {
            endpoint.inst.onPinStateChange(endpoint.pinId, isHigh, normalizedCycles);

            if (isHigh) {
                const pinNameUpper = String(endpoint.pinId || '').toUpperCase();
                if (['CS', 'SS', 'CSN', 'NSS', 'CE', 'CS_N'].includes(pinNameUpper)) {
                    if (endpoint.inst.state?.csActive === false) {
                        for (const bus of this.getRp2040ConnectedSPIBusesForDevice(endpoint.inst.id)) {
                            this.flushRp2040SpiFrame(bus, `cs-deassert:${pinName}`);
                        }
                    }
                }
            }
        }

        const functionSelect = this.cpu?.gpio?.[pin]?.functionSelect ?? 0;
        this.dispatchOptionalProtocols(pinName, isHigh, cycles, functionSelect);
        this.circuitDirty = true;
        this.propagateBoardPin(pinName, isHigh);
        this.observeSoftSerialTx(pinName, isHigh, cycles);
    }

    private attachGPIOListeners() {
        if (!this.cpu) return;

        for (let gp = 0; gp <= 28; gp++) {
            const unsubscribe = this.cpu.gpio[gp].addListener((state: GPIOPinState) => {
                const isHigh = state === GPIOPinState.High || state === GPIOPinState.InputPullUp;
                this.onPinChange(gp, isHigh);
            });
            this.gpioUnsubscribers.push(unsubscribe);
        }
    }

    private updateGPIOInputsFromCircuit() {
        if (!this.cpu) return;

        for (let gp = 0; gp < 29; gp++) {
            const gpPin = `GP${gp}`;
            let observedVoltage = 0;

            const endpoints = this.getProtocolEndpointsForGpPin(gpPin);
            for (const ep of endpoints) {
                observedVoltage = Math.max(observedVoltage, ep.inst.getPinVoltage(ep.pinId));
            }

            if (gpPin === this.softSerialRxPin && this.softSerialRxOverrideActive) {
                this.cpu.gpio[gp].setInputValue(this.softSerialRxLevelHigh);
                continue;
            }

            // Sync Digital State
            this.cpu.gpio[gp].setInputValue(observedVoltage > 1.65);

            // Sync Analog State (only for ADC-capable pins GP26-29)
            if (gp >= 26 && gp <= 29) {
                const adcChannel = gp - 26;
                // rp2040js 0.15.0 RPADC expects raw 12-bit digital values in channelValues
                const digitalValue = Math.floor(Math.max(0, Math.min(3.3, observedVoltage)) / 3.3 * 4095);
                this.cpu.adc.channelValues[adcChannel] = digitalValue;
            }
        }
    }

    private runLoop = () => {
        if (!this.running || !this.cpu) return;

        const loopStart = performance.now();
        const now = performance.now();
        const deltaTime = now - this.lastTime;
        let physicsMs = 0;
        let componentMs = 0;

        if (deltaTime > 0) {
            const { core } = this.cpu;
            const clock = (this.cpu as any).clock;
            const F_CPU = 125_000_000;
            const CYCLE_NANOS = 1e9 / F_CPU;
            const cyclesPerMs = (F_CPU / 1000) * this.speed;
            const cyclesToRun = deltaTime * cyclesPerMs;
            const CYCLES_PER_FRAME = Math.floor(Math.min(cyclesToRun, (F_CPU / 10) * Math.max(1, this.speed)));

            let cyclesDone = 0;

            const physicsInterval = this.speed > 1.0 ? 8 : 12; // ~80-120Hz
            if (this.circuitDirty || (now - this.lastPhysicsSolveAt) >= physicsInterval) {
                const physicsStart = performance.now();
                // Classic Logic mode: event-driven propagation is already handled by listeners.
                this.updateGPIOInputsFromCircuit();
                this.lastPhysicsSolveAt = now;
                this.circuitDirty = false;
                physicsMs = performance.now() - physicsStart;
            }

            try {
                const executeOneInstruction = () => {
                    const before = this.cpu!.core.cycles >>> 0;
                    core.executeInstruction();
                    const after = this.cpu!.core.cycles >>> 0;
                    const delta = (after - before) >>> 0;
                    return delta > 0 ? delta : 1;
                };

                // DETERMINISTIC CYCLE-TARGETED LOOP (Velxio Pattern)
                while (cyclesDone < CYCLES_PER_FRAME && this.running && this.cpu) {
                    const pioDivs = this.getPIOClockDivs();
                    const pio0Div = pioDivs[0];
                    const pio1Div = pioDivs[1];

                    if (core.waiting && clock) {
                        const rawJumpNanos = Number(clock.nanosToNextAlarm);
                        const jumpNanos = Number.isFinite(rawJumpNanos) ? rawJumpNanos : -1;
                        if (jumpNanos <= 0) {
                            // No pending alarm while waiting: execute one instruction so WFE/WFI
                            // paths can still progress without stalling startup indefinitely.
                            const cycles = executeOneInstruction();
                            clock.tick(cycles * CYCLE_NANOS);
                            cyclesDone += cycles;
                            this.debugStepCount += 1;

                            this.pio0Accum += cycles;
                            while (this.pio0Accum >= pio0Div) {
                                this.pio0Accum -= pio0Div;
                                this.stepPIO(0, pio0Div);
                            }
                            this.pio1Accum += cycles;
                            while (this.pio1Accum >= pio1Div) {
                                this.pio1Accum -= pio1Div;
                                this.stepPIO(1, pio1Div);
                            }
                            continue;
                        }

                        // Incremental Jump with PIO Sync
                        const jumpedCycles = Math.ceil(jumpNanos / CYCLE_NANOS);
                        const maxJumpCycles = Math.min(jumpedCycles, CYCLES_PER_FRAME - cyclesDone);
                        
                        // Advance time and sync both PIO units
                        clock.tick(maxJumpCycles * CYCLE_NANOS);
                        
                        this.pio0Accum += maxJumpCycles;
                        while (this.pio0Accum >= pio0Div) {
                            this.pio0Accum -= pio0Div;
                            this.stepPIO(0, pio0Div);
                        }
                        this.pio1Accum += maxJumpCycles;
                        while (this.pio1Accum >= pio1Div) {
                            this.pio1Accum -= pio1Div;
                            this.stepPIO(1, pio1Div);
                        }

                        cyclesDone += maxJumpCycles;
                    } else {
                        const cycles = executeOneInstruction();
                        if (clock) clock.tick(cycles * CYCLE_NANOS);
                        cyclesDone += cycles;
                        this.debugStepCount += 1;

                        // Synchronous PIO stepping
                        this.pio0Accum += cycles;
                        while (this.pio0Accum >= pio0Div) {
                            this.pio0Accum -= pio0Div;
                            this.stepPIO(0, pio0Div);
                        }
                        this.pio1Accum += cycles;
                        while (this.pio1Accum >= pio1Div) {
                            this.pio1Accum -= pio1Div;
                            this.stepPIO(1, pio1Div);
                        }
                    }
                }

                // Sync peripherals and UI once per frame
                this.rebaseProgramCounterAlias(cyclesDone);

                const sampledPc = this.cpu.core.PC >>> 0;
                if (this.shouldFaultForInvalidPc(sampledPc)) {
                    this.faultAndStop('Execution jumped outside valid memory', sampledPc);
                    return;
                }

                // Process budgets and monitor sync
                if (this.softSerialDecodeState.receiving || this.softSerialRxFrame || this.softSerialRxQueue.length > 0) {
                    const currentTotalCycles = Number(this.cpu.core.cycles);
                    this.advanceSoftSerialIngress(currentTotalCycles);
                    this.processSoftSerialDecode(currentTotalCycles);
                }

                const frameTimeMs = 16.6; 
                const bytesPerMs = this.serialBaudRate / 10000;
                this.serialByteBudget += frameTimeMs * bytesPerMs; 

                const uart0 = this.cpu.uart[0];
                const uart1 = this.cpu.uart[1];
                if (this.serialBuffer.length > 0 && this.serialByteBudget >= 1) {
                    const maxBytes = Math.floor(this.serialByteBudget);
                    let sent = 0;
                    for (let i = 0; i < maxBytes && this.serialBuffer.length > 0; i++) {
                        const packet = this.serialBuffer[0]!;
                        let delivered = false;
                        if (packet.source === 2) {
                            if (this.usbCdc && this.usbCdcReady) {
                                try {
                                    const usbTxFifo: any = (this.usbCdc as any).txFIFO;
                                    const fifoFull = !!(usbTxFifo && (usbTxFifo.full || usbTxFifo.itemCount >= usbTxFifo.size));
                                    if (fifoFull) {
                                        delivered = false;
                                    } else {
                                        this.usbCdc.sendSerialByte(packet.value & 0xff);
                                        delivered = true;
                                    }
                                } catch (e) {
                                    delivered = false;
                                }
                            }
                        } else {
                            delivered = ((packet.source === 1 ? uart1 : uart0) || uart0).feedByte(packet.value & 0xff);
                        }
                        if (!delivered) break;
                        this.serialBuffer.shift();
                        sent += 1;
                    }
                    this.serialByteBudget -= sent;
                }

                const clockScale = 16_000_000 / this.getRp2040ClockHz();
                const normalizedUpdateCycles = Math.floor(Number(this.cpu!.core.cycles) * clockScale);
                const componentStart = performance.now();
                const instArray = Array.from(this.instances.values());
                instArray.forEach((inst) => {
                    // Annotate component with junction-aware connectivity (since RP2040Runner doesn't use pinToNet, 
                    // we'll rely on the fact that isWired is usually true if we reached this point, 
                    // but for consistency we can set it if there's any wire on any pin).
                    if (inst.state.isWired === undefined) {
                        inst.state.isWired = Object.keys(inst.pins).some(p => 
                            this.currentWires.some(w => w.from === `${inst.id}:${p}` || w.to === `${inst.id}:${p}`)
                        );
                    }
                    // For RP2040, we'll let the component's internal logic handle resistor detection 
                    // for now, or we could implement a netlist here too. 
                    // But since the user is on Uno, let's focus on AVRRunner first.
                    inst.update(normalizedUpdateCycles, this.currentWires, instArray);
                });
                componentMs = performance.now() - componentStart;

            } catch (err: any) {
                const baseMessage = String(err?.message || err || 'RP2040 execution error');
                const shortStack = typeof err?.stack === 'string'
                    ? err.stack.split('\n').slice(0, 4).map((line: string) => line.trim()).join(' | ')
                    : '';
                const message = shortStack ? `${baseMessage} :: ${shortStack}` : baseMessage;
                this.faultAndStop(message, this.cpu.core.PC >>> 0);
                return;
            }

            this.lastPhysicsMs = physicsMs;
            this.lastComponentUpdateMs = componentMs;
            this.lastRunLoopMs = performance.now() - loopStart;
            this.lastTime = now;
        }

        if (this.running) {
            this.emitDebugSnapshot('tick', now);
            setTimeout(this.runLoop, 1);
        }
    };

    /**
     * Step PIO state machines synchronously.
     * Replaces the redundant internal PIO timers that cause event-loop congestion.
     */
    /**
     * Step a PIO state machine block synchronously.
     * Implements edge detection to ensure pin changes are propagated to components.
     */
    private stepPIO(index: 0 | 1, stepCycles = 1): void {
        if (!this.cpu) return;
        const pio = (this.cpu as any).pio;
        if (!pio || !pio[index]) return;

        const cycleStep = Number.isFinite(Number(stepCycles)) && Number(stepCycles) > 0
            ? Number(stepCycles)
            : 1;
        const baseCycles = Number(this.cpu.core.cycles ?? 0);
        if (baseCycles > this.pioSignalCycle) {
            this.pioSignalCycle = baseCycles;
        }
        this.pioSignalCycle += cycleStep;
        const edgeCycle = this.pioSignalCycle;

        // Capture pin state before stepping
        const oldPins = pio[index].pins >>> 0;
        pio[index].step();

        // Detect and propagate changes for GPIO 0-29
        const newPins = pio[index].pins >>> 0;
        if (oldPins !== newPins) {
            const changed = (oldPins ^ newPins) >>> 0;
            for (let i = 0; i < 30; i++) {
                if (changed & (1 << i)) {
                    this.onPinChange(i, !!(newPins & (1 << i)), edgeCycle);
                }
            }
        }
    }

    serialRx(data: string) {
        const source = (this.usbCdc && this.usbCdcReady)
            ? 2
            : (this.activeUartIndex === 1 ? 1 : 0);
        for (let i = 0; i < data.length; i++) {
            this.serialBuffer.push({ value: data.charCodeAt(i) & 0xff, source });
            this.debugSerialRxBytes += 1;
        }
        this.pulseBoardUartLed(source === 1 ? 'GP5' : 'GP1');
    }

    serialRxByte(value: number) {
        this.serialRxByteFromSource(value, this.activeUartIndex === 1 ? 'uart1' : 'uart0');
    }

    softSerialRxByte(value: number) {
        this.softSerialRxQueue.push(value & 0xff);
        this.softSerialRxOverrideActive = true;
        this.debugSerialRxBytes += 1;
        this.pulseBoardUartLed('GP1');
    }

    serialRxByteFromSource(value: number, sourceLabel = 'uart0') {
        const s = String(sourceLabel || 'uart0').toLowerCase();
        if (isSoftSerialSourceLabel(s)) {
            this.softSerialRxByte(value);
            return;
        }
        const source = s === 'uart1' || s === 'serial1' || s === '1'
            ? 1
            : s === 'usb' || s === 'cdc' || s === 'serialusb'
                ? 2
                : 0;
        this.activeUartIndex = source;
        this.serialBuffer.push({ value: value & 0xff, source });
        this.debugSerialRxBytes += 1;
        this.pulseBoardUartLed(source === 1 ? 'GP5' : 'GP1');
    }

    setSerialBaudRate(baud: number) {
        const parsed = Number(baud);
        if (!Number.isFinite(parsed)) return;
        const clamped = Math.max(300, Math.min(3000000, Math.floor(parsed)));
        this.serialBaudRate = clamped;
    }

    getSerialBaudRate(): number {
        return this.serialBaudRate;
    }

    setSpeed(speed: number) {
        const s = Number(speed);
        if (Number.isFinite(s) && s > 0) {
            this.speed = s;
        }
    }

    setSolverMode(mode: 'logic') {
        this.solverMode = mode;
        for (const key of Object.keys(this.pinStates)) {
            this.pinStates[key] = false;
        }
        for (const inst of this.instances.values()) {
            for (const pinId of Object.keys(inst.pins || {})) {
                inst.setPinVoltage(pinId, 0);
            }
        }
        this.pinsChanged = true;
        this.circuitDirty = true;
        this.topologyDirty = true;
    }

    reset() {
        if (!this.cpu) return;
        this.clearPendingUartLedTimers();
        this.cpu.reset();
        this.cpu.loadBootrom(bootromB1);
        this.bootromLoaded = true;
        this.entryInfo = loadRP2040Firmware(this.cpu, this.firmwareHex, {
            logicalFlashBytes: this.getLogicalFlashLength(),
            partitions: this.flashPartitions,
        });
        this.cpuCyclesAtStart = this.cpu.core.cycles;
        this.pio0Accum = 0;
        this.pio1Accum = 0;
        this.pioSignalCycle = this.cpu.core.cycles;
        this.serialBuffer = [];
        this.serialByteBudget = 0;
        this.activeUartIndex = 0;

        // Reset I2C/SPI/UART/USB peripherals
        this.softSerialRxQueue = [];
        this.softSerialRxFrame = null;
        this.softSerialRxOverrideActive = false;
        this.softSerialNextInjectCycle = 0;
        this.softSerialDecodeState = {
            receiving: false,
            sampleCycle: 0,
            sampleIndex: 0,
            currentByte: 0,
            lastLevel: true,
        };
        this.usbCdc = null;
        this.usbCdcReady = false;
        this.debugLastEmitAt = 0;
        this.debugStepCount = 0;
        this.debugSerialTxBytes = 0;
        this.debugSerialRxBytes = 0;
        this.debugGpioTransitions = 0;
        this.debugLastGpioPin = '';
        this.debugPcStallTicks = 0;
        this.debugLastPc = this.cpu.core.PC >>> 0;
        this.lowPcAliasCandidate = -1;
        this.lowPcAliasRepeatCount = 0;
        this.invalidPcStrikeCount = 0;
        this.pinsChanged = true;
        this.hasFaulted = false;
        this.protocolEndpointsCache.clear();
        this.i2cDeviceCache.clear();
        this.spiDeviceCache.clear();
        this.peripheralDeviceCacheReady = false;
        this.pwmState.clear();
        this.i2sState.clear();
        this.oneWireState.clear();
        this.componentSyncMeta.clear();
        this.setSoftSerialRxLevel(true);
        this.attachUART();
        this.attachUSBSerial();
        this.rebuildPeripheralDeviceCache();
        this.installRp2040I2cAdapters();
        this.installRp2040SpiAdapters();
    }

    private emitStateIfDue(nowMs?: number) {
        if (!this.cpu) return;
        const now = nowMs || performance.now();
        const currentCycles = Number(this.cpu.core.cycles);
        const cycleDelta = currentCycles - this.lastStateEmitCycle;
        const timeDelta = now - this.lastStateEmitTime;

        // RP2040 runs at 125MHz. 125,000,000 / 60 ~= 2,083,333 cycles per frame.
        if (cycleDelta >= 2083333 || timeDelta >= 16) {
            const msg: any = { type: 'state', boardId: this.boardId };
            msg.pins = this.pinStates;
            this.pinsChanged = false;
            
            const now = performance.now();
            this.emitWirelessStubStatus('tick');

            const compStates: Array<{ id: string; state: any }> = [];
            for (const inst of this.instances.values()) {
                if (!inst.stateChanged && !inst.telemetryEnabled) continue;
                const syncState = getUnifiedComponentSyncState(inst);
                
                if (!this.shouldEmitComponentState(inst.id, syncState, now)) continue;

                inst.stateChanged = false;
                compStates.push({
                    id: inst.id,
                    type: inst.type,
                    state: syncState,
                    ...collectComponentTelemetry(inst, undefined, this.cpu),
                });
            }
            msg.components = compStates;

            this.statusIntervalEmitCount++;
            msg._emitSeq = this.statusIntervalEmitCount;
            msg._emitTime = now;
            msg.simTimeMs = this.getSimulatedTimeMs();
            
            this.lastStateEmitCycle = currentCycles;
            this.lastStateEmitTime = now;
            this.onStateUpdate(msg);
        }
    }

    forceEmitState() {
        if (!this.cpu) return;
        const now = performance.now();
        const currentCycles = Number(this.cpu.core.cycles);
        const msg: any = { type: 'state', boardId: this.boardId };
        msg.pins = this.pinStates;
        this.pinsChanged = false;
        
        const compStates: Array<{ id: string; state: any }> = [];
        for (const inst of this.instances.values()) {
            const pendingEmit = (inst as any).pendingVisualStateEmit;
            if (!inst.stateChanged && !pendingEmit && !inst.telemetryEnabled) continue;

            const syncState = getUnifiedComponentSyncState(inst);
            
            if (!this.shouldEmitComponentState(inst.id, syncState, now)) continue;

            inst.stateChanged = false;
            (inst as any).pendingVisualStateEmit = false;
            
            compStates.push({
                id: inst.id,
                type: inst.type,
                state: syncState,
                ...collectComponentTelemetry(inst, undefined, this.cpu),
            });
        }
        msg.components = compStates;

        this.statusIntervalEmitCount++;
        msg._emitSeq = this.statusIntervalEmitCount;
        msg._emitTime = now;
        msg.simTimeMs = this.getSimulatedTimeMs();
        
        this.lastStateEmitCycle = currentCycles;
        this.lastStateEmitTime = now;
        this.onStateUpdate(msg);
    }

    private initPhysicsWorker() {}

    private requestPhysicsSolve() {}

    private updateTopologyForWorker() {}

    /**
     * Get the current clock divider for the PIO state machines.
     * Aligned with Velxio: uses the first enabled state machine's divider or defaults to 64.
     */
    /**
     * Get the current clock dividers for PIO blocks 0 and 1.
     * Uses the smallest divider of any enabled state machine in each block,
     * including fractional bits.
     */
    private getPIOClockDivs(): number[] {
        if (!this.cpu) return [64, 64];
        const pioInstances = (this.cpu as any).pio || [];
        const divs = [64, 64];
        for (let i = 0; i < 2; i++) {
            const p = pioInstances[i];
            if (!p || p.stopped) continue;
            let minDiv = Infinity;
            for (const m of p.machines) {
                if (m.enabled) {
                    // Extract fractional clkdiv (int + frac/256)
                    const d = Math.max(1, Number(m.clkdiv || 1));
                    if (d < minDiv) minDiv = d;
                }
            }
            divs[i] = minDiv === Infinity ? 64 : minDiv;
        }
        return divs;
    }

    stop() {
        const neopixelStates = collectNeopixelShutdownStates(this.instances);
        if (neopixelStates.length > 0) {
            this.onStateUpdate({ type: 'state', boardId: this.boardId, components: neopixelStates });
        }
        this.running = false;
        this.clearPendingUartLedTimers();
        this.gdbStatus = 'closed';
        this.emitGdbStatus('stopped', 'Runner stopped');
        if (this.gdbWs) {
            try { this.gdbWs.close(); } catch (e) {}
            this.gdbWs = null;
        }
        clearInterval(this.statusInterval);
        this.gpioUnsubscribers.forEach((dispose) => {
            try {
                dispose();
            } catch (e) {
                // no-op
            }
        });
        this.gpioUnsubscribers = [];
    }
}

