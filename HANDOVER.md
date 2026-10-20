# HANDOVER — OpenHW Studio: board engines, unified-gateway networking, coverage

Date: 2026-10-20. Read this first, then `OpenHW-studio-frontend/matrix.md` (the
board×protocol source of truth) and `agent.md` (lane contract).

This file tells you where the work stands, what is proven, how to run things,
and what NOT to do. It is written for an agent picking the work up cold.

---

## 1. The one-paragraph state

Every board engine (Pico, ESP32, STM32F4, F1, micro:bit, retro) now runs its
peripheral model in WASM and talks to a single Go **unified gateway**
(`openhw-unified-gateway`, `ws://127.0.0.1:5030/api/network-gateway`) for
networking. The old in-emulator WiFi/IP stack (picow-net, wifi-ap component,
the frontend Network Worker) is **deleted**. Networking is proven live for
Pico W, Pico-ETH, Pico 2 W, Pico 2 ETH, ESP32, ESP32-CAM and F407/407VE/429.
What is *not* proven is broad: many peripheral columns are still NONE, and the
ESP32-CAM 2-board LAN cell is flaky. Engines are consumed from the owner's
local folders in dev (vite aliases) while npm-shaped specifiers stay in the
source, so the future npm flip is a one-file change.

---

## 2. Repos and branches (all ours; only `md` is pushed)

| Repo | Path | Branch | Remote |
|---|---|---|---|
| Frontend | `OpenHW-studio-frontend/` | `md` | github.com/OpenHW-Studio/OpenHW-studio-frontend |
| Emulator | `openhw-studio-emulator/` | `md` | github.com/OpenHW-Studio/openhw-studio-emulator |
| Backend | `openhw-studio-backend/` | `md` | github.com/OpenHW-Studio/openhw-studio-backend |
| Docs | `openhw-studio-docs/` | `main` is the pushed trunk (`md` is stale) | github.com/OpenHW-Studio/openhw-studio-docs |
| Gateway | `openhw-unified-gateway/` | `main` (pushed) | github.com/OpenHW-Studio/openhw-studio-gateway |
| Autowiring crate | `openhw-studio-autowiring/` | **NO GIT — see §9** | — |

**Rule: only `md` (and the gateway's `main`, the docs' `main`) get pushed.**
Lane branches are local, merged by the integrator.

---

## 3. Start the stack (after any reboot — it happens)

```bash
podman start mongodb                                   # backend DB
cd openhw-studio-backend && (setsid nohup npm start > /tmp/backend.log 2>&1 &)
cd OpenHW-studio-frontend && (setsid nohup npm run dev -- --port 5173 --host 127.0.0.1 > /tmp/vite-dev.log 2>&1 &)
cd openhw-unified-gateway && (setsid nohup ./openhw-gw > /tmp/gateway.log 2>&1 &)   # :5030
node /tmp/host-http-8092.mjs &                         # :8092 "hello-openhw\n" (HTTP cells)
```

Health: `curl -s localhost:5000/api/health`, `curl -s -o /dev/null -w '%{http_code}' localhost:5173/`
(200), `curl -s -o /dev/null -w '%{http_code}' 127.0.0.1:5030/` (404 = alive),
`curl -s 127.0.0.1:8092/`.

The gateway needs the DNS-lease fix and the room-aware `.1` ARP arbitration —
rebuild with `go build -o openhw-gw .` from `openhw-unified-gateway` (its `main`
carries both). HTTP cells REQUIRE the host server on `:8092` (the gateway NAT
maps guest dst `10.150.211.85` → host `127.0.0.1:8092`).

---

## 4. Engines: where the bytes come from

Dev resolves engines from the **owner's local folders** via `resolve.alias` in
`OpenHW-studio-frontend/vite.config.js` (the single resolution point):

