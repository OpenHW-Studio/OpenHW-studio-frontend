/**
 * RP2040 GDB/SPI debug domain, extracted verbatim from SimulatorPage.jsx
 * handleRun > worker.onmessage.
 * (rp2040-gdb signature-dedup console lines; rp2040-spi detail lines
 *  gated on rp2040DebugTelemetryEnabled.)
 *
 * Pure function of (msg, ctx); dedup flows through
 * ctx.rp2040GdbLastLogRef. Identical level mapping (error/closed -> warn)
 * and identical SPI field order. Verify via Pico GDB + SPI run checks.
 */
export function handleRp2040GdbSpiMessage(msg, ctx) {
  const {
    boardComponents,
    rp2040GdbLastLogRef,
    rp2040DebugTelemetryEnabled,
    appendConsoleEntry,
  } = ctx;
          if (msg.type === "debug" && msg.category === "rp2040-gdb") {
            const incomingBoardId = String(msg.boardId || "").trim();
            const hasKnownBoard =
              incomingBoardId &&
              boardComponents.some((b) => b.id === incomingBoardId);
            const singleBoardFallback =
              boardComponents.length === 1 ? boardComponents[0]?.id : "";
            const resolvedBoardId = hasKnownBoard
              ? incomingBoardId
              : singleBoardFallback || incomingBoardId || "default";

            const gdb = msg.gdb && typeof msg.gdb === "object" ? msg.gdb : {};
            const status = String(gdb.status || "unknown");
            const reason = String(msg.reason || status);
            const detail = String(gdb.detail || gdb.lastError || "").trim();
            const signature = `${reason}:${status}:${detail}`;
            const lastSignature =
              rp2040GdbLastLogRef.current.get(resolvedBoardId);

            if (lastSignature !== signature) {
              const line = [
                `RP2040 GDB ${resolvedBoardId}`,
                `status=${status}`,
                `reason=${reason}`,
                detail,
              ]
                .filter(Boolean)
                .join(" | ");

              const level =
                status === "error" || status === "closed" ? "warn" : "info";
              appendConsoleEntry(level, line, "debug");
              rp2040GdbLastLogRef.current.set(resolvedBoardId, signature);
            }
            return;
          }
          if (msg.type === "debug" && msg.category === "rp2040-spi") {
            const incomingBoardId = String(msg.boardId || "").trim();
            const hasKnownBoard =
              incomingBoardId &&
              boardComponents.some((b) => b.id === incomingBoardId);
            const singleBoardFallback =
              boardComponents.length === 1 ? boardComponents[0]?.id : "";
            const resolvedBoardId = hasKnownBoard
              ? incomingBoardId
              : singleBoardFallback || incomingBoardId || "default";

            const spi = msg.spi && typeof msg.spi === "object" ? msg.spi : {};
            const reason = String(msg.reason || "spi");
            const bus = String(spi.bus || "spi?");
            const byte = Number(spi.byte ?? Number.NaN);
            const byteIndex = Number(spi.byteIndex ?? Number.NaN);
            const frameBytes = Number(spi.frameBytes ?? Number.NaN);
            const deviceCount = Number(spi.deviceCount || 0);
            const txBytes = Number(spi.txBytes || 0);
            const txTransactions = Number(spi.txTransactions || 0);
            const deviceIds = Array.isArray(spi.deviceIds)
              ? spi.deviceIds.join(",")
              : "";
            const framePreview = Array.isArray(spi.framePreview)
              ? spi.framePreview
                .slice(0, 8)
                .map((v) => `0x${Number(v).toString(16).padStart(2, "0")}`)
                .join(",")
              : "";
            const command = Number.isFinite(Number(spi.command))
              ? `cmd=0x${Number(spi.command).toString(16).padStart(2, "0")}`
              : "";
            const powerOn =
              spi.powerOn === undefined ? "" : `powerOn=${spi.powerOn ? 1 : 0}`;
            const writeCount = Number.isFinite(Number(spi.writeCount))
              ? `writeCount=${Number(spi.writeCount)}`
              : "";
            const fill = Number.isFinite(Number(spi.vramFillPercentage))
              ? `fill=${Number(spi.vramFillPercentage)}`
              : "";
            const role = spi.role ? `role=${String(spi.role)}` : "";
            const boardPin = spi.boardPin
              ? `boardPin=${String(spi.boardPin)}`
              : "";
            const componentPin = spi.componentPin
              ? `pin=${String(spi.componentPin)}`
              : "";
            const isHigh =
              spi.isHigh === undefined ? "" : `isHigh=${spi.isHigh ? 1 : 0}`;
            const voltage = Number.isFinite(Number(spi.voltage))
              ? `voltage=${Number(spi.voltage).toFixed(1)}`
              : "";
            const buses = Array.isArray(spi.buses)
              ? `buses=${spi.buses.join(",")}`
              : "";

            const line = [
              `RP2040 SPI ${resolvedBoardId}`,
              `reason=${reason}`,
              `bus=${bus}`,
              Number.isFinite(byte)
                ? `byte=0x${byte.toString(16).padStart(2, "0")}`
                : "",
              Number.isFinite(byteIndex) ? `index=${byteIndex}` : "",
              Number.isFinite(frameBytes) ? `frameBytes=${frameBytes}` : "",
              `devices=${deviceCount}`,
              `txBytes=${txBytes}`,
              `txFrames=${txTransactions}`,
              command,
              powerOn,
              writeCount,
              fill,
              role,
              boardPin,
              componentPin,
              isHigh,
              voltage,
              buses,
              framePreview ? `preview=${framePreview}` : "",
              deviceIds ? `ids=${deviceIds}` : "",
            ]
              .filter(Boolean)
              .join(" | ");

            if (rp2040DebugTelemetryEnabled) {
              appendConsoleEntry("info", line, "debug");
            }
            return;
          }

}
