import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const ESPTOOL_PATH = process.env.ESPTOOL_PATH || 'esptool.py';

// Define the simulator lib paths
const SIMULATOR_LIBS_DIR = path.resolve(__dirname, './utils');
const SIMULATOR_BRIDGE_H       = path.join(SIMULATOR_LIBS_DIR, 'SimulatorBridge.h');
const SIM_WIFI_H               = path.join(SIMULATOR_LIBS_DIR, 'SimulatorWiFi.h');
const SIM_WIFI_CLIENT_H        = path.join(SIMULATOR_LIBS_DIR, 'SimulatorWiFiClient.h');
const SIM_WIFI_CLIENT_SECURE_H = path.join(SIMULATOR_LIBS_DIR, 'SimulatorWiFiClientSecure.h');
const SIM_WIFI_SERVER_H        = path.join(SIMULATOR_LIBS_DIR, 'SimulatorWiFiServer.h');

const INJECTED_LINE_COUNT = 2;

export function shiftLineNumbers(output, sketchFile) {
    if (!output) return output;
    const escapedPath = sketchFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lineRef = new RegExp(`(${escapedPath}):(\\d+)(:\\d+:.*)`, 'g');
    return output.replace(lineRef, (_, file, lineStr, rest) => {
        const shifted = Math.max(1, parseInt(lineStr, 10) - INJECTED_LINE_COUNT);
        return `${file}:${shifted}${rest}`;
    });
}

export function requireEsptool() {
    try {
        execFileSync(ESPTOOL_PATH, ['version'], { stdio: 'pipe' });
        return ESPTOOL_PATH;
    } catch {
        throw new Error(
            `esptool.py not found (tried: "${ESPTOOL_PATH}").\n` +
            `Install it with:  pip install esptool\n` +
            `Or set the ESPTOOL_PATH environment variable to its full path.`
        );
    }
}

export function mergeFlashImage(buildDir, sketchBase, esptoolPath) {
    const bootloader   = path.join(buildDir, `${sketchBase}.bootloader.bin`);
    const partTable    = path.join(buildDir, `${sketchBase}.partitions.bin`);
    const appBin       = path.join(buildDir, `${sketchBase}.bin`);
    const mergedOut    = path.join(buildDir, 'merged-flash.bin');

    for (const [label, p] of [['bootloader', bootloader], ['partition table', partTable], ['app binary', appBin]]) {
        if (!fs.existsSync(p)) {
            throw new Error(
                `Merge failed: ${label} not found at ${p}.\n` +
                `Make sure esp32 board core is installed: arduino-cli core install esp32:esp32`
            );
        }
    }

    const args = [
        '--chip', 'esp32',
        'merge_bin',
        '--output', mergedOut,
        '--fill-flash-size', '4MB',
        '--flash_mode', 'dio',
        '--flash_size', '4MB',
        '--flash_freq', '40m',
        '0x1000',  bootloader,
        '0x8000',  partTable,
        '0x10000', appBin,
    ];

    execFileSync(esptoolPath, args, { stdio: 'pipe' });

    if (!fs.existsSync(mergedOut)) {
        throw new Error('esptool.py merge_bin produced no output file.');
    }

    return mergedOut;
}

export function injectHeaders(sketchDir, sketchFile, code, buildId) {
    const finalCode = `#include "SimulatorBridge.h"\n\n${code}`;
    fs.writeFileSync(sketchFile, finalCode);

    const headers = [
        { src: SIMULATOR_BRIDGE_H,       dst: 'SimulatorBridge.h' },
        { src: SIM_WIFI_H,               dst: 'WiFi.h' },
        { src: SIM_WIFI_CLIENT_H,        dst: 'WiFiClient.h' },
        { src: SIM_WIFI_CLIENT_SECURE_H, dst: 'WiFiClientSecure.h' },
        { src: SIM_WIFI_SERVER_H,        dst: 'WiFiServer.h' }
    ];

    for (const { src, dst } of headers) {
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(sketchDir, dst));
        } else {
            console.warn(`[${buildId}] ⚠️ Header not found at ${src}`);
        }
    }
}