| Engine | Dev source (folder) | Notes |
|---|---|---|
| pico-emu | `~/Documents/rp2350/Pico-emu/web/` | glue+wasm are a matched pair from one build |
| esp32-emu | `~/Documents/"esp32 emu"/dist/sab/` | folder `dist/` == npm 1.2.0 bytes |
| stm32f4-emu | **npm** (`stm32f4-emu@1.6.x`) | the owner folder is mid-rebuild — keep npm until they land |
| stm32f1-emu | npm + `public/vendor/board-engines/stm32f1-emu/pkg/` mirror | dev/deploy byte alignment being fixed in `lane/net-f1` |
| microbit | `src/wasm/autowiring`-style copy in `public/vendor/board-engines/microbit/` | engine pair mirrored; the runner bundles `src/worker/engines/microbit/` |

**Rules (violating these breaks boards):**
1. **glue and .wasm must come from the SAME build.** A mixed pair misbinds
   exports (e.g. `malloc→undefined`, then an OOB trap). Never mix a folder
   glue with an npm wasm or vice versa.
2. **Engine repos are READ-ONLY** for us — `rp2350/Pico-emu`, `"stm32 F4"`,
   `"stm32 emu blue pill"`, `"esp32 emu"`. Another agent is actively making
   those engines faster. Do NOT create worktrees there, do NOT check out
   branches, do NOT run cargo/wasm-pack inside them, do NOT edit them.
   If you need an engine change: deliver it as a **patch file** in your lane
   (or a copy outside the engine repo + a diff in your report) and let the
   owner apply it.
3. Deploy uses `public/vendor/board-engines/<engine>/` (git-tracked, carries
   OpenHW patches). If dev and deploy must match, mirror the bytes — do not
   clobber the patches (esp32 `node:crypto` stub, SAB TextDecoder copy,
   `mosiLog` cap, Dallas).
4. The npm endgame (publish engines → flip aliases back to bare specifiers) is
   the user's action. Checklist in the npm lane report; the alias flip is a
   small edit in `vite.config.js`.

---

## 5. Unified gateway: what it is and what it does

`openhw-unified-gateway` (Go). One binary for every board.

- Endpoint: `ws://127.0.0.1:5030/api/network-gateway?sessionId=<room>`
  (`sessionId` = room; missing → random isolated room). Also
  `/api/ble-gateway`, `/api/thread-gateway`.
- Binary WS message = **raw Ethernet frame** (`dst[0:6] src[6:12] ethertype-BE[12:14]`).
  Text WS message = control: `BOARD_IP:<ip>`, `PORT_FORWARD:`, `UDP_FORWARD:`,
  `STACOUNT:`, `RESET`.
- VN profile: `192.168.4.0/24`, gateway `192.168.4.1`, DHCP + gVisor DNS/NAT.
- **Two fixes live on `main`:** DHCP leases advertise the resolver
  `192.168.4.1` (plus `8.8.8.8` fallback) — so guests resolve DNS without
  host internet egress; and room-aware ARP arbitration for `.1` (a room whose
  member claims `.1` as a soft AP keeps the gateway from stealing that ARP —
  this is what made SoftAP-hosted servers reachable).
  Trade-off: in such a room the gateway's own `.1` services (incl. the
  resolver) are unreachable from that room.
- Frontend side: `src/worker/net/gateway-link.ts` (`GatewayLink`) — one WS per
  board runner, pre-open backlog, `BOARD_IP` → live-OOP telemetry.
  `GATEWAY_DEFAULT_URL` honours `VITE_GATEWAY_URL` (or the alias
  `VITE_NET_GATEWAY_URL`) so a lane can point at its own gateway instance.

---

## 6. What is PROVEN (live E2E, green) — with the cell that proves it

