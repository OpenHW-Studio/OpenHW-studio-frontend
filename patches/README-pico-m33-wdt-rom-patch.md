# pico-emu — M33 watchdog reboot must keep the RP2350 ROM patch

**Patch file:** `pico-m33-wdt-rom-patch.patch` (applies to the owner's
`src/picoemu_wasm.c` and `src/main.c`).

**Goal:** an RP2350 (Cortex-M33) guest must survive a watchdog reboot the
way it survives a power-on reset — i.e. it must boot again, not die.

## Root cause (file:line, owner tree @ `b83786f` + working-tree changes)

* `src/rom.c:244` — `rom_init()` does `memset(rom_image, 0, ROM_SIZE)` and
  writes the **RP2040-format** ROM image: magic `'M','u'` at `0x10`,
  16-bit pointers, RP2040 function codes.
* `src/rom.c:615` — `rom_patch_rp2350_arm()` rewrites that image into the
  **RP2350-format** ROM (magic `'R','P',0x02`, 32-bit function table,
  RP2350 function codes).
* `src/picoemu_wasm.c:164` — the M33 init path calls `rom_patch_rp2350_arm()`
  **once**, right after `m33_init_overlay()`.
* `src/picoemu_wasm.c:97` — `reset_runtime_peripherals()` calls `rom_init()`,
  so it **wipes the RP2350 patch**.
* `src/picoemu_wasm.c:393` — `picoemu_watchdog_reboot()` calls
  `reset_runtime_peripherals()` and **never re-applies the patch**.
* `src/main.c:313` — the native CLI's `reboot_from_watchdog()` has exactly
  the same defect.

So the first boot of an M33 image is fine; the first *watchdog* reboot
restores the RP2040 ROM and the guest dies silently (the ROM magic flips
`RP-v2` → `Mu-v1` and the M33 firmware's ROM calls return nothing).

The ROM layout is a property of the **chip**, not of the reset — the patch
must be re-applied on every peripheral reset.

## Runtime proof (measured 2026-10-20)

Harness: `patches/`-adjacent `/tmp/opencode/wdtprobe/wdt-m33.mjs` (boots the
engine WASM directly with `arch=M33`, loads an M33 UF2 that arms the
watchdog for 200 ms and prints `PICO2_WDT2_ARMED` on every boot, then does
exactly what the frontend runner does — `pico-runner.ts` `pollPicoWDT()`:
read WDT `CTRL`/`LOAD` at `0x400D8000`, and on expiry write the `TRIGGER`
bit so the engine takes its **own** watchdog-reboot path).

```
# repo engine bytes (unpatched)
PICO2_WDT2_ARMED
PICO2_WDT2_SPIN
BOOT lines  = 0
ARMED lines = 1      <-- exactly ONE boot, then silence
RESULT: SINGLE BOOT (unpatched)

# same firmware, engine built from the patched tree (in /tmp, never in the engine repo)
PICO2_WDT2_SPIN
PICO2_WDT2_ARMED
PICO2_WDT2_SPIN
PICO2_WDT2_ARMED
... (120 times in the 8 s window)
ARMED lines = 120
RESULT: REBOOTS (patched)
```

## The patch

* `src/picoemu_wasm.c` — `picoemu_watchdog_reboot()` re-applies
  `rom_patch_rp2350_arm()` when `current_arch == ARCH_M33`.
* `src/main.c` — `reboot_from_watchdog()` takes the architecture as a
  parameter (it was a `main()`-local before) and re-applies the patch for
  `ARCH_M33`. The native CLI had the same bug.

Nothing else changes: the RP2040 path is untouched (`rom_init()` alone is
still correct there), and `picoemu_reset()` (the plain reset) already
avoids `rom_init()` on purpose.

## Acceptance test

`tests/e2e/pico-wdt.spec.js` → *"Pico 2 M33 unfed WDT reboots (200ms)"*:
the guest must print `PICO2_WDT2_ARMED` **at least twice** within 15 s
(the cell already exists and asserts exactly that; it is RED on the repo
bytes and goes green unchanged when the owner lands this patch).

Headless equivalent (no browser): the harness above must report
`ARMED lines >= 2`.

## Note for the owner

The M33 WDT cell in the repo already exists
(`tests/e2e/pico-wdt.spec.js`), so this patch needs **no** frontend change.
