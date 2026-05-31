/**
 * Esp32MicroPythonLoader — Downloads and caches MicroPython firmware for ESP32 boards
 *
 * Supports ESP32 (Xtensa LX6), ESP32-S3 (Xtensa LX7), and ESP32-C3 (RISC-V).
 * Firmware is cached in browser IndexedDB for fast subsequent loads.
 */

const DB_NAME = 'esp32-firmware-db';
const STORE_NAME = 'firmwares';

function getCachedFirmware(key) {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(STORE_NAME);
            };
            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const getReq = store.get(key);
                getReq.onsuccess = () => resolve(getReq.result);
                getReq.onerror = () => resolve(null);
            };
            request.onerror = () => resolve(null);
        } catch (err) {
            resolve(null);
        }
    });
}

function setCachedFirmware(key, val) {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(STORE_NAME);
            };
            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put(val, key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            };
            request.onerror = () => resolve(false);
        } catch (err) {
            resolve(false);
        }
    });
}

const FIRMWARE_MAP = {
    esp32: {
        remote: 'https://micropython.org/resources/firmware/ESP32_GENERIC-20230426-v1.20.0.bin',
        cacheKey: 'micropython-esp32-v1.20.0',
        fallback: '/firmware/micropython-esp32.bin',
    },
    'esp32-s3': {
        remote: 'https://micropython.org/resources/firmware/ESP32_GENERIC_S3-20230426-v1.20.0.bin',
        cacheKey: 'micropython-esp32s3-v1.20.0',
        fallback: '/firmware/micropython-esp32s3.bin',
    },
    'esp32-c3': {
        remote: 'https://micropython.org/resources/firmware/ESP32_GENERIC_C3-20230426-v1.20.0.bin',
        cacheKey: 'micropython-esp32c3-v1.20.0',
        fallback: '/firmware/micropython-esp32c3.bin',
    },
};

/** Map any ESP32-family board kind to firmware variant key */
function toFirmwareVariant(boardKind) {
    const s = String(boardKind || '').toLowerCase();
    if (s.includes('s3')) return 'esp32-s3';
    if (s.includes('c3')) return 'esp32-c3';
    return 'esp32';
}

/**
 * Get MicroPython firmware binary for an ESP32 board.
 * Checks IndexedDB cache first, then remote, then bundled fallback.
 */
export async function getEsp32Firmware(boardKind, onProgress) {
    const variant = toFirmwareVariant(boardKind);
    const config = FIRMWARE_MAP[variant];
    if (!config) throw new Error(`No MicroPython firmware for board: ${boardKind}`);

    // 1. Check IndexedDB cache
    try {
        const cached = await getCachedFirmware(config.cacheKey);
        if (cached instanceof Uint8Array && cached.length > 0) {
            console.log(`[ESP32-MicroPython] Firmware loaded from cache (${variant})`);
            return cached;
        }
    } catch (err) {
        console.warn('[ESP32-MicroPython] IndexedDB read error:', err);
    }

    // 2. Try remote download
    try {
        const response = await fetch(config.remote);
        if (response.ok) {
            const total = Number(response.headers.get('content-length') || 0);
            const reader = response.body?.getReader();

            if (reader) {
                const chunks = [];
                let loaded = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    loaded += value.length;
                    onProgress?.(loaded, total);
                }

                const firmware = new Uint8Array(loaded);
                let offset = 0;
                for (const chunk of chunks) {
                    firmware.set(chunk, offset);
                    offset += chunk.length;
                }

                try {
                    await setCachedFirmware(config.cacheKey, firmware);
                } catch {
                    /* non-fatal */
                }

                console.log(`[ESP32-MicroPython] Firmware downloaded (${variant}, ${firmware.length} bytes)`);
                return firmware;
            }
        }
    } catch (err) {
        console.warn(`[ESP32-MicroPython] Remote download failed for ${variant}, trying bundled fallback`);
    }

    // 3. Fallback to bundled firmware
    const response = await fetch(config.fallback);
    if (!response.ok) {
        throw new Error(`MicroPython firmware not available for ${variant} (remote and bundled both failed)`);
    }
    const buffer = await response.arrayBuffer();
    const firmware = new Uint8Array(buffer);

    try {
        await setCachedFirmware(config.cacheKey, firmware);
    } catch {
        /* non-fatal */
    }

    console.log(`[ESP32-MicroPython] Firmware loaded from bundled fallback (${variant}, ${firmware.length} bytes)`);
    return firmware;
}

/**
 * Build a QEMU-compatible flash image from a MicroPython firmware binary.
 *
 * Flash layout rules:
 *   ESP32 (LX6)  — firmware starts at 0x1000
 *   ESP32-S3     — combined image starts at 0x0
 *   ESP32-C3     — combined image starts at 0x0
 *
 * The returned image is padded with 0xFF to the nearest valid QEMU flash size
 * (2, 4, 8, or 16 MB).
 */
export function padToFlashSize(firmware, boardKind) {
    const variant = toFirmwareVariant(boardKind);
    const flashOffset = variant === 'esp32' ? 0x1000 : 0x0;

    const MIN_BYTES = 4 * 1024 * 1024;
    const VALID_BYTES = [2, 4, 8, 16].map((mb) => mb * 1024 * 1024);
    const target = VALID_BYTES.find(
        (size) => size >= Math.max(firmware.length + flashOffset, MIN_BYTES),
    );
    if (!target) {
        throw new Error(`MicroPython firmware too large for QEMU: ${firmware.length} bytes (max 16 MB)`);
    }
    const padded = new Uint8Array(target).fill(0xff);
    padded.set(firmware, flashOffset);
    return padded;
}

/** Convert Uint8Array to base64 string */
export function uint8ArrayToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
