/**
 * src/esp32/index.js  —  Frontend ESP32 module barrel
 * ─────────────────────────────────────────────────────────────────────────────
 * Re-exports everything the main SimulatorPage needs to integrate ESP32 QEMU support.
 *
 * WARNING: The old file that was here contained backend (Node.js) code.
 * That code lives in openhw-studio-backend/src/esp32/index.js.
 * This file is the FRONTEND barrel only.
 */

// ── Hook ─────────────────────────────────────────────────────────────────────
export { useHardwareSocket } from './hooks/useHardwareSocket.js';

// ── Components ───────────────────────────────────────────────────────────────
export { default as SimulatorWorkspace } from './components/SimulatorWorkspace.jsx';
export { default as VirtualButton }      from './components/VirtualButton.jsx';
export { default as VirtualLED }         from './components/VirtualLED.jsx';
export { default as SerialMonitor }      from './components/SerialMonitor.jsx';

// ── Worker utilities ─────────────────────────────────────────────────────────
export { handleESP32WorkerMessage } from './worker/esp32Worker.js';
