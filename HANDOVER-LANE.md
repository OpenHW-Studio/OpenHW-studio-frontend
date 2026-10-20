# HANDOVER — lane/engine-bytes (build un-break + engine bytes pinned in-repo)

**Lane worktree:** `/home/danish1075/Documents/simulator/sim-engine-bytes` ·
**branch:** `lane/engine-bytes` (from `md` @ `fc7bebf0`)
**Lane port:** 5186 (own vite cache `.vite-cache-enginebytes`) — never touch
:5173 or the other lanes.
**Rule for this lane:** the engine repos (`rp2350/Pico-emu`, `esp32 emu`,
`stm32 F4`, `stm32 emu blue pill`) are **READ-ONLY** — another agent is actively
rebuilding them. Deliver engine changes as patch files, never in place.

## 1. Mission

1. **Un-break the build.** `npm run build` was RED: `vite.config.js` aliased
   pico-emu + esp32-emu to absolute owner-folder paths, and the owner's
   `esp32 emu/dist/` was deleted mid-session → `ENOENT` on
   `worker-proxy.js`. In CI/Docker those folders do not exist at all, so the
   deploy build was broken too, and the built Pico wasm asset carried an
   absolute owner path.
2. **Pin every engine's bytes in this repo** (the F1 pattern, applied to all
   engines) so dev, the CI/Docker build and the runtime `/vendor` fallback
   read the SAME files.
3. **Close the matrix gap** the pico-cov lane left open (its rows were never
   written) and remove a committed merge-conflict marker from `matrix.md`.
4. Re-measure the **ESP32-CAM 2-board LAN** cell with the committed bytes.

## 2. Status

| item | result |
|---|---|
| `npm run build` | **GREEN** (was RED: ENOENT on the esp32 worker-proxy) |
| owner paths in `dist/` | none (the absolute-path hazard is gone) |
| `pico-usb` (M0+ + M33) | **2/2 green** — `USBCDC_ECHO:P` ×6, sink `enumState:active rxCount:6` |
| `esp32-wifi-gateway` | **green** — `STATUS=3`, `IP=192.168.4.5` |
| `esp32-cam-lan` | **2 of 3 green** — still flaky (see §5) |
| `matrix.md` | conflict marker removed; Pico rows, USB row, system table and "Next to prove" updated |

## 3. What changed (branch `lane/engine-bytes`)

| path | what |
|---|---|
| `src/engines/pico-emu/{picoemu.wasm.js,picoemu.wasm.wasm,README.md}` | NEW — the Pico engine's matched glue+wasm pair, committed (md5 c3b784f0 / 0c74dffe, byte-equal to the owner's build of 2026-10-08) + provenance + refresh recipe |
| `src/engines/esp32-emu/dist/sab/{worker-proxy.js,worker-entry.js,README.md}` | NEW — the ESP32 SAB entry points, committed (md5 3c5c1866 / 4afe24dd = the OpenHW-patched bytes: node:crypto stub, inline `CMD_GET_WIFI_STATS` + `CMD_GET_TWAI_TX` service while RUN=1) |
| `vite.config.js` | the pico + esp32 aliases now point at `src/engines/…`; `OPENHW_ENGINE_FROM=owner` opts back into the owner's live folders for engine work (never in CI) |
| `matrix.md` | conflict marker `>>>>>>> a7d38f0b` (line 190) removed; Pico PIO/DMA/EEPROM/USB-DEV → FULL with the lane's evidence; the engine-blocked columns → NONE **with the reason**; "Pico USB device" connectivity row → FULL; the system/crypto Pico row (WDT/EXTI/Sleep/Hash/Clocks) updated; "Next to prove" rewritten; the DEPLOY BUILD HAZARD note marked resolved |
| `HANDOVER.md` | §1/§4/§7/§10 updated (engine bytes are repo-committed; build green; the F1 alignment item closed; the ESP32-CAM measurement) |
| `HANDOVER-LANE-esp32cov.md` | the esp32-cov lane's handover, cherry-picked from `lane/esp32-cov` (it was only on a stale branch) |
| `tests/e2e/esp32-cam-lan-diag.spec.js`, `patches/esp32-cov-diag-probe.patch`, `scripts/warm-vite-cache.mjs` | cherry-picked from `lane/esp32-cov` (the ESP32-CAM diagnosis tooling — it would otherwise have been lost with the deleted worktree) |

**No runner/engine source file was touched** — the change is resolution-level
only, so the runtime behaviour of every board is unchanged.

## 4. Repro (this lane)

