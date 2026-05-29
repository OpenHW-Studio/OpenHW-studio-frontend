/**
 * useHardwareSocket.js  —  src/esp32/hooks/useHardwareSocket.js
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that encapsulates ALL communication with the ESP32 QEMU backend.
 *
 * Usage:
 *   const esp32 = useHardwareSocket({
 *     onSerialLine : (text)       => appendToMonitor(text),
 *     onGpioSync   : (pin, value) => updatePinState(pin, value),
 *     onLog        : (msg, dir)   => logSystemMessage(msg, dir),
 *     onStop       : ()           => handleSessionEnd(),
 *   });
 *
 *   await esp32.run(code);       // compile + connect WebSocket
 *   await esp32.directBoot();   // boot from pre-built binary
 *   esp32.stop();               // tear down everything
 *   esp32.sendGpio(pin, value); // inject GPIO input into firmware
 *
 * ── Reconnection strategy ─────────────────────────────────────────────────────
 *   The hook opens the WebSocket BEFORE sending the compile request so no early
 *   messages (e.g. COMPILE_ERROR fired during fast compilation) are missed.
 *   If the socket drops unexpectedly, a single automatic reconnect is attempted
 *   within RECONNECT_DELAY_MS.
 *
 * ── Serial batching ───────────────────────────────────────────────────────────
 *   SERIAL_OUTPUT messages are batched into a buffer and flushed to the parent
 *   every FLUSH_INTERVAL_MS via setInterval.  This avoids a React re-render per
 *   character when firmware is printing at high speed.
 *
 * ── Safety timeouts ──────────────────────────────────────────────────────────
 *   A compile-phase watchdog kills the session if no WS progress arrives
 *   within COMPILE_TIMEOUT_MS.  This prevents the UI hanging indefinitely
 *   if the backend becomes unresponsive.
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';
import { compileCode, runBinaryCode, stopSession } from '../../services/simulatorService.js';

// ─── Configuration ─────────────────────────────────────────────────────────────

/** Maximum time (ms) to wait for any WebSocket progress during compilation. */
const COMPILE_TIMEOUT_MS = 120_000; // 2 minutes

/** Maximum time (ms) to wait for the QEMU boot phase before declaring failure. */
const BOOTING_TIMEOUT_MS = 60_000; // 1 minute

/** Maximum time (ms) to wait during direct boot (pre-compiled binary). */
const DIRECT_BOOT_TIMEOUT_MS = 30_000;

/** How often to flush the serial output buffer to the parent callback (ms). */
const FLUSH_INTERVAL_MS = 100;

/** How long to wait before attempting a single automatic WS reconnect (ms). */
const RECONNECT_DELAY_MS = 2_000;

/** Maximum number of automatic reconnect attempts per session. */
const MAX_RECONNECT_ATTEMPTS = 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive the WebSocket base URL from VITE_API_BASE_URL.
 * Falls back to ws://localhost:5001 in development.
 */
function getWsBaseUrl() {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
    return base.replace(/^https/, 'wss').replace(/^http/, 'ws');
}

// ── Frontend perf diagnostics ────────────────────────────────────────────

/**
 * Module-level message rate tracker.
 * Logs to browser console every 1 second so we can correlate frontend
 * message volume with Chrome CPU usage during simulation boot.
 */
const _diag = {
    total:   0,
    gpio:    0,
    lastMs:  Date.now(),
};

function _diagTick(type) {
    _diag.total++;
    if (type === 'GPIO_SYNC') _diag.gpio++;
    const now = Date.now();
    const dt  = now - _diag.lastMs;
    if (dt >= 1000) {
        const rate = (_diag.total / (dt / 1000)).toFixed(0);
        const gpio = (_diag.gpio  / (dt / 1000)).toFixed(0);
        console.log(
            `[WS-PERF] msgs/s=${rate} | GPIO_SYNC/s=${gpio}` +
            ` | total-recv=${_diag.total}`
        );
        _diag.total  = 0;
        _diag.gpio   = 0;
        _diag.lastMs = now;
    }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   onSerialLine?  : (text: string) => void,
 *   onGpioSync?    : (pin: string, value: number) => void,
 *   onLog?         : (msg: string, dir: string) => void,
 *   onPhaseChange? : (phase: 'compiling'|'booting'|'running'|'stalled'|'stopped') => void,
 *   onStop?        : () => void,
 *   onNeopixelSync?: (channel: number, pixels: any[]) => void,
 *   onGpioDir?     : (pin: number, dir: number) => void,
 *   onPwmSync?     : (channel: number, duty_pct: number) => void,
 *   onGpioRouting? : (gpio: number, signal_id: number) => void,
 *   onGpioRoutingClear? : (gpio: number) => void,
 *   onI2cEvent?    : (bus: number, addr: number, event: number, response: number) => void,
 *   onI2cTransaction?   : (addr: number, data: number[]) => void,
 *   onProxyI2cComplete? : (addr: number, data: number[]) => void,
 *   onSpiBatch?    : (b64: string) => void,
 *   onEpaperUpdate?: (componentId: string, frame: { width: number, height: number, frame_b64: string, refresh_ms: number }) => void,
 *   onTone?        : (pin: string, frequency: number, duration: number) => void,
 * }} callbacks
 */
