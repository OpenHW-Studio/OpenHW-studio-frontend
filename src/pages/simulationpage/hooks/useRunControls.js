import { useCallback } from "react";
import { SERIAL_LINE_ENDINGS } from "../constants/simulatorConstants";

/**
 * Run-controls domain, extracted verbatim from SimulatorPage.jsx.
 * (handlePause/handleResume/handleReset via worker postMessage,
 *  sendSerialInput w/ sim-worker vs hardware-WebSerial routing,
 *  per-board + global baud setters w/ live SERIAL_SET_BAUD.)
 *
 * Stable identities preserved verbatim ([] / full-dep arrays) — TopToolbox
 * and SerialMonitor memo on these. Hardware-TX failure alert copy kept
 * verbatim. Verify via pause/reset + serial-send + baud Playwright checks.
 */
export function useRunControls({
  workerRef,
  setIsPaused,
  setSerialHistory,
  isRunningRef,
  serialInput,
  serialLineEnding,
  isRunning,
  serialBoardFilter,
  serialBaudRate,
  pushSerialTxLine,
  hardwareConnected,
  hardwareSerialTargetRef,
  hardwareBoardId,
  sendHardwareSerialLine,
  setSerialInput,
  setBoardBaudRates,
  setSerialBaudRate,
}) {
    // Stable identities: passed to memoized TopToolbox + run controls. Read
    // live run state via refs so toolbar props never invalidate per render.
    const handlePause = useCallback(() => {
      if (workerRef.current) workerRef.current.postMessage({ type: "PAUSE" });
      setIsPaused(true);
    }, []);

    const handleResume = useCallback(() => {
      if (workerRef.current) workerRef.current.postMessage({ type: "RESUME" });
      setIsPaused(false);
    }, []);

    const handleReset = useCallback(() => {
      if (workerRef.current && isRunningRef.current) {
        workerRef.current.postMessage({ type: "RESET" });
        const now = new Date();
        const ts =
          now.toTimeString().slice(0, 8) +
          "." +
          String(now.getMilliseconds()).padStart(3, "0");
        setSerialHistory((prev) => [
          ...prev,
          { dir: "sys", text: "--- BOARD RESET ---", ts },
        ]);
      }
    }, []);

    const sendSerialInput = useCallback(
      (
        targetBoardOverride,
        inputOverride,
        lineEndingOverride,
        baudRateOverride,
      ) => {
        const txt = String(
          inputOverride !== undefined ? inputOverride : serialInput || "",
        );
        if (!txt.trim()) return;
        const lineEnding =
          SERIAL_LINE_ENDINGS[lineEndingOverride || serialLineEnding] ?? "\n";
        const payload = txt + lineEnding;

        const requestedBoard = targetBoardOverride || serialBoardFilter;
        const targetBoardId =
          requestedBoard !== "all" ? requestedBoard : undefined;

        const baudRate = baudRateOverride || serialBaudRate;

        if (workerRef.current && isRunning) {
          workerRef.current.postMessage({
            type: "SERIAL_INPUT",
            data: payload,
            targetBoardId,
            baudRate: baudRate,
          });
          pushSerialTxLine(txt, targetBoardId || "all", "sim");
          if (inputOverride === undefined) setSerialInput("");
          return;
        }

        if (hardwareConnected) {
          const targetBoard = targetBoardId
            ? targetBoardId
            : hardwareSerialTargetRef.current || hardwareBoardId || "hardware";
          sendHardwareSerialLine(payload, targetBoard, txt)
            .then(() => {
              if (inputOverride === undefined) setSerialInput("");
            })
            .catch((err) => {
              console.error("[WebSerial] TX failed:", err);
              alert(
                `Hardware serial write failed: ${err?.message || "Unknown error"}`,
              );
            });
          return;
        }

        alert("Run simulator or connect hardware serial before sending data.");
      },
      [
        serialInput,
        serialLineEnding,
        workerRef,
        isRunning,
        serialBoardFilter,
        serialBaudRate,
        pushSerialTxLine,
        hardwareConnected,
        hardwareBoardId,
        sendHardwareSerialLine,
        setSerialInput,
      ],
    );

    const updateBoardBaudRate = useCallback(
      (boardId, baud) => {
        setBoardBaudRates((prev) => ({ ...prev, [boardId]: baud }));
        if (workerRef.current && isRunning) {
          workerRef.current.postMessage({
            type: "SERIAL_SET_BAUD",
            targetBoardId: boardId !== "all" ? boardId : undefined,
            baudRate: baud,
          });
        }
      },
      [isRunning],
    );

    const updateGlobalBaudRate = useCallback(
      (baud) => {
        setSerialBaudRate(baud);
        if (workerRef.current && isRunning) {
          workerRef.current.postMessage({
            type: "SERIAL_SET_BAUD",
            baudRate: baud,
          });
        }
      },
      [isRunning],
    );


  return {
    handlePause,
    handleResume,
    handleReset,
    sendSerialInput,
    updateBoardBaudRate,
    updateGlobalBaudRate,
  };
}
