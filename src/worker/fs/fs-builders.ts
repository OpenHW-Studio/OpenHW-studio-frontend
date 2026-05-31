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
export const SD_BLOCK_SIZE = 512;
export const SD_DATA_TOKEN = 0xfe;

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
            if (littlefsModule && typeof littlefsModule.quit === 'function') {
                littlefsModule.quit();
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
