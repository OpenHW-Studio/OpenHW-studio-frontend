import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { execFile, execFileSync } from 'child_process';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import wsManager from '../utils/websocketManager.js';
import QemuRunner from '../utils/qemuRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Paths ─────────────────────────────────────────────────────────────────────
const ARDUINO_CLI_PATH   = 'arduino-cli';
const ESPTOOL_PATH       = process.env.ESPTOOL_PATH || 'esptool.py';
const TEMP_DIR           = path.resolve(__dirname, '../../temp');
const BUILDS_DIR         = path.resolve(__dirname, '../../builds');
const SIMULATOR_BRIDGE_H       = path.resolve(__dirname, '../utils/SimulatorBridge.h');
const SIM_WIFI_H               = path.resolve(__dirname, '../utils/SimulatorWiFi.h');
const SIM_WIFI_CLIENT_H        = path.resolve(__dirname, '../utils/SimulatorWiFiClient.h');
const SIM_WIFI_CLIENT_SECURE_H = path.resolve(__dirname, '../utils/SimulatorWiFiClientSecure.h');
const SIM_WIFI_SERVER_H        = path.resolve(__dirname, '../utils/SimulatorWiFiServer.h');

// ─── Limits ────────────────────────────────────────────────────────────────────
const MAX_SESSIONS       = parseInt(process.env.MAX_SESSIONS  || '10', 10);
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || String(5 * 60 * 1000), 10);

// ─── Number of lines injected before user code ─────────────────────────────────
// '#include "SimulatorBridge.h"\n\n' = 2 lines
const INJECTED_LINE_COUNT = 2;

// ─── Active runners ────────────────────────────────────────────────────────────
// Map<buildId, QemuRunner>
const activeRunners = new Map();

// ─── Session timeout GC ────────────────────────────────────────────────────────
const gcInterval = setInterval(() => {
    const now = Date.now();
    for (const [buildId, runner] of activeRunners.entries()) {
        if (now - runner.lastActivity > SESSION_TIMEOUT_MS) {
            console.log(`⏱️  Session ${buildId} timed out — killing QEMU`);
            runner.kill();
            _cleanup(buildId);
        }
    }
}, 60_000);
gcInterval.unref();

// ─── Helpers ───────────────────────────────────────────────────────────────────

function _cleanup(buildId) {
    activeRunners.delete(buildId);
    const buildFolder = path.join(BUILDS_DIR, buildId);
    try {
        if (fs.existsSync(buildFolder)) {
            fs.rmSync(buildFolder, { recursive: true, force: true });
        }
    } catch (e) {
        console.error(`Failed to delete build folder ${buildFolder}:`, e);
    }
}

/**
 * Shifts compiler error line numbers back by INJECTED_LINE_COUNT so reported
 * lines correspond to the user's original code, not the injected file.
 *
 * arduino-cli emits errors like:
 *   /path/to/sketch.ino:5:3: error: ...
 *
 * After injecting 2 lines, line 5 in the compiled file is actually line 3 in
 * the user's code. We subtract INJECTED_LINE_COUNT from every such reference.
 */
function _shiftLineNumbers(output, sketchFile) {
    if (!output) return output;
    const escapedPath = sketchFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lineRef = new RegExp(`(${escapedPath}):(\\d+)(:\\d+:.*)`, 'g');
    return output.replace(lineRef, (_, file, lineStr, rest) => {
        const shifted = Math.max(1, parseInt(lineStr, 10) - INJECTED_LINE_COUNT);
        return `${file}:${shifted}${rest}`;
    });
}

/**
 * Checks that esptool.py is callable and returns its resolved path.
 * Throws a descriptive error if not found.
 */