**Pico (M0+)**: WiFi join+DHCP `pico-wifi-gateway` · 2-board LAN TCP
`pico-wifi-lan` · guest SoftAP serve/join + TCP both directions
`pico-wifi-ap-serve` / `-ap2` / `-ap` · HTTP through NAT `pico-http-gateway` ·
DNS `pico-wifi-dns` · W5500 DORA `pico-eth-gateway` · IPv6 SLAAC (RA-OK)
`pico-ping6-gateway`.
**Pico 2 (M33)**: DHCP `pico2-w-wifi-gateway` / `pico2-eth-gateway` · LAN TCP
`pico2-w-lan` · SoftAP `pico2-w-ap2` · HTTP `pico2-w-http-gateway` /
`pico2-eth-http-gateway` · ETH LAN `pico2-eth-lan`.
**ESP32**: WiFi join+DHCP `esp32-wifi-gateway` (SCAN n=1, STATUS=3, IP). The old
RED was a **host-side wedge**: the runner's stats poll busy-spun on
`CMD_GET_WIFI_STATS`, which the worker never services while `RUN=1` → the board
worker froze (fixed inline in the vendor mirror; engine proposal on engine
branch `wifi-fix@a0684ef`).
**ESP32-CAM**: DHCP `esp32-cam-wifi-gateway` · LAN `esp32-cam-lan` (**FLAKY**:
the 2nd board sometimes never joins) · HTTP `esp32-cam-http-gateway`.
**STM32F4**: ETH DORA on F407 `stm32f4-eth-gateway`, 407VE `-ve`, 429 `-429` ·
HTTP via NAT `stm32f4-http-gateway` · IWDG + HASH (FIPS vectors) + pace in
`stm32f4-sys` / `stm32f4-clock`.
**micro:bit v2**: UART RX `microbit-uart-rx` · SAADC `microbit-saadc` · PWM0
`microbit-pwm` · base cells `microbit-cells`.

---

## 7. What is NOT proven (the honest gap list)

- **ESP32-CAM 2-board LAN** — flaky: server side completes, client stops
  after `CCLI-BEGUN` (the 2nd ESP32 never comes alive). Prior fixes: CMD-flood
  gate + RUN re-post (`9a0a7968`), per-board MAC attr (`01e24802`).
- **W6300 boards** (pico-w6300 / pico-w6300-2) — runner path + DORA proof in
  flight (`lane/net-6300`); no W6300 board shells exist yet.
- **W5500 INTn/GPIO21 interrupt path** — the ETH cells are polled; the
  interrupt-driven variant is unproven (in flight).
- **F407**: DMA, GPIO-in, RTC, CAN-2.0, I2S(2/3), 1-Wire, MicroPython NONE;
  LTDC/DCMI/QSPI/FSMC/SAI are "proven F429-only" (engine supports F407 — no
  cell). Coverage lane in flight (`lane/f4-cov`).
- **Pico family**: USB-DEV, 1-Wire, I2S, GPIO-in, EEPROM, SD, IR, Camera on
  M0+; PIO/DMA too on M33. Coverage lane in flight (`lane/pico-cov`).
- **ESP32-CAM**: I2C, SPI, ADC, PWM/LEDC, DMA, GPIO-in, 1-Wire, DHT-RMT, TWAI,
  I2S, MicroPython, SD-SPI, Touch, Display-ext. Coverage lane in flight
  (`lane/esp32-cov`).
- **Pico 2 RV32**: nearly nothing (tick + ping6 only).
- **Engine-side asks** (deliver as patches, never in place): F4 HASH
  (`patches/README-f4-hash.md` + 2 patches in the frontend repo: `HASH_CR.INIT`
  bit, `HASH_SR` W1C semantics, SHA-256 `HR4` mirror, completion interrupt);
  esp32 `scanNetworks()` hang; pico `softAPConfig` ignored / `live=0` DHCP
  stall / W5500 explicit-MAC breaking peer ARP / busy-spin starving the lwIP
  pump; esp32 `CMD_GET_WIFI_STATS` (already on engine `wifi-fix@a0684ef`).
- F1: dev resolves npm while deploy serves the owner's 19:31 bytes
  (`d1e69c28`) — alignment in flight (`lane/net-f1`).

---

## 8. How to work here (the discipline that keeps results trustworthy)

1. **One worktree per agent**, one branch, one dev-server port, one gateway
   room. Never share a worktree with another agent; never work in the main
   tree except to merge.
   ```bash
   git -C OpenHW-studio-frontend worktree add ../sim-<name> -b lane/<name> md
   ln -s <abs>/OpenHW-studio-frontend/node_modules ../sim-<name>/node_modules
   cp OpenHW-studio-frontend/.env ../sim-<name>/.env
   cd ../sim-<name> && cp vite.config.js vite.agent.config.js && cp playwright.config.js playwright.agent.config.js
   # set server.port + strictPort in vite.agent.config.js, baseURL in playwright.agent.config.js
   (setsid nohup npx vite --config vite.agent.config.js --host 127.0.0.1 > /tmp/vite-<name>.log 2>&1 &)
   ```
   Ports in use: 5173 main · 5174–5185 lanes · pick the next free one.
