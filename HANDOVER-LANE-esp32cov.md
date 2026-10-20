# HANDOVER — lane/esp32-cov (ESP32-CAM coverage + 2-board join race)

**Lane worktree:** `/home/danish1075/Documents/simulator/sim-esp32-cov` · **branch:** `lane/esp32-cov` (from `md`)
**Rule for this lane:** engine repo `/home/danish1075/Documents/esp32 emu` is READ-ONLY (another agent is
rebuilding it: `dist/` was deleted mid-session). Do not edit/commit/build there.

## 1. Mission

Two goals: (a) make the 2-board ESP32-CAM LAN join race deterministic (server+client both join one gateway
room), (b) add real protocol proof cells for the `openhw-esp32-cam` board (I2C/SPI/ADC/PWM/1-Wire/TWAI/Touch…).

## 2. Status

- **DONE — root cause of the 2-board race FOUND and MEASURED** (see §5). Not yet fixed (fix needs engine-side
  change, §6).
- **DONE — diagnostic harness + reusable probe patch** committed (`patches/esp32-cov-diag-probe.patch`).
- **NOT STARTED — the cam-board protocol cells** (I2C/SPI/ADC/PWM/1-Wire/TWAI/Touch/GPIO-in/SD-SPI/MicroPython).
  No cell was written yet; `matrix.md` row `openhw-esp32-cam` is unchanged.
- **NOT STARTED — cam-FQBN probe** (`esp32:esp32:esp32cam` exists in the installed core — confirm + prove).
- **IN PROGRESS — 3× green LAN re-run** (required by the DoD) not done: the cell is still flaky in this lane
  because the engine bytes dev loads lack the fix (§5.3).

## 3. Repro commands (exact)

```bash
cd /home/danish1075/Documents/simulator/sim-esp32-cov

# dev server (port 5183; vite.agent.config.js = vite.config.js + port + own cacheDir)
(setsid nohup npx vite --config vite.agent.config.js --host 127.0.0.1 > /tmp/vite-cam.log 2>&1 &)

# tests
export TMPDIR=$PWD/.tmp-vitest TEMP=$PWD/.tmp-vitest TMP=$PWD/.tmp-vitest
npx playwright test --config=playwright.agent.config.js tests/e2e/esp32-cam-lan.spec.js --workers=1
npx playwright test --config=playwright.agent.config.js tests/e2e/esp32-cam-lan-diag.spec.js --workers=1
```

- Gateway room ids used: `netcamlan1` (the real cell), `camdiag1` (my diag twin).
- Shared services (do NOT restart): backend :5000, gateway :5030, host HTTP :8092, main vite :5173.
- **Warm the vite dep-optimizer first** or the first cell dies: `node scripts/warm-vite-cache.mjs http://127.0.0.1:5183/simulator 4`.
  Reason: `node_modules` is a symlink to the shared tree, so the default dep cache is SHARED with other lanes →
  their re-optimize triggers a full page reload mid-cell. `vite.agent.config.js` sets `cacheDir: '.vite-cache-esp32cov'`
  for this lane; the warm script exists because the FIRST load in a fresh cache still re-optimizes once.

## 4. Files created / changed in this lane

| Path | What it does |
|---|---|
| `tests/e2e/esp32-cam-lan-diag.spec.js` | Diagnostic twin of `esp32-cam-lan.spec.js`: same 2-board code, but dumps full serial, per-board ingest counters and the whole console log to `/tmp/diag-console.log`. Use it to see WHICH board stalls. |
| `patches/esp32-cov-diag-probe.patch` | Reusable instrumentation patch (runner CMD-timing probe + per-board byte counters at parent ingest / parent post / main-thread receive). `git apply` it to re-instrument; `git checkout -- .` to revert. Apply clean against `md`. |
| `scripts/warm-vite-cache.mjs` | Warms this lane's vite dep cache so no cell is killed by a mid-run reload. |
| `vite.agent.config.js`, `playwright.agent.config.js` | Lane copies: port 5183, baseURL :5183, own `cacheDir`. Not committed (gitignored? no — see §7). |

Nothing in `src/` is modified on the branch (probes live in the patch file, not applied).

## 5. Findings (the 2-board join race)

### 5.1 Symptom (reproduced ~2 of 5 runs)
Server board completes; client board prints `CCLI-START`, `CCLI-CONFIG-OK`, `CCLI-BEGUN` and then **nothing** —
`CCLI-STATUS=3` / `CCLI-IP=` never appear, so the needle `CCLI-LAN-DONE` is missing.
Fail verdict: `serial missing needle: CCLI-LAN-DONE`.

