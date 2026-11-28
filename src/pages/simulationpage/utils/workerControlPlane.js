/**
 * Worker control-plane domain, extracted verbatim from SimulatorPage.jsx
 * handleRun > worker.onmessage head.
 * (error -> console+serial+stop, toast, TEACHER_KEY_CAPTURE_COMPLETE ->
 *  grading-worker key bundle + download.)
 *
 * Pure function of (msg, ctx) except the dynamic grading-worker import
 * (kept inline so the chunk still splits identically). Returns true when
 * the message was fully handled (caller must `return`).
 * Verify via run-error + teacher-key Playwright checks.
 */
export async function handleWorkerControlMessage(msg, ctx) {
  const { appendConsoleEntry, logSerial, handleStop, setValidationToast } = ctx;
          if (msg.type === "error") {
            appendConsoleEntry(
              "error",
              `[SIM] ${msg.message || "Runner error"}`,
              "simulator",
            );
            logSerial(
              `Runner error: ${msg.message || "Unknown error"}`,
              "var(--red)",
            );
            handleStop();
            return true;
          }

          if (msg.type === "toast") {
            setValidationToast({
              level: msg.level || "info",
              message: msg.message,
            });
            return true;
          }

          if (msg.type === "TEACHER_KEY_CAPTURE_COMPLETE") {
            appendConsoleEntry("info", "Visual telemetry capture complete! Compiling WASM binary...", "simulator");

            // Spin up a temporary grading worker to bundle the WASM key
            const GradingWorker = (await import("../../../worker/grading-engine.worker.ts?worker")).default;
            const grader = new GradingWorker();

            grader.onmessage = (ge) => {
              const gMsg = ge.data;
              if (gMsg.type === 'KEY_GENERATED') {
                const blob = new Blob([gMsg.key], { type: "application/octet-stream" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                // Use the requested naming format: [board]_[component].bin
                anchor.download = `${msg.board}_${msg.component}.bin`;
                anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), 1500);
                appendConsoleEntry("info", `Teacher reference key downloaded: ${anchor.download}`, "simulator");
                grader.terminate();
              } else if (gMsg.type === 'LOG') {
                console.log("[Grader for TeacherKey]", gMsg.msg);
              }
            };

            grader.postMessage({
              type: 'GENERATE_KEY_FROM_TELEMETRY',
              projectJson: msg.projectJson,
              telemetry: msg.telemetry
            });
            return true;
          }

  return false;
}
