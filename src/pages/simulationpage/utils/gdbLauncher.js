/**
 * GDB launcher, extracted verbatim from SimulatorPage.jsx (handleStartGDB).
 *
 * Behavior contract: identical console lines, identical
 * http://localhost:3333 session URL (wokwi-gdbserver). Verify via GDB
 * button Playwright check.
 */
export function launchGdbSession({ appendConsoleEntry }) {
  appendConsoleEntry("info", "Connecting to GDB Session...", "simulator");
  // Note: requires backend running wokwi-gdbserver (e.g. gdbserver.js) on port 3333
  appendConsoleEntry(
    "info",
    "Opening local GDB session on http://localhost:3333...",
    "simulator",
  );
  window.open("http://localhost:3333", "_blank");
}
