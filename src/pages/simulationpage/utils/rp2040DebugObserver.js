import { normalizeBoardKind } from "./hardwareUtils";

/**
 * RP2040 worker-debug domain, extracted verbatim from SimulatorPage.jsx
 * handleRun > worker.onmessage.
 * (rp2040-runtime tick/startup-fallback/UART-silence/dbg-line,
 *  wifi_status + wifi_pcap, rp2040-wireless-stub.)
 *
 * Pure function of (msg, ctx); all canvas/worker state flows through ctx
 * refs + setters. Dedup signatures preserved verbatim
 * (rp2040DebugLastLogRef / rp2040WirelessLastLogRef maps).
 * Verify via Pico run + Pico-W wireless Playwright checks.
 */
export function handleRp2040DebugMessage(msg, ctx) {
  const {
    boardComponents,
    components,
    appendConsoleEntry,
    logSerial,
    rp2040UartMicroPythonBoardsRef,
    rp2040UartSilentWarnedBoardsRef,
    rp2040DebugLastLogRef,
    rp2040WirelessLastLogRef,
    liveOopStatesRef,
    notifyLiveOopStateListeners,
  } = ctx;
          if (msg.type === "debug" && msg.category === "rp2040-runtime") {
            const incomingBoardId = String(msg.boardId || "").trim();
            const hasKnownBoard =
              incomingBoardId &&
              boardComponents.some((b) => b.id === incomingBoardId);
            const singleBoardFallback =
              boardComponents.length === 1 ? boardComponents[0]?.id : "";
            const resolvedBoardId = hasKnownBoard
              ? incomingBoardId
              : singleBoardFallback || incomingBoardId || "default";

            const metrics = msg.metrics || {};
            const reason = String(msg.reason || "tick");
            const pc = Number(metrics.pc);
            const sp = Number(metrics.sp);
            const gp20 = !!metrics.gp20;
            const gp25 = !!metrics.gp25;
            const tx = Number(metrics.serialTxBytes || 0);
            const rx = Number(metrics.serialRxBytes || 0);
            const inq = Number(metrics.serialInputQueue || 0);
            const cycles = Number(metrics.cycles || 0);
            const steps = Number(metrics.stepCount || 0);
            const stall = Number(metrics.pcStallTicks || 0);
            const running = !!metrics.running;
            const entry =
              metrics.entry && typeof metrics.entry === "object"
                ? metrics.entry
                : null;
            const ledId = String(metrics.ledId || "").trim();
            const ledOn =
              typeof metrics.ledOn === "boolean" ? metrics.ledOn : null;
            const ledAnodeV = Number.isFinite(Number(metrics.ledAnodeV))
              ? Number(metrics.ledAnodeV)
              : null;
            const ledCathodeV = Number.isFinite(Number(metrics.ledCathodeV))
              ? Number(metrics.ledCathodeV)
              : null;
            const ledDeltaV = Number.isFinite(Number(metrics.ledDeltaV))
              ? Number(metrics.ledDeltaV)
              : null;
            const primask = !!metrics.primask;
            const stepsSinceLastEmit = Number(metrics.stepsSinceLastEmit || 0);

            const pcHex = Number.isFinite(pc)
              ? `0x${(pc >>> 0).toString(16)}`
              : "n/a";
            const spHex = Number.isFinite(sp)
              ? `0x${(sp >>> 0).toString(16)}`
              : "n/a";
            const entryVectorHex = Number.isFinite(Number(entry?.vectorBase))
              ? `0x${(Number(entry.vectorBase) >>> 0).toString(16)}`
              : "n/a";
            const entryResolvedHex = Number.isFinite(Number(entry?.resolvedPC))
              ? `0x${(Number(entry.resolvedPC) >>> 0).toString(16)}`
              : "n/a";

            const debugBoardComp =
              components.find((c) => c.id === resolvedBoardId) ||
              boardComponents.find((b) => b.id === resolvedBoardId);
            const isRp2040DebugBoard =
              normalizeBoardKind(debugBoardComp?.type || "") === "rp2040";
            const startupFallbackEntry =
              reason === "start" && !!entry?.usedFallback;
            if (startupFallbackEntry && isRp2040DebugBoard) {
              appendConsoleEntry(
                "warn",
                `RP2040 startup vector fallback detected on ${resolvedBoardId}; automatic recovery is disabled in deterministic mode.`,
                "simulator",
              );
              logSerial(
                `RP2040 startup fallback on ${resolvedBoardId}. Automatic recovery is disabled in deterministic mode.`,
                "var(--orange)",
              );
            }

            const isUartMicroPythonBoard =
              rp2040UartMicroPythonBoardsRef.current.has(resolvedBoardId);
            const queueDrained = inq <= 0;
            const shouldWarnUartSilent =
              reason === "tick" &&
              isUartMicroPythonBoard &&
              tx === 0 &&
              rx >= 512 &&
              (queueDrained || rx >= 2048) &&
              stall >= 3 &&
              cycles >= 120_000_000 &&
              !rp2040UartSilentWarnedBoardsRef.current.has(resolvedBoardId);

            if (shouldWarnUartSilent) {
              rp2040UartSilentWarnedBoardsRef.current.add(resolvedBoardId);
              appendConsoleEntry(
                "warn",
                `RP2040 MicroPython UART injection appears silent on ${resolvedBoardId} (tx=0, rx=${rx}, inq=${inq}, stall=${stall}). Check script startup logs and wiring.`,
                "simulator",
              );
              logSerial(
                `RP2040 ${resolvedBoardId}: UART injection is silent (tx=0, rx=${rx}, inq=${inq}). Verify script startup and board wiring.`,
                "var(--orange)",
              );
            }

            const prev =
              rp2040DebugLastLogRef.current.get(resolvedBoardId) || null;
            const now = Date.now();
            const changed =
              !prev ||
              prev.pcHex !== pcHex ||
              prev.gp20 !== gp20 ||
              prev.gp25 !== gp25 ||
              prev.tx !== tx ||
              prev.rx !== rx ||
              prev.ledOn !== ledOn ||
              prev.ledDeltaV !== ledDeltaV ||
              reason !== "tick";

            const highPins = Array.isArray(metrics.highPins)
              ? metrics.highPins
              : [];
            const highPinsLabel =
              highPins.length > 0
                ? `${highPins.slice(0, 12).join(",")}${highPins.length > 12 ? ",+" : ""}`
                : "-";
            const pinBitmap =
              typeof metrics.pinBitmap === "string" ? metrics.pinBitmap : "";

            if (changed || now - (prev?.ts || 0) > 2500) {
              const line = [
                `RP2040 dbg ${resolvedBoardId}`,
                `reason=${reason}`,
                `run=${running ? "1" : "0"}`,
                `pc=${pcHex}`,
                `sp=${spHex}`,
                `cyc=${cycles}`,
                `steps=${steps}`,
                `gp20=${gp20 ? "H" : "L"}`,
                `gp25=${gp25 ? "H" : "L"}`,
                `uart=${metrics.activeUart ?? "n/a"}`,
                `usb=${metrics.usbCdcReady ? "1" : "0"}`,
                `tx=${tx}`,
                `rx=${rx}`,
                `inq=${inq}`,
                `stall=${stall}`,
                Number.isFinite(Number(metrics.lastRunLoopMs))
                  ? `loop=${Number(metrics.lastRunLoopMs).toFixed(2)}ms`
                  : "",
                Number.isFinite(Number(metrics.lastPhysicsMs))
                  ? `phys=${Number(metrics.lastPhysicsMs).toFixed(2)}ms`
                  : "",
                Number.isFinite(Number(metrics.lastComponentUpdateMs))
                  ? `comp=${Number(metrics.lastComponentUpdateMs).toFixed(2)}ms`
                  : "",
                `pri=${primask ? "1" : "0"}`,
                `dSteps=${stepsSinceLastEmit}`,
                `high=${highPinsLabel}`,
                pinBitmap ? `pins=${pinBitmap}` : "",
                entry
                  ? `entry=${entryVectorHex}->${entryResolvedHex}${entry.usedFallback ? ":fallback" : ""}${entry.strategy ? `:${entry.strategy}` : ""}`
                  : "",
                entry && Number.isFinite(Number(entry.probe0100SP))
                  ? `probe0100=sp:0x${(Number(entry.probe0100SP) >>> 0).toString(16)},pc:0x${(Number(entry.probe0100PC) >>> 0).toString(16)}`
                  : "",
                entry && Number.isFinite(Number(entry.probe0000SP))
                  ? `probe0000=sp:0x${(Number(entry.probe0000SP) >>> 0).toString(16)},pc:0x${(Number(entry.probe0000PC) >>> 0).toString(16)}`
                  : "",
                ledId
                  ? `led=${ledId}:${ledOn === null ? "n/a" : ledOn ? "on" : "off"}`
                  : "",
                ledAnodeV !== null ? `vA=${ledAnodeV.toFixed(2)}` : "",
                ledCathodeV !== null ? `vK=${ledCathodeV.toFixed(2)}` : "",
                ledDeltaV !== null ? `dV=${ledDeltaV.toFixed(2)}` : "",
                metrics.lastGpioPin ? `lastPin=${metrics.lastGpioPin}` : "",
              ]
                .filter(Boolean)
                .join(" | ");

              const warn = reason === "fault" || stall > 180;
              appendConsoleEntry(warn ? "warn" : "info", line, "debug");
              rp2040DebugLastLogRef.current.set(resolvedBoardId, {
                ts: now,
                pcHex,
                gp20,
                gp25,
                tx,
                rx,
                ledOn,
                ledDeltaV,
              });
            }

            return;
          }
          // ── Network Worker: real WiFi stack status (from dedicated network worker) ──
          if (msg.type === 'wifi_status') {
            const resolvedBoardId = String(msg.boardId || '').trim() || 'default';
            const status = String(msg.status || 'idle');
            const ssid = String(msg.ssid || '');
            const ip = String(msg.ip || '');
            const packets = Number(msg.packetCount || 0);
            const connected = status === 'connected' || status === 'got_ip';

            liveOopStatesRef.current[resolvedBoardId] = {
              ...(liveOopStatesRef.current[resolvedBoardId] || {}),
              wirelessMode: 'full',
              wirelessStatus: status,
              wirelessConnected: connected,
              wirelessSsid: ssid,
              wirelessIp: ip,
              wirelessPackets: packets,
            };
            notifyLiveOopStateListeners(resolvedBoardId);

            // Log status changes to console (deduplicated)
            const sig = `${status}:${ssid}:${ip}`;
            const lastSig = rp2040WirelessLastLogRef.current.get(resolvedBoardId);
            if (lastSig !== sig) {
              rp2040WirelessLastLogRef.current.set(resolvedBoardId, sig);
              const emoji = status === 'got_ip' ? '🌐' : status === 'connected' ? '📶' : '📡';
              appendConsoleEntry(
                connected ? 'info' : 'warn',
                `${emoji} Pico W WiFi [${resolvedBoardId}] status=${status} ssid=${ssid || '-'} ip=${ip || '-'} packets=${packets}`,
                'debug',
              );
            }
            return;
          }
          // ── Network Worker: PCAP file download ────────────────────────────────────
          if (msg.type === 'wifi_pcap') {
            const boardId = String(msg.boardId || 'board');
            const data = msg.data instanceof ArrayBuffer ? new Uint8Array(msg.data) : null;
            if (data) {
              let binary = '';
              for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
              const url = `data:application/vnd.tcpdump.pcap;base64,${btoa(binary)}`;
              const a = document.createElement('a');
              a.href = url;
              a.download = `picow_${boardId}.pcap`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              appendConsoleEntry('info', `📥 PCAP downloaded: picow_${boardId}.pcap (${data.length} bytes)`, 'simulator');
            }
            return;
          }
          if (msg.type === 'debug' && msg.category === 'rp2040-wireless-stub') {
            const incomingBoardId = String(msg.boardId || '').trim();
            const hasKnownBoard = incomingBoardId && boardComponents.some((b) => b.id === incomingBoardId);
            const singleBoardFallback = boardComponents.length === 1 ? boardComponents[0]?.id : '';
            const resolvedBoardId = hasKnownBoard
              ? incomingBoardId
              : singleBoardFallback || incomingBoardId || "default";

            const wireless =
              msg.wireless && typeof msg.wireless === "object"
                ? msg.wireless
                : {};
            const mode = String(wireless.mode || "compat-stub");
            const status = String(
              wireless.status || (mode === "off" ? "off" : "booting"),
            );
            const connected = !!wireless.connected;
            const ssid = String(wireless.ssid || "");
            const ip = String(wireless.ip || "");
            const note = String(wireless.note || "");

            liveOopStatesRef.current[resolvedBoardId] = {
              ...(liveOopStatesRef.current[resolvedBoardId] || {}),
              wirelessMode: mode,
              wirelessStatus: status,
              wirelessConnected: connected,
              wirelessSsid: ssid,
              wirelessIp: ip,
              wirelessNote: note,
            };
            notifyLiveOopStateListeners(resolvedBoardId);

            const signature = `${mode}:${status}:${connected ? "1" : "0"}:${ssid}:${ip}`;
            const lastSignature =
              rp2040WirelessLastLogRef.current.get(resolvedBoardId);
            if (lastSignature !== signature) {
              const line = [
                `Pico W wireless ${resolvedBoardId}`,
                `mode=${mode}`,
                `status=${status}`,
                `connected=${connected ? "1" : "0"}`,
                `ssid=${ssid || "-"}`,
                `ip=${ip || "-"}`,
                note,
              ]
                .filter(Boolean)
                .join(" | ");
              appendConsoleEntry(
                connected || status === "off" ? "info" : "warn",
                line,
                "debug",
              );
              rp2040WirelessLastLogRef.current.set(resolvedBoardId, signature);
            }
            return;
          }

}