export function useHardwareSocket({
    onSerialLine,
    onGpioSync,
    onLog,
    onPhaseChange,
    onStop,
    onNeopixelSync,
    onGpioDir,
    onPwmSync,
    onGpioRouting,
    onGpioRoutingClear,
    onI2cEvent,
    onI2cTransaction,
    onProxyI2cComplete,
    onSpiEvent,
    onSpiBatch,
    onEpaperUpdate,
    onTone
} = {}) {
    // ── Refs (survive renders without causing re-renders) ────────────────────

    /** The live WebSocket connection, or null when idle. */
    const wsRef             = useRef(null);

    /** The active session buildId, or null when idle. */
    const buildIdRef        = useRef(null);

    /** The active session target (e.g. 'esp32' or 'stm32'). */
    const targetRef         = useRef('esp32');

    /** Batched SERIAL_OUTPUT lines waiting to be flushed. */
    const serialBatchRef    = useRef([]);

    /** setInterval handle for the serial flush timer. */
    const flushTimerRef     = useRef(null);

    /** setTimeout handle for the compile watchdog. */
    const watchdogRef       = useRef(null);

    /** Number of automatic reconnect attempts for the current session. */
    const reconnectCountRef = useRef(0);

    /** Whether stop() has been called — prevents redundant cleanup. */
    const stoppedRef        = useRef(true);

    /**
     * Stable ref for callbacks.
     * Updating on every render means handlers always close over the latest
     * onSerialLine / onGpioSync / etc without needing them in dep arrays.
     */
    const cbRef = useRef({
        onSerialLine, onGpioSync, onLog, onPhaseChange, onStop, onNeopixelSync,
        onGpioDir, onPwmSync, onGpioRouting, onGpioRoutingClear,
        onI2cEvent, onI2cTransaction, onProxyI2cComplete, onSpiEvent, onSpiBatch, onEpaperUpdate, onTone
    });
    useEffect(() => {
        cbRef.current = {
            onSerialLine, onGpioSync, onLog, onPhaseChange, onStop, onNeopixelSync,
            onGpioDir, onPwmSync, onGpioRouting, onGpioRoutingClear,
            onI2cEvent, onI2cTransaction, onProxyI2cComplete, onSpiEvent, onSpiBatch, onEpaperUpdate, onTone
        };
    });

    // ── Serial flush ─────────────────────────────────────────────────────────

    /** Push accumulated serial lines to the parent callback. */
    const flushSerial = useCallback(() => {
        const lines = serialBatchRef.current.splice(0); // drain atomically
        lines.forEach(line => cbRef.current.onSerialLine?.(line));
    }, []);

    const startFlushTimer = useCallback(() => {
        if (flushTimerRef.current) return; // already running
        flushTimerRef.current = setInterval(flushSerial, FLUSH_INTERVAL_MS);
    }, [flushSerial]);

    const stopFlushTimer = useCallback(() => {
        if (flushTimerRef.current) {
            clearInterval(flushTimerRef.current);
            flushTimerRef.current = null;
        }
    }, []);

    // ── Watchdog ─────────────────────────────────────────────────────────────

    const clearWatchdog = useCallback(() => {
        if (watchdogRef.current) {
            clearTimeout(watchdogRef.current);
            watchdogRef.current = null;
        }
    }, []);

    const armWatchdog = useCallback((timeoutMs, label) => {
        clearWatchdog();
        watchdogRef.current = setTimeout(() => {
            cbRef.current.onLog?.(
                `❌ ${label} timed out after ${timeoutMs / 1000}s. No response from server.`,
                'sys',
            );
            // eslint-disable-next-line no-use-before-define
            stop();
        }, timeoutMs);
    }, [clearWatchdog]); // stop added below

    // ── Stop / cleanup ────────────────────────────────────────────────────────

    /**
     * stop()
     *
     * Tears down the WebSocket, cancels all timers, resets state.
     * Safe to call multiple times.
     */
    const stop = useCallback(() => {
        if (stoppedRef.current) return;
        stoppedRef.current = true;

        clearWatchdog();
        stopFlushTimer();

        // Flush any remaining batched lines before closing
        flushSerial();

        const ws = wsRef.current;
        if (ws) {
            // Null out handlers first to prevent recursive stop() calls
            ws.onmessage = null;
            ws.onclose   = null;
            ws.onerror   = null;

            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close(1000, 'Session stopped');
            }
            wsRef.current = null;
        }

        if (buildIdRef.current) {
            stopSession(buildIdRef.current, targetRef.current || 'esp32').catch(err => {
                console.warn('[useHardwareSocket] Failed to stop session on backend:', err);
            });
        }

        buildIdRef.current      = null;
        targetRef.current       = 'esp32';
        serialBatchRef.current  = [];
        reconnectCountRef.current = 0;

        cbRef.current.onStop?.();
    }, [clearWatchdog, stopFlushTimer, flushSerial]);

    // Patch armWatchdog's closure so it can call stop (defined after)
    useEffect(() => {
        // Nothing to do — the ref already closes over the latest stop
    }, [stop]);

    // ── WebSocket message router ──────────────────────────────────────────────

    /**
     * attachHandlers(ws, buildId)
     *
     * Wires onmessage / onerror / onclose to the given socket.
     * Called after both the WS is open and the buildId is known.
     */
    const attachHandlers = useCallback((ws, buildId) => {
        ws.onmessage = (event) => {
            let msg;
            try { msg = JSON.parse(event.data); } catch { return; }

            // Perf diagnostic tick — logs msg/s & GPIO/s to browser console
            _diagTick(msg.type);

            // Drop stale messages from a previous session
            if (msg.buildId && msg.buildId !== buildId) return;

            switch (msg.type) {
                case 'SESSION_REGISTERED':
                    cbRef.current.onLog?.('🔗 Session registered with server.', 'sys');
                    break;

                case 'COMPILE_SUCCESS':
                    // arduino-cli compilation done; QEMU is about to start
                    clearWatchdog();
                    cbRef.current.onLog?.('✅ Compiled — Emulator is starting…', 'sys');
                    // Re-arm watchdog for the boot phase
                    armWatchdog(BOOTING_TIMEOUT_MS, 'Boot');
                    break;

                case 'COMPILE_ERROR': {
                    clearWatchdog();
                    cbRef.current.onLog?.('❌ Compilation failed:', 'sys');
                    const lines = (msg.output || 'No error details.').split('\n');
                    lines.forEach(line => { if (line.trim()) cbRef.current.onLog?.(line, 'err'); });
                    cbRef.current.onPhaseChange?.('stopped');
                    stop();
                    break;
                }

                case 'QEMU_BOOTING':
                    // QEMU is up; ROM boot detected — firmware is loading
                    clearWatchdog();
                    cbRef.current.onLog?.('🔄 ESP32 is booting…', 'sys');
                    cbRef.current.onPhaseChange?.('booting');
                    // Re-arm a watchdog for the READY handshake window
                    armWatchdog(BOOTING_TIMEOUT_MS, 'Firmware ready handshake');
                    break;

                case 'FIRMWARE_READY':
                    // sim_ready() was called in user setup() — device is fully initialised
                    clearWatchdog();
                    cbRef.current.onLog?.('🟢 Device is running and ready.', 'sys');
                    cbRef.current.onPhaseChange?.('running');
                    break;

                // Legacy event — sent by older firmware that doesn't call sim_ready().
                // In that case, QEMU_READY (from ROM boot detection) is the best signal
                // we have.  FIRMWARE_READY supersedes this if present.
                case 'QEMU_READY':
                    // Only act on this if we haven't already received FIRMWARE_READY
                    // (FIRMWARE_READY also sends QEMU_READY for backward compat, so we
                    // may get it twice — this guard prevents a phase downgrade).
                    clearWatchdog();
                    cbRef.current.onLog?.('🟡 Firmware running (no sim_ready() detected).', 'sys');
                    cbRef.current.onPhaseChange?.('running');
                    break;

                case 'SIMULATOR_READY':
                    clearWatchdog();
                    cbRef.current.onLog?.('🟢 Device is running and ready.', 'sys');
                    cbRef.current.onPhaseChange?.('running');
                    break;

                case 'SIMULATOR_STOPPED':
                    cbRef.current.onLog?.(`🛑 Simulator exited (code ${msg.code ?? '?'}).`, 'sys');
                    cbRef.current.onPhaseChange?.('stopped');
                    stop();
                    break;

                case 'RUNTIME_ERROR':
                    cbRef.current.onLog?.(`❌ Runtime error: ${msg.message}`, 'sys');
                    cbRef.current.onPhaseChange?.('stopped');
                    stop();
                    break;

                case 'FIRMWARE_STALLED':
                    cbRef.current.onLog?.(`⚠️ ${msg.message}`, 'sys');
                    cbRef.current.onPhaseChange?.('stalled');
                    break;

                case 'GPIO_SYNC':
                    cbRef.current.onGpioSync?.(String(msg.pin), msg.value);
                    break;

                case 'TONE':
                    cbRef.current.onTone?.(String(msg.pin), msg.frequency, msg.duration);
                    break;

                // ── GPIO direction event (input / output mode change) ────────
                case 'GPIO_DIR':
                    cbRef.current.onGpioDir?.(msg.pin, msg.dir);
                    break;

                case 'WS2812_UPDATE':
                    cbRef.current.onNeopixelSync?.(msg.channel, msg.pixels);
                    break;

                // ── PWM / LEDC duty-cycle change ──────────────────────────────
                case 'PWM_SYNC':
                    cbRef.current.onPwmSync?.(msg.channel, msg.duty_pct);
                    break;

                // ── GPIO Matrix routing ────────────────────────────────────────
                case 'GPIO_ROUTING':
                    cbRef.current.onGpioRouting?.(msg.gpio, msg.signal_id);
                    break;

                case 'GPIO_ROUTING_CLEAR':
                    cbRef.current.onGpioRoutingClear?.(msg.gpio);
                    break;

                // ── I2C protocol telemetry ─────────────────────────────────────
                // Raw per-byte I2C event (bus, addr, event code, response byte).
                case 'protocol:i2c':
                    cbRef.current.onI2cEvent?.(msg.bus, msg.addr, msg.event, msg.response);
                    break;

                // Full buffered I2C write transaction (emitted by ProxySlave on STOP).
                case 'I2C_TRANSACTION':
                case 'i2c_transaction':
                    console.log(`[useHardwareSocket] Received i2c_transaction for addr 0x${msg.addr?.toString(16)}, size: ${msg.data?.length}`);
                    cbRef.current.onI2cTransaction?.(msg.addr, msg.data);
                    break;

                // ProxySlave completed a master write — replay bytes on the
                // frontend virtual device to keep its state in sync.
                case 'PROXY_I2C_COMPLETE':
                case 'proxy_i2c_complete':
                    cbRef.current.onProxyI2cComplete?.(msg.addr, msg.data);
                    break;

                // ── SPI protocol telemetry ─────────────────────────────────────
                // Per-byte / CS-change SPI event.
                case 'protocol:spi':
                    cbRef.current.onSpiEvent?.(msg.bus, msg.event, msg.response);
                    break;

                // High-throughput batched SPI MOSI bytes encoded as base64.
                // The worker flushes up to 4096 bytes per frame at 20 fps
                // to prevent per-byte WebSocket flooding (e.g. TFT display writes).
                case 'SPI_BATCH':
                    cbRef.current.onSpiBatch?.(msg.b64);
                    break;

                // ── ePaper SSD168x / UC8159c display frame ────────────────────
                // Fired by the backend SSD168x or UC8159c slave decoder on every
                // MASTER_ACTIVATION (0x20) command. The `data` envelope matches
                // the Velxio `onEpaperUpdate` callback shape exactly.
                case 'EPAPER_UPDATE':
                    if (msg.data && msg.data.component_id) {
                        cbRef.current.onEpaperUpdate?.(msg.data.component_id, {
                            width:      msg.data.width,
                            height:     msg.data.height,
                            frame_b64:  msg.data.frame_b64,
                            refresh_ms: msg.data.refresh_ms ?? 50,
                        });
                    }
                    break;

                // ── UART1 / UART2 serial output ────────────────────────────────
                // UART0 is handled via SERIAL_OUTPUT; secondary UARTs route here.
                case 'UART_OUTPUT':
                    if (msg.text) {
                        // Forward to serial monitor with a UART prefix so the user
                        // can distinguish UART0 vs UART1/2 output in the log.
                        cbRef.current.onLog?.(`[UART${msg.uart ?? '?'}] ${msg.text}`, 'rx');
                    }
                    break;

                case 'SERIAL_OUTPUT':
                    if (msg.text) serialBatchRef.current.push(msg.text);
                    else if (msg.data) serialBatchRef.current.push(msg.data);
                    break;

                case 'SERIAL_LOG': {
                    // Structured log line from sim_log() — show with level prefix
                    const prefix = {
                        INFO:    '[ℹ️ INFO]',
                        WARN:    '[⚠️ WARN]',
                        ERROR:   '[🔴 ERROR]',
                        OK:      '[✅ OK]',
                    }[msg.level] ?? `[${msg.level}]`;
                    const dir = msg.level === 'ERROR' ? 'err' : 'rx';
                    cbRef.current.onLog?.(`${prefix} ${msg.message}`, dir);
                    break;
                }

                case 'QEMU_EXIT':
                    cbRef.current.onLog?.(`🛑 QEMU exited (code ${msg.code ?? '?'}).`, 'sys');
                    cbRef.current.onPhaseChange?.('stopped');
                    stop();
                    break;

                case 'QEMU_ERROR':
                    cbRef.current.onLog?.(`❌ QEMU error: ${msg.message}`, 'sys');
                    cbRef.current.onPhaseChange?.('stopped');
                    stop();
                    break;

                case 'SESSION_NOT_FOUND':
                    cbRef.current.onLog?.(
                        '⚠️ Session not found on server — it may have timed out or the server restarted.',
                        'sys',
                    );
                    cbRef.current.onPhaseChange?.('stopped');
                    stop();
                    break;

                default:
                    break;
            }
        };

        ws.onerror = () => {
            // onerror always precedes onclose; actual cleanup happens in onclose
            cbRef.current.onLog?.('❌ WebSocket connection error.', 'sys');
        };

        ws.onclose = (event) => {
            // Unexpected close (not triggered by our own stop()) — attempt reconnect
            if (!stoppedRef.current && reconnectCountRef.current < MAX_RECONNECT_ATTEMPTS) {
                reconnectCountRef.current += 1;
                cbRef.current.onLog?.(
                    `⚠️ WebSocket closed unexpectedly (code ${event.code}). ` +
                    `Reconnecting in ${RECONNECT_DELAY_MS / 1000}s…`,
                    'sys',
                );
                setTimeout(() => {
                    if (!stoppedRef.current && buildIdRef.current) {
                        const newWs = _openWebSocket(buildId);
                        wsRef.current = newWs;
                    }
                }, RECONNECT_DELAY_MS);
            } else if (!stoppedRef.current) {
                cbRef.current.onLog?.('❌ WebSocket connection closed.', 'sys');
                stop();
            }
        };
    }, [clearWatchdog, stop]);

    // ── Internal: open WS, attach handlers, register session ─────────────────

    /**
     * Opens a new WebSocket, attaches handlers, and sends REGISTER_SESSION.
     * Works whether the socket is already OPEN or still CONNECTING.
     */
    const _openWebSocket = useCallback((buildId) => {
        const ws = new WebSocket(getWsBaseUrl());
        attachHandlers(ws, buildId);

        const doRegister = () => {
            ws.send(JSON.stringify({ type: 'REGISTER_SESSION', buildId }));
        };

        if (ws.readyState === WebSocket.OPEN) {
            doRegister();
        } else {
            ws.onopen = doRegister;
        }

        return ws;
    }, [attachHandlers]);

    // ── Public: run ───────────────────────────────────────────────────────────

    /**
     * run(code, target)
     *
     * 1. Opens a WebSocket immediately (before the compile request) so no
     *    early COMPILE_ERROR messages are missed.
     * 2. Sends the code to /api/compile?target=esp32 or target=stm32.
     * 3. Arms the compile watchdog.
     *
     * @param {string} code - Arduino C++ sketch source code.
     * @param {string} target - The platform target ('esp32' or 'stm32')
     * @returns {Promise<string>} The buildId assigned by the backend.
     */
    const run = useCallback(async (code, target = 'esp32') => {
        stoppedRef.current = false;
        reconnectCountRef.current = 0;
        targetRef.current = target;

        cbRef.current.onLog?.('⚙️  Sending code to compile server…', 'sys');

        // Open the WebSocket first — captures any COMPILE_ERROR sent before
        // the HTTP response has even been received by the browser.
        // We create a temporary WS without a buildId; once we have the buildId
        // from the HTTP response we send REGISTER_SESSION over it.
        const ws = new WebSocket(getWsBaseUrl());
        wsRef.current = ws;

        // If WS fails instantly before compileCode returns, we must catch it
        ws.onclose = () => {
            if (!buildIdRef.current) {
                // compileCode hasn't returned yet, but WS died
                stop();
            }
        };

        let result;
        try {
            result = await compileCode({ code, target });
        } catch (err) {
            stop();
            const serverMsg = err.response?.data?.error || err.message;
            cbRef.current.onLog?.(`❌ Compile failed: ${serverMsg}`, 'sys');
            throw err;
        }

        if (!result?.buildId) {
            stop();
            cbRef.current.onLog?.('❌ Server did not return a buildId.', 'sys');
            throw new Error('No buildId returned from compile server.');
        }

        buildIdRef.current = result.buildId;
        cbRef.current.onLog?.('🔗 Connecting to build session…', 'sys');

        // Attach message router and register with the backend
        attachHandlers(ws, result.buildId);
        const doRegister = () =>
            ws.send(JSON.stringify({ type: 'REGISTER_SESSION', buildId: result.buildId }));

        if (ws.readyState === WebSocket.OPEN) {
            doRegister();
        } else if (ws.readyState === WebSocket.CONNECTING) {
            ws.onopen = doRegister;
        }

        startFlushTimer();
        armWatchdog(COMPILE_TIMEOUT_MS, 'Compilation');

        return result.buildId;
    }, [attachHandlers, startFlushTimer, armWatchdog, stop]);

    // ── Public: directBoot ────────────────────────────────────────────────────

    /**
     * directBoot()
     *
     * Boot QEMU from a pre-compiled binary on the server.
     * Useful for hardware integration testing without a compile step.
     *
     * @returns {Promise<string>} The buildId assigned by the backend.
     */
    const directBoot = useCallback(async () => {
        stoppedRef.current = false;
        reconnectCountRef.current = 0;

        cbRef.current.onLog?.('⚙️  Initiating direct boot…', 'sys');

        const ws = new WebSocket(getWsBaseUrl());
        wsRef.current = ws;

        ws.onclose = () => {
            if (!buildIdRef.current) stop();
        };

        let result;
        try {
            // result = await directBootCode();
            throw new Error("directBootCode not implemented");
        } catch (err) {
            stop();
            cbRef.current.onLog?.('❌ Direct boot request failed.', 'sys');
            throw err;
        }

        if (!result?.buildId) {
            stop();
            throw new Error('No buildId returned from direct-boot endpoint.');
        }

        buildIdRef.current = result.buildId;
        cbRef.current.onLog?.('🔗 Connecting to direct boot session…', 'sys');

        attachHandlers(ws, result.buildId);
        const doRegister = () =>
            ws.send(JSON.stringify({ type: 'REGISTER_SESSION', buildId: result.buildId }));

        if (ws.readyState === WebSocket.OPEN) {
            doRegister();
        } else if (ws.readyState === WebSocket.CONNECTING) {
            ws.onopen = doRegister;
        }

        startFlushTimer();
        armWatchdog(DIRECT_BOOT_TIMEOUT_MS, 'Direct boot');

        return result.buildId;
    }, [attachHandlers, startFlushTimer, armWatchdog, stop]);

    const runBinary = useCallback(async (firmware_b64) => {
        stoppedRef.current = false;
        reconnectCountRef.current = 0;

        cbRef.current.onLog?.('⚙️  Flashing dynamic binary to QEMU...', 'sys');

        const ws = new WebSocket(getWsBaseUrl());
        wsRef.current = ws;

        ws.onclose = () => {
            if (!buildIdRef.current) stop();
        };

        let result;
        try {
            result = await runBinaryCode(firmware_b64);
        } catch (err) {
            stop();
            cbRef.current.onLog?.('❌ Flash request failed.', 'sys');
            throw err;
        }

        if (!result?.buildId) {
            stop();
            throw new Error('No buildId returned from run-binary endpoint.');
        }

        buildIdRef.current = result.buildId;
        cbRef.current.onLog?.('🔗 Connecting to emulation session…', 'sys');

        attachHandlers(ws, result.buildId);
        const doRegister = () =>
            ws.send(JSON.stringify({ type: 'REGISTER_SESSION', buildId: result.buildId }));

        if (ws.readyState === WebSocket.OPEN) {
            doRegister();
        } else if (ws.readyState === WebSocket.CONNECTING) {
            ws.onopen = doRegister;
        }

        startFlushTimer();
        armWatchdog(DIRECT_BOOT_TIMEOUT_MS, 'Emulation boot');

        return result.buildId;
    }, [attachHandlers, startFlushTimer, armWatchdog, stop]);

    // ── Public: sendGpio ──────────────────────────────────────────────────────

    /**
     * sendGpio(pin, value)
     *
     * Inject a virtual GPIO input into the running firmware.
     * Silently ignored if no session is active.
     *
     * @param {number|string} pin   - GPIO pin number (0–39).
     * @param {0|1}           value - Pin level.
     */
    const sendGpio = useCallback((pin, value) => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) return;

        ws.send(JSON.stringify({ type: 'SET_GPIO', buildId, pin, value: value ? 1 : 0 }));
    }, []);

    const sendAdc = useCallback((channel, millivolts) => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) return;

        ws.send(JSON.stringify({ type: 'SET_ADC', buildId, channel, millivolts }));
    }, []);

    const sendDht = useCallback((pin, temp, hum) => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) return;

        ws.send(JSON.stringify({ type: 'SET_DHT', buildId, pin, temp, hum }));
    }, []);

    /**
     * sensorAttach(sensor_type, pin, properties)
     *
     * Tell the backend worker to register a virtual sensor on a GPIO pin so
     * it can respond to QEMU timing-critical queries (DHT-22 bit-banging,
     * HC-SR04 echo pulses, ePaper SSD168x SPI decoding, etc.) without round-
     * tripping over WebSocket per-bit.  Call once per sensor when the user
     * places a component on the canvas and connects wires.
     *
     * @param {string} sensor_type  - 'dht22' | 'hc-sr04' | 'epaper-ssd168x' | etc.
     * @param {number} pin          - GPIO pin number the sensor data line is on.
     * @param {object} properties   - Sensor-specific initial values (temp, humidity…)
     */
    const sensorAttach = useCallback((sensor_type, pin, properties = {}) => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) {
            console.log(`[useHardwareSocket] sensorAttach ignored: ws=${!!ws}, readyState=${ws?.readyState}, buildId=${buildId}`);
            return;
        }

        console.log(`[useHardwareSocket] SENSOR_ATTACH sending for ${sensor_type} on pin ${pin}`);
        ws.send(JSON.stringify({ type: 'SENSOR_ATTACH', buildId, sensor_type, pin, properties }));
    }, []);

    /**
     * sensorUpdate(pin, properties)
     *
     * Push updated parameter values (e.g. new temperature, new distance) to
     * an already-attached virtual sensor while the simulation is running.
     *
     * @param {number} pin        - GPIO pin the sensor is attached to.
     * @param {object} properties - Updated sensor-specific key/value pairs.
     */
    const sensorUpdate = useCallback((pin, properties = {}) => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) return;

        ws.send(JSON.stringify({ type: 'SENSOR_UPDATE', buildId, pin, properties }));
    }, []);

    /**
     * sensorDetach(pin)
     *
     * Remove the virtual sensor from the given GPIO pin. Call when the user
     * deletes a sensor component or disconnects its wires during simulation.
     *
     * @param {number} pin - GPIO pin the sensor was attached to.
     */
    const sensorDetach = useCallback((pin) => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) return;

        ws.send(JSON.stringify({ type: 'SENSOR_DETACH', buildId, pin }));
    }, []);

    /**
     * setAdcValue(pin, value)
     *
     * Inject a 12-bit ADC reading (0–4095) for a GPIO pin.
     * Used by potentiometer / LDR / joystick components to push their
     * current state into the firmware's analogRead() shim.
     *
     * @param {number} pin   - GPIO pin number.
     * @param {number} value - 12-bit ADC value (0–4095).
     */
    const setAdcValue = useCallback((pin, value) => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) return;
        ws.send(JSON.stringify({ type: 'ADC_SET', buildId, pin, value: Math.round(value) & 0x0FFF }));
    }, []);

    /**
     * setI2cResponse(addr, bytes)
     *
     * Pre-load the bytes that the firmware will receive when it calls
     * Wire.requestFrom(addr, n). Used by I2C sensor components (MPU6050,
     * BMP280, etc.) to push their simulated register values into the firmware.
     *
     * @param {number}   addr  - 7-bit I2C address.
     * @param {number[]} bytes - Array of byte values (0–255).
     */
    const setI2cResponse = useCallback((addr, bytes) => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) return;
        ws.send(JSON.stringify({ type: 'I2C_RESP_SET', buildId, addr, bytes }));
    }, []);

    /**
     * setSpiResponse(bytes)
     *
     * Pre-load MISO bytes that the firmware will receive during SPI.transfer()
     * calls. Bytes are consumed in order (FIFO). Used by SPI peripherals that
     * need to send data back to the ESP32 (SD cards, touch controllers, etc.).
     *
     * @param {number[]} bytes - Array of MISO byte values (0–255).
     */
    const setSpiResponse = useCallback((bytes) => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) return;
        ws.send(JSON.stringify({ type: 'SPI_RESP_SET', buildId, bytes }));
    }, []);

    /**
     * sendSerialBytes(bytes, uart?)
     *
     * Inject raw bytes into the ESP32's UART RX FIFO (default UART0).
     * The ESP32 UART RX FIFO is 128 bytes in hardware — this function sends
     * at most 64 bytes per call to prevent overflow (same constraint as Velxio).
     * Useful for simulating GPS sentence injection, RFID tag reads, etc.
     *
     * @param {number[]} bytes - Array of byte values (0–255).
     * @param {number}   uart  - UART index (0, 1, or 2). Defaults to 0.
     */
    const sendSerialBytes = useCallback((bytes, uart = 0) => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) return;
        if (!bytes || bytes.length === 0) return;

        // Chunk into ≤64-byte slices to avoid UART RX FIFO overflow in QEMU
        const CHUNK = 64;
        for (let i = 0; i < bytes.length; i += CHUNK) {
            ws.send(JSON.stringify({
                type: 'SERIAL_INPUT',
                buildId,
                bytes: bytes.slice(i, i + CHUNK),
                uart,
            }));
        }
    }, []);

    const sendCameraAttach = useCallback(() => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) return;

        ws.send(JSON.stringify({ type: 'CAMERA_ATTACH', buildId }));
    }, []);

    const sendCameraFrame = useCallback((jpegBytes, width = 320, height = 240) => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) return;

        const u8 = jpegBytes instanceof Uint8Array ? jpegBytes : new Uint8Array(jpegBytes);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < u8.length; i += chunkSize) {
            binary += String.fromCharCode(...u8.subarray(i, i + chunkSize));
        }
        const b64 = btoa(binary);

        ws.send(JSON.stringify({ type: 'CAMERA_FRAME', buildId, fmt: 'jpeg', w: width, h: height, b64 }));
    }, []);

    const sendCameraDetach = useCallback(() => {
        const ws      = wsRef.current;
        const buildId = buildIdRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !buildId) return;

        ws.send(JSON.stringify({ type: 'CAMERA_DETACH', buildId }));
    }, []);

    // ── Cleanup on unmount ────────────────────────────────────────────────────

    useEffect(() => () => stop(), [stop]);

    // ─── Public API ─────────────────────────────────────────────────────────────────

    return useMemo(() => ({
        /** Compile code and start a QEMU session. Returns a Promise<buildId>. */
        run,
        /** Boot QEMU from a dynamic base64 binary. */
        runBinary,
        /** Boot from a pre-compiled binary. Returns a Promise<buildId>. */
        directBoot,
        /** Inject a GPIO level into the firmware. */
        sendGpio,
        /** Inject an ADC analog millivolt voltage (0–3300 mV). */
        sendAdc,
        /** Inject a DHT-22 temperature + humidity reading. */
        sendDht,
        /** Attach a virtual sensor to a GPIO pin in the QEMU worker. */
        sensorAttach,
        /** Update an already-attached virtual sensor's parameters. */
        sensorUpdate,
        /** Detach a virtual sensor from a GPIO pin. */
        sensorDetach,
        /** Inject a 12-bit ADC value (0-4095) for a GPIO pin via UART shim. */
        setAdcValue,
        /** Pre-load I2C read-response bytes for a 7-bit address. */
        setI2cResponse,
        /** Pre-load MISO bytes for SPI.transfer() calls (FIFO). */
        setSpiResponse,
        /**
         * Inject raw UART RX bytes into the ESP32 firmware (≤64 bytes/call).
         * Automatically chunks larger arrays to prevent FIFO overflow.
         */
        sendSerialBytes,
        /** Tell the backend an ESP32-CAM webcam is connected (call once on permission grant). */
        sendCameraAttach,
        /**
         * Push one JPEG frame from the browser webcam to QEMU's OV2640 DMA buffer.
         * Call at ~10 fps. jpegBytes can be ArrayBuffer or Uint8Array.
         */
        sendCameraFrame,
        /** Drop the camera payload. */
        sendCameraDetach,
        /** Tear down the current session cleanly. */
        stop,
        /** Read-only ref to the active buildId (null when idle). */
        buildIdRef,
        /** Read-only ref to the live WebSocket (null when idle). */
        wsRef,
    }), [run, runBinary, directBoot, sendGpio, sendAdc, sendDht, sensorAttach, sensorUpdate, sensorDetach, setAdcValue, setI2cResponse, setSpiResponse, sendSerialBytes, sendCameraAttach, sendCameraFrame, sendCameraDetach, stop]);
}