2. **Tests**: `export TMPDIR=$PWD/.tmp-vitest TEMP=$PWD/.tmp-vitest TMP=$PWD/.tmp-vitest`
   and `npx playwright test --config=playwright.agent.config.js <spec> --workers=1`.
   Serial only. The box is shared and cells are pace-fragile: **re-run a failing
   cell once serially before calling it red.**
3. **Never edit any file while a cell runs** — vite full-reloads the page and
   kills the cell with "execution context was destroyed". That is an
   environment artifact, not a product failure.
4. `.tmp-vitest/` and `playwright-report/` are gitignored; keep them out of
   commits. `public/version.json` is rewritten by every build — revert it.
5. **Assert observed facts**, never a firmware self-report of the thing under
   test (the guest's own "OK" print is not proof; the *other* side's observed
   bytes are). Use wall-rate-independent assertions (guest-time steps) where
   the fact is about time.
6. **Update `OpenHW-studio-frontend/matrix.md` immediately** for anything you
   prove: FULL only with a cell as evidence, PARTIAL with the reason, NONE +
   why. The matrix is the contract; the docs repo mirrors the gap files.
7. Commit on your branch, never push `md`, never merge into `md` yourself —
   the integrator does that and pushes.

---

## 9. Open decisions for the user

- **The autowiring crate has no version control** (`openhw-studio-autowiring/`
  is not a git repo). Recommendation: host it as
  `OpenHW-Studio/openhw-studio-autowiring`, track `Cargo.lock`, enable its
  CI workflow (native tests + wasm build + manifest-freshness gate + wasm
  bundle gate). It is now patched in place (manifest-driven `pins_generated.rs`
  + alias/reserved-pin fixes) and the frontend gates are live and green.
- Engines must be published to npm before the alias flip can happen; the F4
  owner folder must land first.

---

## 10. Command cheat-sheet

```bash
# unit suite (expect 140/140; ~11 "unhandled errors" are node-side noise from
# folder-aliased engines booting in vitest — pre-existing, not test failures)
cd OpenHW-studio-frontend && npx vitest run
# build
npm run build
# autowiring gates (both must pass)
npm run check:autowiring-pins && npm run check:autowiring-wasm
# one e2e cell (from your lane)
npx playwright test --config=playwright.agent.config.js tests/e2e/<file>.spec.js --workers=1
# gateway rebuild
cd openhw-unified-gateway && go build -o openhw-gw . && go test ./...
```

**Never `pkill -f <pattern>` that matches your own shell command** (it kills
the tool call). Kill by PID (`pgrep -x <name>`) instead.

---

## 11. Engine-owner asks, consolidated (for whoever talks to them)

- esp32-emu: merge `wifi-fix@a0684ef` (inline `CMD_GET_WIFI_STATS`); fix the
  blocking `scanNetworks()`; expose a per-board MAC (done on our side via a
  board attr); `getPcapData`/`sendTwaiFrame` still unwired.
- pico-emu: honor `WiFi.softAPConfig()`; fix the `live=0` DHCP stall; fix
  explicit per-board MAC breaking peer ARP (SHAR does not reach the vnet
  port); don't let a busy-spinning guest starve the lwIP pump; W6300 board
  entry in the arduino-pico core; `softAPConfig` before `beginAP` is a no-op.
- stm32f4-emu: apply the HASH patches (`patches/` in the frontend repo);
  expose `fault_pc`; keep the 42-MIPS warmed wasm paired with its glue; the
  owner folder is mid-rebuild (do not switch to it until they land).
- stm32f1-emu: the engine's IWDG window counts retired instructions (≈1000×
  shorter than silicon) — the cell now proves guest-time behaviour instead of
  assuming silicon timing.
