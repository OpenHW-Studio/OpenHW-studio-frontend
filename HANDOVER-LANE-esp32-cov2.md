# HANDOVER — lane/esp32-cov2 (ESP32 / ESP32-CAM coverage)

Worktree `/home/danish1075/Documents/simulator/sim-esp32-cov2`, branch `lane/esp32-cov2`,
port **5176**. Helper `/tmp/lane-run.sh 5176 <spec>`. Predecessor handover:
`HANDOVER-LANE-esp32cov.md` (§5 diagnose of the LAN join race, §6 TODO list).

Rules: one cell at a time via the helper, commit after every green cell, append one
line here after every cell. Never `npm install`/`npm run build`/`npx vitest run`.
Kill leftover browsers by PID (`pgrep -x chrome`).

## Log

- (start) HEAD `8f5fb6a4`; stack up (vite :5173, backend :5000, host :8092; gw :5030 root 404 = alive).
- LAN run 1/3 GREEN (5.3m): CSRV-STATUS=3 CSRV-IP=192.168.4.20 CCLI-STATUS=3 CCLI-IP=192.168.4.21
  CSRV-RX:HELLO-LAN CSRV-ECHOED CCLI-RX:ECHO:HELLO-LAN CCLI-CONN:1 CCLI-LAN-DONE
  (CSRV-WAIT:0:st=6 -> CSRV-STATUS=3 on the join-wait loop; RXAT 13155 / ECHOAT 13156 guest ms).
