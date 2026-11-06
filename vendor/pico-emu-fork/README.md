# pico-emu jsmirror build — FIRST-PARTY (was: vendored fork)

Why: stock pico-emu 1.0.3 exposes no live I2C transaction channel
(buslog is dead code, VCD needs FS which the Module omits, GDB
watchpoints don't fire in the 1.0.3 build). Without it, Pico I2C
displays/sensors stay blank. The jsmirror SDD below adds one thing and
nothing else.

## Upstream source (first-party — the fork is retired)

- Source: `/home/danish1075/Documents/rp2350/Pico-emu` (commit `a47d098`; jsmirror applied in-tree: `src/sdd_jsmirror.c`, `src/sdd.c`, `include/sdd.h`, `build_wasm.sh`)
- The old `fork.patch` replay is obsolete — kept for history only.

## Fork diff (also saved as `fork.patch`, replayable onto the commit above)

1. `src/sdd_jsmirror.c` (new, saved here): a virtual I2C slave SDD that
   ACKs its addresses and mirrors every transaction into a pollable ring:
   `0x100|addr7` = START, `0x200` = STOP, `0x00..0xFF` = data byte.
   Reads return `0xFF` (same as unattached open-bus behavior today).
2. `src/sdd.c`: `jsmirror:i2c=B,addr=0x..[,addr=0x..…]` arg branch
   (single call batches all addresses — `sdd_add` resets per call).
3. `include/sdd.h`: `sdd_create_jsmirror()` declaration.
4. `build_wasm.sh`: `src/sdd_jsmirror.c` in SOURCES + 3 exports
   (`_picoemu_jsmirror_pending/drops/pop`).

## Rebuild recipe

```bash
cd /home/danish1075/Documents/rp2350/Pico-emu  # first-party source, jsmirror in-tree
docker run --rm -v $PWD:/mnt:z docker.io/emscripten/emsdk:3.1.50 \
  bash -c "cp -r /mnt /work && cd /work && source /emsdk/emsdk_env.sh \
  >/dev/null 2>&1 && bash build_wasm.sh && cp web/picoemu.wasm.js \
  web/picoemu.wasm.wasm /mnt/staging/"
```

(Copy-out matters: emcc's final copy2 with xattrs fails on the
bind mount; building container-local then copying out works.)

## Binaries in this repo

- `../../src/worker/engines/pico-emu-fork/picoemu.wasm.js` — fork glue
  (loaded by the Pico runner ONLY for runs owning I2C components;
  every other Pico run uses stock 1.0.3 untouched).
- `../../public/wasm/picoemu-fork.wasm.wasm` — fork binary (fetched
  explicitly by bytes; the glue's locateFile is overridden).

## Maintenance contract

- Stock pico-emu updates: re-apply `fork.patch` + rebuild. If upstream
  ever ships a JS I2C-tap export, drop this fork and use it.
- `sdd_add` resets the device registry per call: multi-address boards
  must batch in ONE `jsmirror:` call (the runner does this).
- Single-device I2C runs only for now: reads always return 0xFF, so
  write-only components (displays) are fully served; live sensor reads
  need a second mechanism (future work, see plan §12.3).