### 5.2 The client guest was ALIVE — only the host-side UART path died
Gateway log for the failing run shows the client MAC `246f28000022` doing a full ARP + TCP handshake and the
server printing `CSRV-RX:HELLO-LAN` / `CSRV-ECHOED` — i.e. the CLIENT GUEST ran `WiFi.begin()`, joined, connected
and sent HELLO-LAN. The guest was fine. What stopped is the HOST reading the client's UART bytes.

Measured with the probe (run 3, failing):
- parent ingest per board froze at `cam_cli:337` while `cam_srv` kept growing to `380`; main-thread received the same.
- client runner `queued=0` (no pending bytes) but `emitted` stopped advancing ⇒ **the board worker stopped draining UART**.
- The client's guest kept running because the ESP32 engine free-runs in its own thread — the guest surviving while
  the host is silent is the signature of a **wedged host worker thread**, not a dead guest.

### 5.3 Root cause (confirmed in the engine, upstream already fixed on a branch)
`esp32-emu/dist/sab/worker-proxy.js` **busy-spins** for every engine CMD:
`Atomics.store(RESP, IDLE); Atomics.store(CMD, X); notify(); while (load(RESP) === IDLE) {}`.
The engine only services a **fixed allow-list of CMDs inline inside `runSimChunk`** while `SAB_RUN=1`;
`commandLoop` (which handles the rest) never runs during a run. Any CMD outside that list ⇒ the proxy spins forever.

`CMD_GET_WIFI_STATS` and `CMD_GET_TWAI_TX` are **not** in the folder engine's inline list
(`grep -c "SAB_CMD) === CMD_GET_WIFI_STATS"` = 0 in the allow-list region), and the ESP32 runner calls
`getWifiStats()` from `pollNetStats()` (every 2 s after the first UART flow) and `getTwaiTx()` from the TWAI
observer — so a board worker **wedges on its first such call** and never drains UART again.

**Upstream confirmation:** the engine's own branch `wifi-fix` commit `a0684ef`
*"Serve CMD_GET_WIFI_STATS inline while RUN=1 (fixes host-side worker wedge)"* — its message describes exactly my
symptom: *"no UART drained, guest running unwatched — the ESP32 WiFi cell's silent-RED signature."*
The fix extracts `doGetWifiStats()` and services the CMD inline in `runSimChunk`.

### 5.4 Why this lane still flakes: dev loads the FOLDER engine, and it is mid-rebuild
- The repo's **vendor mirror** `public/vendor/board-engines/esp32-emu/dist/sab/worker-entry.js` (303881 B)
  **already carries the fix** (1 inline `CMD_GET_WIFI_STATS` block, "OPENHW MIRROR PATCH (wifi-stats wedge fix)").
- The **owner folder** `/home/danish1075/Documents/esp32 emu/dist/sab/worker-entry.js` (295009 B) does **NOT**
  (0 inline blocks) — and **`dist/` was deleted entirely during my session** (another agent rebuilding it).
