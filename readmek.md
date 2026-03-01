#  OpenHW-Studio: React Frontend

> **Role:** The visually interactive UI serving as a lightweight render client for the Universal Simulator.

---

##  Key Integrations

*   **Simulator Service API**
    *   Utilizes a clean Axios wrapper (`simulatorService.js`) to pipe editor code to the background compilation cluster.
*   **Run/Stop State Transitions**
    *   **Run:** Triggers background compilation, awaits `.hex` generation, and initiates a secure `ws://localhost:8085` emulator handshake.
    *   **Stop:** Gracefully terminates the `wsRef` connection socket and safely garabage-collects the background CPU process.
*   **Dynamic Visual Rendering**
    *   Processes rapid JSON pin updates (60 FPS) streamed down the WebSocket.
    *   Intercepts state mutations to dynamically re-evaluate visual styles.
    *   Causes connected `wokwi-elements` custom HTML tags (like LEDs) to power on or off in exact sync with backend logic.
*   **Universal NeoPixel Support (Matrix & LED Ring)**
    *   Dynamic sizing engine maps exact pin interaction hitboxes (`-8`, `-16`, `-12`, `-24` suffixes) to rendering geometry for precise wiring alignments.
    *   Component palette includes four presets: **NeoPixel 8×8**, **NeoPixel 16×16**, **LED Ring (12)**, and **LED Ring (24)**.
    *   Uses a **ref-based rendering** approach to call `element.setPixel(row, col, {r,g,b})` directly on the Wokwi DOM element — unlike simple LEDs which use HTML attributes.
    *   Sends NeoPixel wiring topology (component ID, Arduino pin, matrix size) to the emulator in the WebSocket `START` message.
    *   Validation rules actively warn when DIN or GND pins are not connected on any NeoPixel node.
*   **Wokwi Component Glitches Fixed**
    *   Discovered an inherent UI bug where Wokwi LEDs evaluate the `value="0"` attribute as truthy.
    *   Overhauled the `getComponentStateAttrs` engine so the `value` property is actively injected or deleted from the DOM based on physical voltage rules.