function _requireEsptool() {
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

/**
 * Merges bootloader, partition table, and application binary into a single
 * flat flash image that QEMU's -drive accepts for the ESP32 machine.
 *
 * Default offsets for ESP32 with the IDF/Arduino bootloader:
 *   0x1000  — second-stage bootloader
 *   0x8000  — partition table
 *   0x10000 — application binary
 *
 * Returns the path to the merged .bin file.
 */
function _mergeFlashImage(buildDir, sketchBase, esptoolPath) {
    // arduino-cli produces these files in --output-dir
    const bootloader   = path.join(buildDir, `${sketchBase}.bootloader.bin`);
    const partTable    = path.join(buildDir, `${sketchBase}.partitions.bin`);
    const appBin       = path.join(buildDir, `${sketchBase}.bin`);
    const mergedOut    = path.join(buildDir, 'merged-flash.bin');

    // Validate all three inputs exist
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

// ─── WebSocket message handler (per connection) ────────────────────────────────
wsManager.onClientConnection((ws) => {
    ws.on('message', (msg) => {
        let data;
        try { data = JSON.parse(msg.toString()); } catch { return; }

        // ── REGISTER_SESSION ──────────────────────────────────────────────────────
        if (data.type === 'REGISTER_SESSION' && data.buildId) {
            const isLive    = activeRunners.has(data.buildId);
            const isPending = wsManager.hasPendingSession(data.buildId);
            const isAlreadyRegistered = wsManager.sessions.has(data.buildId);

            if (isLive || isPending || isAlreadyRegistered) {
                wsManager.registerSession(ws, data.buildId);
                wsManager.sendToSession(data.buildId, {
                    type:    'SESSION_REGISTERED',
                    buildId: data.buildId,
                    ready:   activeRunners.get(data.buildId)?.isReady ?? false,
                });
            } else {
                try {
                    ws.send(JSON.stringify({ type: 'SESSION_NOT_FOUND', buildId: data.buildId }));
                } catch {}
            }
        }

        // ── SET_GPIO  (virtual button / input interaction) ────────────────────────
        if (data.type === 'SET_GPIO' && data.buildId) {
            const runner = activeRunners.get(data.buildId);
            if (runner) runner.setVirtualPin(data.pin, data.value);
        }
    });

    ws.on('close', () => {
        console.log('📡 Client disconnected — QEMU session kept alive for reconnect window');
    });
});

// ─── COMPILE + START QEMU ─────────────────────────────────────────────────────
export const compileArduinoCode = (req, res) => {
    let { code, target } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'No code provided.' });
    }

    // ── ESP32 NATIVE QEMU WORKFLOW ────────────────────────────────────────────
    if (target === 'esp32') {

        if (activeRunners.size >= MAX_SESSIONS) {
            return res.status(503).json({
                error: `Server at capacity (${activeRunners.size}/${MAX_SESSIONS} active sessions). Try again later.`,
            });
        }

        // Validate esptool.py before touching any disk — fail fast with a clear message
        let esptoolPath;
        try {
            esptoolPath = _requireEsptool();
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }

        const buildId    = uuidv4();
        const sketchDir  = path.join(BUILDS_DIR, buildId);
        const sketchName = buildId;                            // arduino-cli uses the folder name
        const sketchFile = path.join(sketchDir, `${sketchName}.ino`);
        const buildDir   = path.join(sketchDir, 'build');
        const pipesDir   = path.join(os.tmpdir(), `openhw-${buildId}`);

        // ── Create pending buffer BEFORE any async work so no QEMU output is lost ──
        wsManager.createPendingSession(buildId);

        // ── Write sketch files ────────────────────────────────────────────────────
        try {
            fs.mkdirSync(sketchDir, { recursive: true });
            fs.mkdirSync(buildDir,  { recursive: true });

            // Blocker 3: silently inject the bridge shim before user code
            // INJECTED_LINE_COUNT lines are prepended — errors are offset-corrected later
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
        } catch (err) {
            wsManager.unregisterSession(buildId);
            _cleanup(buildId);
            return res.status(500).json({ error: 'Failed to create build environment.', detail: err.message });
        }

        const fqbn = process.env.ESP32_FQBN || 'esp32:esp32:esp32:FlashMode=dio,FlashFreq=40,FlashSize=4M';
        const compileArgs = ['compile', '--fqbn', fqbn, '--output-dir', buildDir, sketchFile];

        console.log(`[${buildId}] 🔨 Compiling with fqbn=${fqbn}...`);

        // Send early HTTP response with the buildId so the browser can open its WS
        // and send REGISTER_SESSION before compilation finishes.
        // The browser receives the buildId immediately and connects to the WS —
        // all subsequent events (COMPILE_SUCCESS / COMPILE_ERROR / QEMU_READY) arrive
        // over the WS with the buildId, not the HTTP channel.
        res.json({ success: true, buildId, message: 'Compilation started. Connect via WebSocket.' });

        execFile(ARDUINO_CLI_PATH, compileArgs, { timeout: 120_000 }, (error, stdout, stderr) => {
            const combinedOutput    = [stdout, stderr].filter(Boolean).join('\n').trim();
            const shiftedOutput     = _shiftLineNumbers(combinedOutput, sketchFile);

            // Name that arduino-cli uses for output artifacts (it mirrors the sketch folder name)
            const sketchBase = sketchName;
            const appBin     = path.join(buildDir, `${sketchBase}.ino.bin`);

            if (error && !fs.existsSync(appBin)) {
                console.error(`[${buildId}] Compile failed`);
                console.error(`[${buildId}] ─── arduino-cli output ───\n${combinedOutput}\n─────────────────────────`);
                wsManager.sendToSession(buildId, {
                    type:   'COMPILE_ERROR',
                    buildId,
                    output: shiftedOutput.slice(0, 8192),
                });
                // ⏳ Grace period — keep the pending buffer alive so the browser's
                // REGISTER_SESSION can arrive and flush the error before we tear down.
                setTimeout(() => {
                    wsManager.unregisterSession(buildId);
                    _cleanup(buildId);
                }, 6000);
                return;
            }

            if (!fs.existsSync(appBin)) {
                wsManager.sendToSession(buildId, {
                    type:   'COMPILE_ERROR',
                    buildId,
                    output: 'Compilation finished but no .bin file was produced. Check that the ESP32 board core is installed.',
                });
                // ⏳ Grace period
                setTimeout(() => {
                    wsManager.unregisterSession(buildId);
                    _cleanup(buildId);
                }, 6000);
                return;
            }

            // ── Blocker 1: merge flash image ──────────────────────────────────────
            let mergedFlash;
            try {
                mergedFlash = _mergeFlashImage(buildDir, sketchBase + '.ino', esptoolPath);
                console.log(`[${buildId}] ✅ Flash image merged → ${mergedFlash}`);
            } catch (mergeErr) {
                console.error(`[${buildId}] Flash merge failed:`, mergeErr.message);
                wsManager.sendToSession(buildId, {
                    type:   'COMPILE_ERROR',
                    buildId,
                    output: `Flash image merge failed:\n${mergeErr.message}`,
                });
                // ⏳ Grace period
                setTimeout(() => {
                    wsManager.unregisterSession(buildId);
                    _cleanup(buildId);
                }, 6000);
                return;
            }

            // ── Missing piece 2: signal compile success before QEMU boots ─────────
            wsManager.sendToSession(buildId, { type: 'COMPILE_SUCCESS', buildId });

            // ── Start QEMU ────────────────────────────────────────────────────────
            const runner = new QemuRunner(buildId, mergedFlash, pipesDir);
            activeRunners.set(buildId, runner);
            runner.start();

            console.log(`[${buildId}] 🚀 QEMU started`);
        });

    } else {
        // ── ARDUINO UNO WORKFLOW (unchanged) ─────────────────────────────────────
        const sketchId   = crypto.randomBytes(8).toString('hex');
        const sketchDir  = path.join(TEMP_DIR, `sketch_${sketchId}`);
        const sketchFile = path.join(sketchDir, `sketch_${sketchId}.ino`);
        const buildDir   = path.join(sketchDir, 'build');

        try {
            fs.mkdirSync(sketchDir, { recursive: true });
            fs.mkdirSync(buildDir,  { recursive: true });
            fs.writeFileSync(sketchFile, code);
        } catch (err) {
            return res.status(500).json({ error: 'Failed to create temporary build environment.' });
        }

        const fqbn = 'arduino:avr:uno';
        execFile(ARDUINO_CLI_PATH, ['compile', '--fqbn', fqbn, '--output-dir', buildDir, sketchFile], (error, stdout, stderr) => {
            let hexContent  = '';
            const hexPath   = path.join(buildDir, `sketch_${sketchId}.ino.hex`);

            if (fs.existsSync(hexPath)) hexContent = fs.readFileSync(hexPath, 'utf8');

            fs.rm(sketchDir, { recursive: true, force: true }, () => {});

            if (error && !hexContent) {
                return res.status(400).json({
                    error:   'Compilation failed',
                    details: (stderr || stdout || '').slice(0, 4096),
                });
            }
            if (!hexContent) return res.status(500).json({ error: 'No hex file produced.' });

            return res.json({ hex: hexContent, stdout });
        });
    }
};

