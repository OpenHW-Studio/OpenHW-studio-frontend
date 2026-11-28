/**
 * Simulation-worker protocol-observer domain, extracted verbatim from
 * SimulatorPage.jsx handleRun > worker.onmessage.
 * (serial + SERIAL_OUTPUT ingress, LOG-ONLY protocol handlers
 *  I2C/SPI/GPIO/PWM/LEDC/DAC/ADC/TONE/UART-RX/TWAI/RMT/PCNT/NeoPixel,
 *  sim:sleep/wake banners, I2S Web-Audio playback, 150ms batch flush.)
 *
 * Pure function of (msg, ctx): appends to ctx.pendingProtocolLogsRef,
 * schedules ctx.protocolLogsTimerRef, calls ctx setters. The ONLY live
 * audio side-effect (AudioContext, gapless per-port scheduling) is
 * preserved verbatim via ctx.i2sAudioCtxRef/i2sNextScheduledTimeRef.
 *
 * Behavior contract: identical PROTOCOL_EVENT_TYPES set, identical
 * 200-entry caps, identical sleep/wake banners. Signal routing stays in
 * the worker — this file only observes. Verify via protocol-log panel
 * + I2S + sleep/wake Playwright checks.
 */
export function handleProtocolObserverMessage(msg, ctx) {
  const {
    boardComponents,
    pushSerialRxChunk,
    protocolAnalyzerRef,
    pendingProtocolLogsRef,
    protocolLogsTimerRef,
    setProtocolLogs,
    appendConsoleEntry,
    setIsDeviceSleeping,
    i2sAudioCtxRef,
    i2sNextScheduledTimeRef,
  } = ctx;
          if (msg.type === "serial") {
            const incomingBoardId = String(msg.boardId || "").trim();
            const hasKnownBoard =
              incomingBoardId &&
              boardComponents.some((b) => b.id === incomingBoardId);
            const singleBoardFallback =
              boardComponents.length === 1 ? boardComponents[0]?.id : "";
            const resolvedBoardId = hasKnownBoard
              ? incomingBoardId
              : singleBoardFallback || incomingBoardId || "default";
            pushSerialRxChunk(msg.data, resolvedBoardId, msg.source || "sim");
          }

          // ── 8B: SERIAL_OUTPUT from WASM runner (line-buffered complete lines) ──
          if (msg.type === "SERIAL_OUTPUT") {
            const incomingBoardId = String(msg.boardId || "").trim();
            const hasKnownBoard =
              incomingBoardId &&
              boardComponents.some((b) => b.id === incomingBoardId);
            const singleBoardFallback =
              boardComponents.length === 1 ? boardComponents[0]?.id : "";
            const resolvedBoardId = hasKnownBoard
              ? incomingBoardId
              : singleBoardFallback || incomingBoardId || "default";
            // Feed the complete line to the serial monitor
            if (msg.text) {
              pushSerialRxChunk(msg.text + "\n", resolvedBoardId, msg.source || "wasm");
            }
            // Also log to protocol analyzer
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processSerial(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }

          // ════════════════════════════════════════════════════════════════════
          // PROTOCOL OBSERVER BLOCK — LOGGING ONLY
          // ════════════════════════════════════════════════════════════════════
          // Everything below is OBSERVATION ONLY. The actual signal routing
          // (buzzer tone, LED color, servo angle, etc.) is already handled
          // inside simulation.worker.ts → runner → collectConnectedComponentPins.
          //
          // These handlers just feed the Protocol Analyzer log panel in the UI.
          // To disable a specific protocol's logging, delete its if-block below.
          // To disable ALL protocol logging, delete from here to END PROTOCOL OBSERVER.
          //
          // Where to find the log panel UI: search "protocolLogs" in this file.
          // Where to find ProtocolAnalyzer: src/circuit-validation/protocol-analyzer.js
          // ════════════════════════════════════════════════════════════════════

          // ── I2C (already hooked up from the original implementation) ──────────
          // LOG ONLY: actual I2C bus is handled by runner's onI2CWrite/onI2CRead
          if (msg.type === "protocol:i2c") {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processI2C(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }
          // LOG ONLY: ESP32-specific I2C transaction (different event type from AVR's protocol:i2c)
          if (msg.type === "esp32:i2c:transaction") {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processI2C({
                address: msg.addr, data: msg.data, isWrite: true
              });
              pendingProtocolLogsRef.current.push(log.message);
            }
          }
          // ── SPI (already hooked up from the original implementation) ──────────
          // LOG ONLY: actual SPI bus is handled by runner's onSPIByte/onSPIBuffer
          if (msg.type === "protocol:spi") {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processSPI(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }

          // ── GPIO ─────────────────────────────────────────────────────────────
          // LOG ONLY: actual GPIO state is applied by runner's setState()
          if (msg.type === "GPIO_SYNC") {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processGpio(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }
          // ── PWM (analogWrite) ─────────────────────────────────────────────────
          // LOG ONLY: actual PWM duty is applied by runner's onPwmDuty()
          if (msg.type === "PWM_SYNC" || (msg.type === "state" && msg.pwm !== undefined)) {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processPwm(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }
          // ── LEDC PWM (ESP32 hardware PWM) ─────────────────────────────────────
          // LOG ONLY: actual LEDC routing is handled by runner's ledcChannelMap + onPwmDuty()
          if (msg.type === "LEDC_SYNC") {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processLedc(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }
          // ── DAC ───────────────────────────────────────────────────────────────
          // LOG ONLY: actual DAC voltage is applied by runner's onAnalogVoltage()
          if (msg.type === "DAC_SYNC" || msg.type === "esp32:dac:sync") {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processDac(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }
          // ── ADC (analogRead) ──────────────────────────────────────────────────
          // LOG ONLY: ADC values are injected by useEsp32Engine → esp32Socket.setAdcValue()
          if (msg.type === "esp32:adc:sync") {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processAdc(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }
          // ── TONE (buzzer/speaker/piezo) ───────────────────────────────────────
          // LOG ONLY: actual TONE is routed via syncTone() → collectConnectedComponentPins → onTone()
          // Signal path: sim_tone() → >SIM:TONE:< → _handleSimFrame → worker → syncTone → component.onTone()
          if (msg.type === "TONE") {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processTone(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }
          // ── Serial RX (UART component → firmware) ─────────────────────────────
          // LOG ONLY: actual serial injection is handled by runner's serialRx()
          if (msg.type === "esp32:uart:rx") {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processSerialRx(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }
          // ── TWAI / CAN Bus ────────────────────────────────────────────────────
          // LOG ONLY: actual CAN frame delivery is handled by runner's onCanFrame()
          if (msg.type === "TWAI_TX") {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processTwai(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }
          // ── RMT / IR pulses ───────────────────────────────────────────────────
          // LOG ONLY: actual RMT pulse delivery is handled by runner's onRmtPulse() / onInfraredSignal()
          if (msg.type === "RMT_PULSE") {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processRmt(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }
          // ── PCNT (pulse counter) ──────────────────────────────────────────────
          // LOG ONLY: actual counter value is injected by runner's onPulseCount()
          if (msg.type === "PCNT_UPDATE") {
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processPcnt(msg);
              pendingProtocolLogsRef.current.push(log.message);
            }
          }
          // ── WS2812 / NeoPixel ─────────────────────────────────────────────────
          // LOG ONLY: actual pixel data is applied by runner's updatePixels()
          if (msg.type === "state" && msg.neopixels && Object.keys(msg.neopixels).length > 0) {
            Object.entries(msg.neopixels).forEach(([ch, pixels]) => {
              if (protocolAnalyzerRef.current) {
                const log = protocolAnalyzerRef.current.processNeopixel({ channel: ch, pixels });
                pendingProtocolLogsRef.current.push(log.message);
              }
            });
          }

          // ── Deep Sleep / Wake ─────────────────────────────────────────────────
          // NOTE: sim:sleep/sim:wake are NOT logging-only — they also update isDeviceSleeping state
          // and print a console banner. Only the protocolAnalyzer.process* call is logging-only.
          if (msg.type === "sim:sleep") {
            setIsDeviceSleeping(true);
            const sec = msg.duration_us ? (msg.duration_us / 1_000_000).toFixed(2) + 's' : '∞';
            appendConsoleEntry("info", `💤 Device entering deep sleep (${sec})`, "simulator");
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processSleep(msg); // ← LOG ONLY line
              pendingProtocolLogsRef.current.push(log.message);            // ← LOG ONLY line
            }
          }
          if (msg.type === "sim:wake") {
            setIsDeviceSleeping(false);
            appendConsoleEntry("info", "☀️ Device woke from deep sleep", "simulator");
            if (protocolAnalyzerRef.current) {
              const log = protocolAnalyzerRef.current.processWake(msg); // ← LOG ONLY line
              pendingProtocolLogsRef.current.push(log.message);           // ← LOG ONLY line
            }
          }
          // ════ END PROTOCOL OBSERVER BLOCK ════════════════════════════════════

          // ── I2S Audio Playback (Web Audio API) ────────────────────────────────
          // NOT inside the protocol observer — this actually plays audio.
          // Signal path: sim_i2s_write() → >SIM:I2S:< → qemuRunner → worker → here
          //
          // To disable I2S audio: delete from here to "END I2S AUDIO".
          // The ProtocolAnalyzer log for I2S is handled inside processI2S() below.
          if (msg.type === "I2S_AUDIO" && msg.pcm_b64) {
            try {
              // 1. Lazy-create AudioContext (must be after user gesture; Run button counts)
              if (!i2sAudioCtxRef.current) {
                i2sAudioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
              }
              const ctx = i2sAudioCtxRef.current;
              if (ctx.state === "suspended") ctx.resume();

              const port = msg.port ?? 0;
              const sampleRate = msg.sampleRate || 44100;
              const bits = msg.bits || 16;

              // 2. Decode base64 → raw bytes
              const binStr = atob(msg.pcm_b64);
              const rawBytes = new Uint8Array(binStr.length);
              for (let i = 0; i < binStr.length; i++) rawBytes[i] = binStr.charCodeAt(i);

              // 3. Interpret as Int16 PCM → Float32 normalised [-1, 1]
              //    (16-bit signed little-endian is the default from sim_i2s_write)
              const bytesPerSample = bits === 32 ? 4 : (bits === 24 ? 3 : 2);
              const sampleCount = Math.floor(rawBytes.length / bytesPerSample);
              const f32 = new Float32Array(sampleCount);
              const view = new DataView(rawBytes.buffer);
              for (let i = 0; i < sampleCount; i++) {
                const byteOff = i * bytesPerSample;
                if (bits === 32) {
                  f32[i] = view.getInt32(byteOff, true) / 0x80000000;
                } else if (bits === 24) {
                  const lo = view.getUint8(byteOff);
                  const mi = view.getUint8(byteOff + 1);
                  const hi = view.getInt8(byteOff + 2);
                  f32[i] = ((hi << 16) | (mi << 8) | lo) / 0x800000;
                } else {
                  f32[i] = view.getInt16(byteOff, true) / 32768;
                }
              }

              // 4. Create AudioBuffer and schedule gaplessly
              if (sampleCount > 0) {
                const buf = ctx.createBuffer(1, sampleCount, sampleRate);
                buf.copyToChannel(f32, 0);
                const src = ctx.createBufferSource();
                src.buffer = buf;
                src.connect(ctx.destination);

                // nextTime per port — schedules chunks back-to-back without gaps
                const now = ctx.currentTime;
                const portKey = String(port);
                const nextTime = i2sNextScheduledTimeRef.current[portKey] ?? now;
                const startAt = Math.max(now, nextTime);
                src.start(startAt);
                i2sNextScheduledTimeRef.current[portKey] = startAt + buf.duration;
              }
            } catch (i2sErr) {
              // Silently swallow — audio errors should not crash the simulation
              console.warn("[I2S] Web Audio playback error:", i2sErr);
            }

            // LOG ONLY: record to protocol panel
            if (protocolAnalyzerRef.current?.processI2S) {
              if (protocolAnalyzerRef.current) {
                const log = protocolAnalyzerRef.current.processI2S(msg);
                pendingProtocolLogsRef.current.push(log.message);
              }
            }
          }
          // ── END I2S AUDIO ─────────────────────────────────────────────────────

          // ── Batch-flush all pending protocol log entries to the panel ─────────
          const PROTOCOL_EVENT_TYPES = new Set([
            "protocol:i2c", "protocol:spi",
            "SERIAL_OUTPUT", "GPIO_SYNC", "PWM_SYNC",
            "LEDC_SYNC", "DAC_SYNC", "esp32:dac:sync",
            "esp32:adc:sync", "TONE", "esp32:uart:rx",
            "TWAI_TX", "RMT_PULSE", "PCNT_UPDATE",
            "sim:sleep", "sim:wake",
            "I2S_AUDIO",  // I2S PCM audio frames from sim_i2s_write
          ]);
          if (
            (PROTOCOL_EVENT_TYPES.has(msg.type) ||
              (msg.type === "state" && msg.neopixels && Object.keys(msg.neopixels).length > 0)) &&
            !protocolLogsTimerRef.current
          ) {
            protocolLogsTimerRef.current = setTimeout(() => {
              protocolLogsTimerRef.current = null;
              const pending = pendingProtocolLogsRef.current;
              if (pending.length === 0) return;
              pendingProtocolLogsRef.current = [];

              // Limit batch to prevent dropping frames
              const batch = pending.length > 200 ? pending.slice(-200) : pending;

              setProtocolLogs((prev) => {
                const next = [...prev, ...batch];
                return next.length > 200 ? next.slice(-200) : next;
              });
            }, 150);
          }

}