- `importEngine()` is vendor-first at runtime, but the vite alias
  `{ find: 'esp32-emu/dist/sab/worker-proxy.js', replacement: esp32Folder + '/worker-proxy.js' }` points dev at the
  FOLDER. The served `/vendor/.../worker-entry.js` was byte-identical to the vendor mirror (fix present), so at the
  time of my runs the fix WAS being served — yet the wedge still occurred, so **an additional unfixed CMD is being
  requested that the vendor inline list also lacks** (most likely `CMD_GET_TWAI_TX`, whose inline block exists in the
  vendor but the FOLDER source lacks; the folder's `dist/` is the stale artifact). **This must be re-measured once the
  engine's `dist/` is rebuilt — do not trust my inference here, re-run the diag and read `_diag.pending`.**

### 5.5 Not the cause (ruled out by measurement)
- Not a shared CMD slot between the two boards: each board has its own `SimulatorWorker` + SAB (`init()` allocates
  `ctrlSab` per instance). The two engines do not share a CMD slot.
- Not the gateway room: the client joined the room and completed the TCP handshake (§5.2).
- Not the "client not re-posted RUN": the guest demonstrably ran (HELLO-LAN reached the server).
- Not boot ordering / boot race: both boards boot their ROM banner fine; the stall is post-boot.

## 6. What is left to do (and how)

1. **Re-measure which CMD wedges**, now that the engine `dist/` is being rebuilt:
   `git apply patches/esp32-cov-diag-probe.patch`, run the diag cell, read `_diag.pending` / `_diag.calls` in
   `/tmp/diag-console.log` (the probe logs the last CMD entered but never exited → that is the wedged one).
2. **Fix the wedge.** Two options:
   - *engine-side* (preferred, matches upstream `a0684ef`): add the missing CMD to the inline allow-list in
     `runSimChunk` (upstream did `CMD_GET_WIFI_STATS`; `CMD_GET_TWAI_TX` is the likely remaining one). Engine repo is
     read-only for me → deliver as a patch file in this lane + diff in the report; the frontend owner applies it.
   - *frontend-side* (works without touching the engine): in `esp32-runner.ts`, stop calling the un-serviceable CMDs
     while the engine is running — e.g. gate `pollNetStats()` / the TWAI observer on the engine being idle, or drop
     `getTwaiTx()` from the TWAI observer. The engine exposes `SAB_SLOT_WIFI_STATE` (15) and the TX/RX frame counters
     as plain SAB reads (`get wifiState()`, `wifiTxFrames`, `wifiRxFrames` on the proxy) — those need **no CMD** and can
     replace `getWifiStats()` entirely for netUp/netIp purposes.
3. **Prove the LAN cell 3× green** once fixed (DoD requirement). Serial evidence to assert:
   `CSRV-STATUS=3`, `CSRV-IP=192.168.4.20`, `CCLI-STATUS=3`, `CCLI-IP=192.168.4.21`, `CSRV-RX:HELLO-LAN`, `CCLI-RX:ECHO:HELLO-LAN`.
4. **Cam-board protocol cells** (not started). Copy the proven plain-ESP32 patterns
   (`tests/e2e/esp32-i2c.spec.js`, `esp32-spi.spec.js`, `esp32-adc.spec.js`, `esp32-pwm.spec.js`, `esp32-dht22.spec.js`,
   `esp32-twai.spec.js`, `esp32-touch.spec.js`, `esp32-gpio-in.spec.js`, `esp32-sdspi.spec.js`, `esp32-cam-sdspi.spec.js`)
   but with board type `openhw-esp32-cam` + the cam preset. The cam board shell lacks pins 21/22 and 25/26
   (matrix note) → 1-Wire/TWAI/Touch/GPIO-in must be marked ABSENT with that reason, not invented.
   Pin map for the cam board: `src/worker/registries/component-registry.ts` → `'openhw-esp32-cam'` pins
   `5V.1 GND.1 12 13 15 14 2 4 3V3 16 0 GND.2 VCC 3 1 GND.3`.
5. **Cam FQBN**: `esp32:esp32:esp32cam` exists in the installed core but the backend maps `openhw-esp32-cam` →
   `esp32:esp32:esp32` (generic). Confirm whether the backend can select the cam FQBN; if yes, prove a cell on it.
6. **matrix.md**: flip the `openhw-esp32-cam` row cells from NONE to FULL/PARTIAL/NONE-with-reason to match the
   proofs actually obtained. Do NOT claim a cell that was not run green.

## 7. What a successor MUST NOT do

- **Do not edit any file while a cell is running** — vite full-reloads and kills the cell mid-run (this bit me 3×:
  "Execution context was destroyed, most likely because of a navigation").
- **Do not run `npm install` / `npm ci`** — `node_modules` is a symlink to the shared tree; never install there.
- **Do not edit/build/commit the engine repo** (`/home/danish1075/Documents/esp32 emu`) — read-only, and another agent
  is mid-rebuild (`dist/` is currently missing → the vite alias `esp32Folder` points at a non-existent path!).
- **Do not kill the shared services** (backend :5000, gateway :5030, host :8092, main vite :5173) or other lanes'
  vite servers. (`pkill -f "vite.agent.config.js --host 127.0.0.1"` kills EVERY lane's server — I did that by mistake
  and had to restart sim-pico-cov:5184 and sim-f4-cov:5185.)
- **Do not use the default vite dep cache** — it is shared via the symlinked `node_modules`; use this lane's
  `cacheDir: '.vite-cache-esp32cov'` and warm it before the first cell.
- Re-run a failing cell once serially before calling it red (shared box, pace-fragile).

## 8. Pointers

- Global handover: `/home/danish1075/Documents/simulator/HANDOVER.md` and
  `/home/danish1075/Documents/simulator/OpenHW-studio-frontend/HANDOVER.md` (on `md`). This file supplements them.
- Engine hook specs (read-only contract): `OpenHW-studio-frontend/vendor/emulator-hook-specs/esp32-emu.md`.
- Matrix: `OpenHW-studio-frontend/matrix.md`, row `openhw-esp32-cam` (line ~90) + the ESP32-CAM proof notes (~167).
- Engine upstream fix branch: `wifi-fix` commit `a0684ef` in `/home/danish1075/Documents/esp32 emu`.
