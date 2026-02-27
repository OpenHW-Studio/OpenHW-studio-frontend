# ⚙️ OpenHW-Studio: Universal Emulator Backend

> **Role:** A high-speed WebSocket Node.js server that runs the simulated CPU environment for the platform.

---

## 🚀 Key Integrations

*   **WebSocket Architecture**
    *   Operates an independent high-speed `ws` server on port `8085`.
    *   Decoupling the CPU from the React frontend guarantees extreme performance scalability.
*   **AVR Core Integration (`avr8js`)**
    *   Instantiates a virtual ATmega328P CPU in raw memory.
    *   Parses and injects incoming `.hex` machine code into the CPU buffer.
    *   Replaced deprecated timer routines with native `AVRTimer` execution loops to prevent crash states.
*   **Hardware Memory Hooks**
    *   Directly intercepts core I/O memory writes to track physical Arduino pins.
    *   Maps `PORTB (0x25)` to `D8-D13`, `PORTC (0x28)` to `A0-A5`, and `PORTD (0x2B)` to `D0-D7`.
    *   Accurately evaluates binary state shifts (e.g., matching PORTB Bit 5 to Pin D13).
*   **Real-time Output Streaming**
    *   Executes a continuous, non-blocking `setImmediate` instruction loop.
    *   Broadcasts serialized JSON state payloads (e.g., `{"type": "state", "pins": {"D13": true}}`) at ~60 FPS.
*   **Repository Hygiene**
    *   Includes a comprehensive `.gitignore` preventing generated `out.txt` arrays and module dependencies from polluting version control.

---
*Generated for the Universal Emulator Integration.*
