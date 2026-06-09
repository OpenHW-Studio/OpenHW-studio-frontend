# OpenHW Client-Side ESP32 Emulator Suite

This folder contains the tools and modules to extract, package, and run Wokwi's client-side ESP32 and ESP32-C3 simulation engine directly in the browser, eliminating the need for a server-side QEMU VM session.

## Architecture (Phase 1)

Wokwi's simulation engine is built as highly optimized Next.js Webpack chunks.
Rather than attempting to manually de-obfuscate and rewrite 1.5MB+ of minified Xtensa/RISC-V CPU interpreter and peripheral bus code (which is extremely prone to manual parsing and logical errors), we implement a **custom mock Webpack loader bridge**.

```
 722.864146eac3ab9dc8.js  ──┐
                            ├──► unpack.cjs (Mock Webpack Bridge) ──► esp32-engine.js (Clean ES6 Module)
 626-f7e6f3fd2bcfb77a.js  ──┘
```

1. **`unpack.cjs`** mocks Webpack's global chunk registry (`globalThis.webpackChunk_N_E`).
2. It executes Wokwi's minified chunks, catching the registration of core simulation modules (`50722`, `11882`).
3. It initializes a mini, self-contained `__webpack_require__` execution runtime that resolves cross-module dependencies natively.
4. It exports a beautiful, unified ES6 file (`esp32-engine.js`) containing:
   - `ESP32` (Xtensa Emulator Suite)
   - `ESP32C3` (RISC-V Emulator Suite)
   - `SimulationClock`
   - `Memory` & `MemoryTranslator`
   - `XtensaCore` & `RV32Core`

---

## Files in this Folder

- **`unpack.cjs`**: Script to execute the Webpack bridge and bundle the standalone ES6 engine.
- **`test-harness.html`**: A visual browser-based testing arena to boot the ESP32-C3 AT firmware locally in javascript and monitor the serial monitor output in real-time.
- **`esp32-engine.js`**: The generated client-side simulation library (built after running `unpack.cjs`).
