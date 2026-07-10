# OpenHW Studio Testing Architecture

Welcome to the unified testing directory for OpenHW Studio. To maintain a robust, scalable, and fast testing environment, we split our testing strategy into two distinct paradigms: **Unit Testing (Vitest)** and **End-to-End Testing (Playwright)**.

## 1. The Core E2E Workflow
Our primary integration test ensures that the entire stack (Frontend, Backend, and Canvas Rendering) works flawlessly together.

```mermaid
flowchart TD
    A[Start Simulator] --> B[Import Baseline PNG]
    B --> C[Export Untouched PNG]
    
    subgraph Pixel Verification
        C --> D{Strip Steganography}
        D --> E[Compare Pixels natively via Playwright]
    end
    
    E -- Match --> F[Quick Add Component (LED)]
    F --> G[Export Circuit as JSON]
    
    subgraph Data Verification
        G --> H{Parse JSON Metadata}
        H --> I[Assert LED Component Exists]
    end
    
    I --> J((Test Passed))
```

## 2. Tools & Philosophy

### **Vitest (Unit Testing)**
Vitest is a blazing-fast testing framework powered by Vite. We use Vitest specifically for **isolated logic testing**. If a function calculates wire routes, parses strings, or normalizes arrays, it should be tested here. Vitest runs in Node.js (with `jsdom` for React components) and does not spin up a real browser, making it capable of running hundreds of tests in milliseconds.
* **Command:** `npx vitest run`

### **Playwright (End-to-End Testing)**
Playwright is a full browser automation tool. We use Playwright for **user journey testing**. Playwright spins up a real Chromium browser, physically clicks on the canvas, handles real network requests to the backend, and validates actual pixel rendering. It is slower, but it proves the application actually works for end users.
* **Command:** `npx playwright test`

## 3. Directory Map & File Names

All tests have been centralized into this folder. 

### `tests/e2e/` (Playwright)
* `core-workflow.spec.ts`: The master User Journey test (mapped in the diagram above) that imports, exports, matches pixels, and validates JSON data.
* `console-error-check.spec.js`: Scans the application pages to ensure no console errors are thrown during load.
* `page-validation.spec.js`: A master crawler that validates routing across the entire app.
* `autofix-preview.spec.js`: E2E test specifically for the Autofix Preview Panel UI.

### `tests/unit/` (Vitest)
* `components/AutofixPreviewPanel.test.jsx`: Unit tests the React component rendering and props for the repair panel.
* `utils/wireRouting.test.js`: Validates the complex collinear point simplification algorithms for circuit wires.
* `worker/protocol-compliance.test.mjs`: Tests the raw data compliance and routing logic for the UART/Serial protocols.
* `scripts/exportUtils.test.js`: Validates the pure functions that serialize the shadow DOM and edit copy payloads.
