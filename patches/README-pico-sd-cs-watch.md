# pico-emu — SD/eMMC CS watch on the ARM path

**Patch file:** `pico-sd-cs-watch.patch` (applies to the owner's
`src/gpio.c`, `src/picoemu_wasm.c`, `include/gpio.h`, `build_wasm.sh`).

**Goal:** let an ARM guest (RP2040 / RP2350-M33) talk to the SD-card model.

## Root cause (file:line, owner tree @ `b83786f` + working-tree changes)

* `src/sdcard.c:379` — `sdcard_spi_xfer()` starts with
  `if (!sd->cs_active) return 0xFF;` — **every** byte is gated on the card
  being selected.
* `src/sdcard.c:476` — `sdcard_spi_cs(ctx, cs_active)` is the only writer of
  `sd->cs_active`.
* `src/picoemu_wasm.c:805` — the SD model is attached with
  `spi_attach_device(spi_num, sdcard_spi_xfer, sdcard_spi_cs, &wasm_sdcard)`.
* `src/spi.c:117` — `spi_device_cs(spi_num, cs_active)` is the only path that
  reaches that callback.
* `src/rp2350_rv/rv_membus.c:451` — **the ONLY caller of `spi_device_cs()` in
  the whole tree is the RV32 path.** The ARM path (M0+/M33) never reports CS
  assert/deassert, so `cs_active` stays 0 and the card answers 0xFF forever.
* `src/gpio.c:359` — `gpio_write32()` is where an ARM guest's `digitalWrite`
  lands (SIO_GPIO_OUT / OUT_SET / OUT_CLR / OE / OE_SET). It has the
  W5500/W6300 CSn/RSTn watch (which calls `w5500_board_gpio_write`) but no
  `spi_device_cs()` call — and `src/spi.c:112-116` even documents the watch
  it expects ("the board watches GPIO17/20 via the CS/RST edge path") while
  the SD model has no equivalent.

## Runtime proof (measured 2026-10-20, repo engine bytes)

Probe: `patches/probe-pico-sd-cs.ino` (raw SPI0, CS on GP5, prints the card's
R0 / R7 / R1 / OCR) + `patches/probe-pico-sd-cs.mjs` (boots the engine WASM
directly, `_picoemu_sdcard_load(fat16.img, len, 0)`, boots the UF2).

The SPI bus carries **one** device, so the probe runs in two modes: `sd`
(the card model attached — what the guest reads) and `mirror` (the engine's
own SPI tap attached — what the engine saw on the bus).

```
$ MODE=sd node patches/probe-pico-sd-cs.mjs          # repo engine bytes
sdcard_load rc=0 bytes=4194304
sdcard_cs_pin export MISSING (unpatched engine)
--- guest serial ---
SDPROBE:BEGIN
SDPROBE:R0:FF
SDPROBE:R8:FF:FF:FF:FF
SDPROBE:R41:FF
SDPROBE:R58:FF:FF:FF:FF
SDPROBE:END
--- end serial ---
GP5 (guest CS pin) OUT-latch transitions: LOW -> HIGH -> LOW -> HIGH -> LOW -> HIGH
SPI0 CR0=1707 CR1=2 SR=3 CPSR=2 RIS=8

$ MODE=mirror node patches/probe-pico-sd-cs.mjs       # repo engine bytes
spimirror rc=0
SPI0 CR0=1707 CR1=2 SR=3 CPSR=2 RIS=8
mirror entries=60
MOSI bytes (60): ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff 40 00 00 00 00 95 ff 48 00 00 01 aa 87 ff ff ff ff 77 00 00 00 00 ff 69 40 00 00 00 ff ff 7a 00 00 00 00 ff ff ff ff ff
CS events (0): (NONE)
```

Read that as:

* the guest's 60 MOSI bytes **did** go out on SPI0 — and they are exactly
  the probe's commands (`0x40` CMD0, `0x48` CMD8, `0x77` CMD55,
  `0x69` ACMD41, `0x7a` CMD58);
* the guest's CS pin **did** toggle on the pad (GP5 OUT-latch LOW→HIGH→LOW→…);
* the SPI peripheral itself is alive (CR0=0x1707, SR=0x3, RIS=0x8);
* but the engine's own SPI mirror saw **0 CS events** — the ARM path never
  tells the SPI device about CS, so `cs_active` stays 0 and the card
  answered **0xFF to every command**.

## The patch

* `src/gpio.c` — new CS watch: `gpio_set_cs_watch(pin, spi_num)` plus
  `gpio_cs_watch_publish()`, called from
  * the SIO write path (`gpio_write32`, the ARM guest's `digitalWrite`),
  * `gpio_set_pin()` (PIO-driven outputs),
  * `gpio_set_direction()` (an OE change moves the effective pad level).

  It mirrors the pad level into `spi_device_cs()`; CS is active-low, so pad
  LOW == CS asserted. Edge-free: only a real level change reaches the
  device. Both GPIO banks are handled (pins 0..31 via
  `gpio_effective_pins()`, pins 32..47 via the high latches).
* `include/gpio.h` — declare `gpio_set_cs_watch()`.
* `src/picoemu_wasm.c` — new export `picoemu_sdcard_cs_pin(pin)` (remembers
  the SPI instance used by `_picoemu_sdcard_load`). The watch is a property
  of the SPI **bus**, not of the card, so it is armed even with no card
  attached; the return value says whether a card is present
  (0 = card attached, 1 = watch armed, no card).
* `build_wasm.sh` — add `"_picoemu_sdcard_cs_pin"` to `$EXPORTS`.

## Acceptance test (measured, patched build)

Same probe, same image, engine built from the patched tree in `/tmp` (never
in the engine repo), plus one host call:

```js
mod._picoemu_sdcard_load(imgPtr, imgLen, 0);   // SPI0
mod._picoemu_sdcard_cs_pin(5);                  // CS line = GP5
```

```
--- guest serial ---
SDPROBE:BEGIN
SDPROBE:R0:1
SDPROBE:R8:1:0:0:1
SDPROBE:R41:0
SDPROBE:R58:0:C0:FF:80
SDPROBE:END
```

* `R0 = 0x01` — GO_IDLE_STATE answered (was 0xFF).
* `R7 = 0x01 0x00 0x00 0x01 0xAA` — SEND_IF_COND echoed the 0x1AA pattern
  (the probe prints the first 4 bytes).
* `R1 = 0x00` — ACMD41 → card ready.
* `OCR = 0xC0FF8000` — READ_OCR: SDHC, 3.3 V (the probe prints the first 4
  bytes).

## Alternative the owner may prefer

Make the SD model tolerate a missing CS edge (e.g. treat "a command byte
with bit7=0/bit6=1" as an implicit CS assertion). The watch above is
closer to real silicon (the CS pad is the physical truth) and also serves
the eMMC model and any other SPI slave.
