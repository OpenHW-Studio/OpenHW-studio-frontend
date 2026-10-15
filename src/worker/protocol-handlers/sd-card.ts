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

        // Default 32 MB: FAT16 needs >= 4085 data clusters and Arduino's
        // bundled SD library mounts FAT16/FAT32 only — smaller images
        // format best-effort but cannot mount there.
        const capacityKbRaw = Number(manifest?.attrs?.capacityKB ?? 32768);
        const capacityKB = Number.isFinite(capacityKbRaw) && capacityKbRaw > 64
            ? Math.floor(capacityKbRaw)
            : 2048;

        this.blockCount = Math.max(64, Math.floor((capacityKB * 1024) / this.blockSize));
        this.storage = new Uint8Array(this.blockCount * this.blockSize);
        this.storage.fill(0xff);
        this.mounted = String(manifest?.attrs?.mounted ?? 'true') !== 'false';
        // FAT16 volume so real stacks (Arduino SD.h) mount, create, write
        // and read files. Fixed geometry derived from blockCount; README
        // content lands in data cluster 2 (mirrors the shadow file below).
        // NOTE: this file is a fork of the emulator's protocol-handlers/
        // sd-card.ts (worker bundling); keep the two in sync.
        this.formatFat16();

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

    /**
     * Minimal FAT16 formatter (MBR + PBR + 2 FATs + root + README data).
     * Genuine FAT16 (NOT FAT12): Arduino's bundled SD library mounts
     * FAT16/FAT32 only, and FAT16 needs >= 4085 data clusters — images too
     * small for that keep a best-effort layout but won't mount there.
     * Sectors/cluster adapts (1..64) to land in range.
     * Geometry: reserved 1, 2 FATs, 512 root entries, 8 sectors/cluster.
     * Pure arithmetic over this.storage — no I/O, no dependencies. Lets
     * genuine FAT stacks mount the virtual card and do file I/O through
     * CMD17/CMD24 against the same blocks. Keep in sync with the
     * emulator's protocol-handlers/sd-card.ts twin.
     */
    private formatFat16(): void {
        const S = this.blockSize;
        const total = this.blockCount;
        if (total < 64) return;
        const set16 = (off: number, v: number) => {
            this.storage[off] = v & 0xff;
            this.storage[off + 1] = (v >> 8) & 0xff;
        };
        const set32 = (off: number, v: number) => {
            set16(off, v & 0xffff);
            set16(off + 2, Math.floor(v / 65536) & 0xffff);
        };
        // MBR (LBA 0): one FAT16 partition spanning LBA 1..total-1.
        // Boot indicator MUST be 0x00/0x80: Arduino rejects entries with
        // any other low 7 bits as "not a valid partition".
        const part = 446;
        this.storage[part] = 0x00;
        this.storage[part + 4] = 0x06;
        set32(part + 8, 1);
        set32(part + 12, total - 1);
        this.storage[510] = 0x55;
        this.storage[511] = 0xaa;
        // PBR (LBA 1).
        const pbr = S;
        this.storage[pbr] = 0xeb;
        this.storage[pbr + 1] = 0x3c;
        this.storage[pbr + 2] = 0x90;
        const oem = 'MSDOS5.0';
        for (let i = 0; i < 8; i += 1) this.storage[pbr + 3 + i] = oem.charCodeAt(i);
        set16(pbr + 11, S);
        // Sectors/cluster adapts so data clusters land in FAT16 range.
        const rootSectors = 32;
        let spc = 8;
        let fatSectors = 2;
        for (const cand of [1, 2, 4, 8, 16, 32, 64]) {
            const fat = Math.max(1, Math.ceil((((total - 1 - rootSectors) / cand) * 2) / S));
            const clusters = Math.floor((total - 1 - rootSectors - 2 * fat) / cand);
            if (clusters >= 4085 && clusters <= 65525) {
                spc = cand;
                fatSectors = fat;
                break;
            }
        }
        this.storage[pbr + 13] = spc; // sectors per cluster
        set16(pbr + 14, 1); // reserved sectors
        this.storage[pbr + 16] = 2; // FAT count
        set16(pbr + 17, 512); // root entries
        set16(pbr + 19, total - 1); // total16
        this.storage[pbr + 21] = 0xf8; // media
        set16(pbr + 22, fatSectors);
        set16(pbr + 24, 32); // sectors per track
        set16(pbr + 26, 64); // heads
        set32(pbr + 28, 1); // hidden (PBR LBA)
        this.storage[pbr + 510] = 0x55;
        this.storage[pbr + 511] = 0xaa;
        const fatBase = (1 + 1) * S;
        // FAT copies: media + EOF markers, README at cluster 2 (EOF).
        // All other entries MUST be zero (free): the region starts life as
        // 0xFF (flash-erased), which FAT reads as 0xFFFF = used/EOF, so
        // cluster allocation finds no free space and every file write
        // returns 0 bytes — exactly the live WROTE:0 seen before this.
        for (let copy = 0; copy < 2; copy += 1) {
            const base = fatBase + copy * fatSectors * S;
            for (let i = 0; i < fatSectors * S; i += 1) this.storage[base + i] = 0x00;
            this.storage[base] = 0xf8;
            this.storage[base + 1] = 0xff;
            this.storage[base + 2] = 0xff;
            this.storage[base + 3] = 0xff;
            this.storage[base + 4] = 0xff;
            this.storage[base + 5] = 0xff;
        }
        // Root directory: README.TXT, cluster 2. The region MUST be
        // zero-filled first: free directory entries are 0x00 and deleted
        // ones 0xE5 — leftover 0xFF bytes look used, so creation scans all
        // 512 entries, finds no free slot, and fails with "no space".
        const readme = this.textEncoder.encode('OpenHW virtual SD card\n');
        const rootBase = (1 + 1 + 2 * fatSectors) * S;
        for (let i = 0; i < rootSectors * S; i += 1) this.storage[rootBase + i] = 0x00;
        const name = 'README  TXT';
        for (let i = 0; i < 11; i += 1) this.storage[rootBase + i] = name.charCodeAt(i);
        this.storage[rootBase + 11] = 0x20; // archive
        set16(rootBase + 26, 2); // first cluster
        set32(rootBase + 28, readme.length);
        // Data cluster 2.
        const dataBase = (1 + 1 + 2 * fatSectors + rootSectors) * S;
        this.storage.set(readme, dataBase);
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
        // R1 for the command itself: 0x00 (accepted). The DATA_ACCEPTED
        // token (0x05) is queued separately by completeWriteBlock after
        // the payload lands — queueing it here would let the 512 payload
        // clocks eat it (Arduino checks (status & 0x1F) === 0x05 on the
        // post-payload read).
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
            // OCR: power-up complete (bit31) + CCS/SDHC (bit30) + 2.7–3.6V
            // window. A ready card MUST report power-up complete — stacks
            // reject OCRs with bit31 clear even after ACMD41 went ready.
            this.queueResponse([0x00, 0xc0, 0xff, 0x80, 0x00]);
            return;
        }

        if (command === 13) {
            // SEND_STATUS (R2 = R1 + status). Arduino's blocking
            // writeBlock() requires cardCommand(CMD13, 0) === 0 AND the
            // following status byte === 0; anything else aborts the write
            // with SD_CARD_ERROR_WRITE_PROGRAMMING, so every cache flush
            // (dir entries, FAT, file data) silently failed before this.
            this.queueResponse([0x00, 0x00]);
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

        if (this.writeState) {
            this.handleWriteByte(byte);
            // If this byte completed the block, its data response belongs
            // to the FOLLOWING clocks (real cards idle during CRC) — do
            // not emit the just-queued token on the completing clock.
            if (!this.writeState) return 0xff;
            return this.emitResponseByte();
        }

        // Command-frame assembly consumes clocks silently (MISO idle-high):
        // a 0x40-masked start byte opens a frame and supersedes any unread
        // stale tail (hardware drops it too). Reads (0xFF clocks) and the
        // 0x9F legacy probe fall through to the queue below. Checking the
        // queue FIRST here would spend stale responses on command clocks
        // and shift every subsequent read by one.
        if ((byte & 0xc0) === 0x40 || this.commandFrame.length > 0) {
            if (this.commandFrame.length === 0) this.responseQueue.length = 0;
            this.commandFrame.push(byte);
            if (this.commandFrame.length >= 6) {
                const frame = this.commandFrame.slice(0, 6);
                this.commandFrame = [];
                this.handleCommandFrame(frame);
            }
            return 0xff;
        }
        if (byte === 0x9f) {
            // Legacy SPI probe compatibility.
            this.queueResponse([0x53, 0x44, 0x30]);
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
