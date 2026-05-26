/**
 * esp32Worker.js  (src/esp32/worker/esp32Worker.js)
 * ─────────────────────────────────────────────────────────────────────────────
 * A lightweight Web Worker shim for ESP32 sessions.
 *
 * Instead of running firmware in-browser (like the AVR worker), this worker
 * simply acts as a message relay/interceptor that keeps track of
 * the current board target and delegates accordingly.
 *
 * How the main simulation.worker.ts calls it:
 *
 *   if (data.target === 'esp32') {
 *     handleESP32WorkerMessage(data, postMessage);
 *     return;
 *   }
 *
 * The main simulation worker file stays clean — it just checks the target.
 */

/**
 * Minimal in-worker state for the ESP32 WebSocket proxy.
 * The worker itself does NOT open a WebSocket — that stays on the main thread
 * via useHardwareSocket.  The worker just needs to:
 *  - Acknowledge START/STOP gracefully
 *  - Forward REMOTE_GPIO, SERIAL_INPUT messages back to main thread for
 *    the hook to relay over the real WS connection.
 *  - Route INTERACT events for virtual components.
 */

let esp32Target = false;

export function handleESP32WorkerMessage(data, postMessage) {
  switch (data.type) {
    case 'START':
      esp32Target = data.target === 'esp32';
      if (esp32Target) {
        // Acknowledge — the real WS session is managed on the main thread
        postMessage({ type: 'ESP32_WORKER_READY' });
      }
      break;

    case 'STOP':
      esp32Target = false;
      postMessage({ type: 'ESP32_WORKER_STOPPED' });
      break;

    case 'INTERACT':
      // Virtual button press / component event — forward to main thread
      // so the useHardwareSocket hook can send SET_GPIO over the WS.
      postMessage({
        type: 'ESP32_INTERACT',
        compId: data.compId,
        event: data.event,
        pin: data.pin,
        value: data.value,
      });
      break;

    case 'REMOTE_GPIO':
      // GPIO feedback from UI (e.g. a VirtualButton being held)
      postMessage({
        type: 'ESP32_GPIO_OUT',
        pin: data.pin,
        value: data.value,
      });
      break;

    case 'SERIAL_INPUT':
      // Serial data typed in the monitor — relay to main thread for WS
      postMessage({
        type: 'ESP32_SERIAL_IN',
        data: data.data,
      });
      break;

    default:
      break;
  }
}
