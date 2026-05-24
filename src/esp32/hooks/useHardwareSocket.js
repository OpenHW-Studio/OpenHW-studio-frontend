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
import { compileCode, stopSession } from '../../services/simulatorService.js';

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   onSerialLine?  : (text: string) => void,
 *   onGpioSync?    : (pin: string, value: number) => void,
 *   onLog?         : (msg: string, dir: string) => void,
 *   onPhaseChange? : (phase: 'compiling'|'booting'|'running'|'stalled'|'stopped') => void,
 *   onStop?        : () => void,
 * }} callbacks
 */
export function useHardwareSocket({ onSerialLine, onGpioSync, onLog, onPhaseChange, onStop } = {}) {
    // ── Refs (survive renders without causing re-renders) ────────────────────

    /** The live WebSocket connection, or null when idle. */
    const wsRef             = useRef(null);

    /** The active session buildId, or null when idle. */
    const buildIdRef        = useRef(null);

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
    const cbRef = useRef({ onSerialLine, onGpioSync, onLog, onPhaseChange, onStop });
    useEffect(() => { cbRef.current = { onSerialLine, onGpioSync, onLog, onPhaseChange, onStop }; });

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
            stopSession(buildIdRef.current).catch(err => {
                console.warn('[useHardwareSocket] Failed to stop session on backend:', err);
            });
        }

        buildIdRef.current      = null;
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

            // Drop stale messages from a previous session
            if (msg.buildId && msg.buildId !== buildId) return;

            switch (msg.type) {
                case 'SESSION_REGISTERED':
                    cbRef.current.onLog?.('🔗 Session registered with server.', 'sys');
                    break;

                case 'COMPILE_SUCCESS':
                    // arduino-cli compilation done; QEMU is about to start
                    clearWatchdog();
                    cbRef.current.onLog?.('✅ Compiled — QEMU is starting…', 'sys');
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
                    // Only elevate to running if not already there
                    cbRef.current.onPhaseChange?.(prev => prev === 'running' ? 'running' : 'running');
                    break;

                case 'FIRMWARE_STALLED':
                    cbRef.current.onLog?.(`⚠️ ${msg.message}`, 'sys');
                    cbRef.current.onPhaseChange?.('stalled');
                    break;

                case 'GPIO_SYNC':
                    cbRef.current.onGpioSync?.(String(msg.pin), msg.value);
                    break;

                case 'SERIAL_OUTPUT':
                    if (msg.text) serialBatchRef.current.push(msg.text);
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
     * run(code)
     *
     * 1. Opens a WebSocket immediately (before the compile request) so no
     *    early COMPILE_ERROR messages are missed.
     * 2. Sends the code to /api/compile?target=esp32.
     * 3. Arms the compile watchdog.
     *
     * @param {string} code - Arduino C++ sketch source code.
     * @returns {Promise<string>} The buildId assigned by the backend.
     */
    const run = useCallback(async (code) => {
        stoppedRef.current = false;
        reconnectCountRef.current = 0;

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
            result = await compileCode({ code, target: 'esp32' });
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

    // ── Cleanup on unmount ────────────────────────────────────────────────────

    useEffect(() => () => stop(), [stop]);

    // ─── Public API ─────────────────────────────────────────────────────────────────

    return useMemo(() => ({
        /** Compile code and start a QEMU session. Returns a Promise<buildId>. */
        run,
        /** Boot from a pre-compiled binary. Returns a Promise<buildId>. */
        directBoot,
        /** Inject a GPIO level into the firmware. */
        sendGpio,
        /** Tear down the current session cleanly. */
        stop,
        /** Read-only ref to the active buildId (null when idle). */
        buildIdRef,
        /** Read-only ref to the live WebSocket (null when idle). */
        wsRef,
    }), [run, directBoot, sendGpio, stop]);
}
