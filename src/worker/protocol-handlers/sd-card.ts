import { BaseComponent, SPIProtocol } from '@openhw/emulator';
import { SD_BLOCK_SIZE, SD_DATA_TOKEN } from '../fs/fs-builders.ts';

// Re-define LittleFsVolume interface
type LittleFsVolume = {
    mount: () => number;
    unmount: () => number;
    format: () => number;
    formatAndMount: () => number;
    mkdir: (path: string) => boolean;
    writeFile: (path: string, data: Uint8Array) => boolean;
    destroy: () => void;
};

const LITTLEFS_MODULE_NAME = 'littlefs';

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

export class SDCardLogic extends SPIProtocol {
    private powered = false;
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
            ...this.state,
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
            this.state.fsReady = this.littleFsReady;
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

    onCSAssert() {
        this.commandFrame = [];
        this.writeState = null;
    }

    onPinStateChange(pinId: string, isHigh: boolean, cycles: number) {
        super.onPinStateChange(pinId, isHigh, cycles);

        const pin = String(pinId || '').toUpperCase();

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

    onSPIByteExchange(value: number, index: number) {
        this.refreshPowerState();

        if (!this.mounted || !this.powered || !this.state.csActive) {
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
