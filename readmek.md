# 🎨 OpenHW-Studio: React Frontend

> **Role:** The visually interactive UI serving as a lightweight render client for the Universal Simulator.

---

## 🚀 Key Integrations

*   **Simulator Service API**
    *   Utilizes a clean Axios wrapper (`simulatorService.js`) to pipe editor code to the background compilation cluster.
*   **Run/Stop State Transitions**
    *   **Run:** Triggers background compilation, awaits `.hex` generation, and initiates a secure `ws://localhost:8085` emulator handshake.
    *   **Stop:** Gracefully terminates the `wsRef` connection socket and safely garabage-collects the background CPU process.
*   **Dynamic Visual Rendering**
    *   Processes rapid JSON pin updates (60 FPS) streamed down the WebSocket.
    *   Intercepts state mutations to dynamically re-evaluate visual styles.
    *   Causes connected `wokwi-elements` custom HTML tags (like LEDs) to power on or off in exact sync with backend logic.
*   **Wokwi Component Glitches Fixed**
    *   Discovered an inherent UI bug where Wokwi LEDs evaluate the `value="0"` attribute as truthy.
    *   Overhauled the `getComponentStateAttrs` engine so the `value` property is actively injected or deleted from the DOM based on physical voltage rules.

---
*Generated for the Universal Emulator Integration.*