// ─── STOP SESSION ──────────────────────────────────────────────────────────────
export const stopSession = (req, res) => {
    const { buildId } = req.params;
    const runner = activeRunners.get(buildId);

    if (!runner) {
        return res.status(404).json({ error: 'Session not found or already stopped.' });
    }

    runner.kill();
    _cleanup(buildId);
    console.log(`[${buildId}] 🛑 Session stopped by client`);
    return res.json({ success: true, buildId });
};

// ============================================================================
// Direct Boot Endpoint for Debugging
// ============================================================================
export const directBoot = (req, res) => {
    const buildId = uuidv4();
    const mergedFlash = "/Users/riteshjadhav/FOSSEE NEw/openhw-studio-emulator/src/components/ESP32/oshw.ino.merged.bin";
    const pipesDir = path.join(os.tmpdir(), `openhw-${buildId}`);

    // Create pipes directory
    if (!fs.existsSync(pipesDir)) {
        fs.mkdirSync(pipesDir, { recursive: true });
    }

    // Attempt to register pending session (frontend connect depends on this)
    wsManager.createPendingSession(buildId);

    res.json({ success: true, buildId, message: 'Starting direct boot from pre-compiled .bin' });

    // Wait 1.5s for the frontend to switch to the terminal and establish WS connection
    setTimeout(() => {
        // Broadcast successful "compile" so frontend moves to the running state
        wsManager.sendToSession(buildId, { type: 'COMPILE_SUCCESS', buildId });
        
        // Boot QEMU immediately
        const runner = new QemuRunner(buildId, mergedFlash, pipesDir);
        activeRunners.set(buildId, runner);
        runner.start();

        console.log(`[${buildId}] 🚀 QEMU started via Direct Boot from ${mergedFlash}`);
    }, 1500);
};