```bash
W=/home/danish1075/Documents/simulator/sim-engine-bytes; cd $W
# node_modules is a SYMLINK — never npm install/ci here
cp vite.config.js vite.agent.config.js 2>/dev/null   # port 5186 + own cacheDir
cp playwright.config.js playwright.agent.config.js 2>/dev/null   # baseURL 5186, webServer undefined
(setsid nohup npx vite --config vite.agent.config.js --host 127.0.0.1 > /tmp/vite-enginebytes.log 2>&1 &)
TMPDIR=$PWD/.tmp-vitest TEMP=$PWD/.tmp-vitest TMP=$PWD/.tmp-vitest \
  npx playwright test --config=playwright.agent.config.js tests/e2e/<spec>.spec.js --workers=1 --reporter=line
```

**Warm the dep cache before the first cell** — otherwise vite's first
`optimized dependencies changed. reloading` kills the cell with "execution
context was destroyed" (the documented environment artifact, not a product
failure). Either load the page once by hand, or run the cell twice and treat
the first result as the warm-up.

## 5. Findings

1. **The build was RED for a non-obvious reason.** The ESP32 owner folder was
   rebuilt mid-session and its `dist/` disappeared, so the vite alias
   pointed at a missing file → `npm run build` failed. The Pico alias was
   "only" a deploy hazard (the build embedded an absolute owner path for the
   wasm asset, so the deployed Pico would have 404'd on its engine).
2. **The repo already carried every byte that was needed.** The Pico glue
   (`public/vendor/board-engines/pico-emu/picoemu.wasm.js`) and wasm
   (`public/wasm/picoemu.wasm.wasm`) were already committed and byte-equal
   to the owner's folder; the ESP32 SAB pair was already committed in the
   runtime-fallback mirror. The fix was therefore a **resolution change**,
   not new bytes — nothing was invented.
3. **The committed ESP32 bytes are BETTER than the owner's folder bytes.**
   They carry the inline `CMD_GET_WIFI_STATS` / `CMD_GET_TWAI_TX` service
   while `RUN=1` (the "OPENHW MIRROR PATCH (wifi-stats wedge fix)"). The
   owner's `dist/` copy at the time of the last rebuild did not — which is
   exactly what the esp32-cov lane diagnosed as the cause of the ESP32-CAM
   LAN flakiness (the proxy busy-spins per CMD; an unserviced CMD wedges
   the board worker's UART drain).
4. **The ESP32-CAM LAN cell is still flaky: 2 of 3 runs green** (2026-10-20,
   committed bytes). Two distinct signatures:
   - the client stops after `CCLI-BEGUN` (the documented wedge signature),
   - the **server never joins** (`CSRV-STATUS=3` missing) — a new signature
     seen in run 3; not yet explained, so the cell stays FLAKY, not FULL.
   Next step for a successor: run `tests/e2e/esp32-cam-lan-diag.spec.js`
   (dumps the full serial + per-board counters) and
   `patches/esp32-cov-diag-probe.patch` (per-board byte counters at parent
   ingest / post / main receive) to find which side stops draining.
5. **A merge-conflict marker was committed into `matrix.md` on `md`**
   (`>>>>>>> a7d38f0b …`, line 190, from the W6300 merge). Removed here.

## 6. Left / must-not-do

* **Left:** the ESP32-CAM LAN flakiness (see §5.4); the "Next to prove" list
  in `matrix.md` is now the live queue (Pico IN-latch inject is the highest
  leverage engine ask — it unblocks GPIO-in + 1-Wire + IR + EXTI on BOTH
  Pico boards).
* **Do NOT** edit/build/commit/checkout anything in an engine repo.
* **Do NOT** `npm install`/`npm ci` in the lane (node_modules is a symlink);
  do not touch the main worktree or the other lanes; do not restart backend
  :5000 / gateway :5030 / host :8092 / main vite :5173.
* **Do NOT** push `md` and do not merge into `md` yourself — the integrator
  does that.
* `npm run build` must stay green, and `public/version.json` (rewritten by
  every build) must be reverted before committing.

## 7. Pointers

Global handover: `/home/danish1075/Documents/simulator/HANDOVER.md` (and
`OpenHW-studio-frontend/HANDOVER.md` on `md`). Lane handovers:
`HANDOVER-LANE-pico.md` (Pico coverage), `HANDOVER-LANE-f4.md` (F4 coverage),
`HANDOVER-LANE-esp32cov.md` (ESP32-CAM diagnosis, cherry-picked here).
Engine contract: `vendor/emulator-hook-specs/pico-emu.md`.
