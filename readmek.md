# ⚙️ OpenHW-Studio: Universal Emulator Backend

> **Role:** A high-speed WebSocket Node.js server that runs the simulated CPU environment for the platform.

---

##  Key Integrations

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
*   **WS2812 NeoPixel Protocol Decoder**
    *   Accepts NeoPixel wiring topology (component ID, Arduino pin, matrix dimensions) from the frontend at simulation start.
    *   Maps Arduino pin names (e.g., `D6`) to AVR port addresses and bit masks via `getPinPortMapping()`.
    *   Intercepts port write hooks and decodes WS2812 bit-bang timing: `HIGH > 10 cycles = bit 1`, `LOW > 800 cycles = reset/flush`.
    *   Accumulates 24-bit GRB color bytes per pixel, converts to RGB floats, and stores in `neopixelState`.
*   **Hardware Servo Motor PWM Emulation**
    *   Since generic memory port hooks (`writeHooks`) do not fire when hardware timers automatically pull pins `HIGH`/`LOW` (like Arduino's `Servo.h` library), the emulator utilizes a high-frequency polling loop running natively against the `pinStates` boolean stream.
    *   Tracks the exact delta in `cpu.cycles` between rising (`true`) and falling (`false`) edges of a PWM signal.
    *   Linearly filters `durationInCycles` (bypassing delay noise) and maps standard RC pulse bounds (between `8704` and `38400` cycle ticks) to strict `0-180` degree floating angles.
    *   Aggregates positions into an internal `servoState` map, pushing telemetry directly into the WebSocket's 60fps `{ type: "state", servos: ... }` JSON payload.
*   **Real-time Output Streaming**
    *   Executes a continuous, non-blocking `setImmediate` instruction loop.
    *   Broadcasts serialized JSON state payloads (e.g., `{"type": "state", "pins": {"D13": true}}`) at ~60 FPS.
*   **Repository Hygiene**
    *   Includes a comprehensive `.gitignore` preventing generated `out.txt` arrays and module dependencies from polluting version control.

---

##  Recent Bug Fixes: The `delay()` & Continuous Glow Issue

We recently resolved a major physics bug where the simulated LED would continuously glow instead of blinking, and `delay()` commands were ignored. The following fixes were applied to `server.js`:

1.  **Fixed CPU Execution Speed:** The `runSimulation` loop was previously using `setImmediate` to run as fast as Node.js allowed, completing a 1000ms delay in less than a millisecond. We implemented a real-time synced `deltaTime` calculation to strictly limit execution to **16,000 cycles per real-time millisecond** (simulating a 16MHz clock).
2.  **Fixed Write Hooks Blocking:** The memory interceptors (`cpu.writeHooks`) for the IO pins were previously ending with `return true;`, which in `avr8js` means "cancel this memory write". This broke internal state tracking. They now correctly `return false;`.
3.  **Enabled Hardware Timers:** The Arduino `delay()` and `millis()` functions rely on internal hardware timers ticking. We explicitly imported `timer0Config`, `timer1Config`, and `timer2Config` and instantiated them with `new AVRTimer()` inside the CPU context. We also added `cpu.tick()` to the execution loop to physically advance these timers alongside the CPU instructions.

*Generated for the Universal Emulator Integration.*

