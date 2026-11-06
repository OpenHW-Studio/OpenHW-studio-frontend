# pico-emu — RP2350 SIO GPIO register map (RV32 GPIO-out is dead)

**Patch file:** `pico-rp2350-sio-gpio-map.patch`
(touches `src/gpio.c` + `src/rp2350_rv/rv_membus.c`; applies cleanly to the
owner's tree at `b83786f` + the owner's working-tree changes, and to all
four other Pico patches at the same time).

**Goal:** an RP2350 guest must be able to **drive a pin HIGH** — on the
Cortex-M33 *and* on the Hazard3 RISC-V core. Today the RISC-V core can
never set a GPIO output: `digitalWrite(pin, HIGH)` is silently lost, so
every RV32 peripheral that needs an output pin (SPI CS, PWM, LEDs, an
I2C bit-bang, the W6300 CSn/RSTn) is dead on the RV32 arch.

## Root cause (file:line)

RP2350 **interleaves** the SIO GPIO registers; RP2040 does not:

| register | RP2040 (pico-sdk `rp2040/.../regs/sio.h:61-119`) | RP2350 (pico-sdk `rp2350/.../regs/sio.h:113-589`) | engine (`include/gpio.h:30-39`) |
|---|---|---|---|
| GPIO_OUT    | 0x10 | 0x10 | 0x10 ✓ |
| GPIO_OUT_SET| 0x14 | **0x18** | 0x14 ✗ |
| GPIO_OUT_CLR| 0x18 | **0x20** | 0x18 ✗ |
| GPIO_OUT_XOR| 0x1C | **0x28** | 0x1C ✗ |
| GPIO_OE     | 0x20 | **0x30** | 0x20 ✗ |
| GPIO_OE_SET | 0x24 | **0x38** | 0x24 ✗ |
| GPIO_OE_CLR | 0x28 | **0x40** | 0x28 ✗ |
| GPIO_OE_XOR | 0x2C | **0x48** | 0x2C ✗ |
| GPIO_HI_OUT | — | 0x14 | 0x30 ✗ |

The engine implements the **RP2040** map for **both** chips
(`src/gpio.c:359` `gpio_write32()` switches on the absolute address and
matches `SIO_GPIO_OUT_SET` = 0x14, `SIO_GPIO_OUT_CLR` = 0x18,
`SIO_GPIO_OE_SET` = 0x24 …).

So on RP2350:

* the guest's `gpio_put(pin, HIGH)` writes SIO_GPIO_OUT_SET = **0x18** →
  the engine executes **OUT_CLR** → the OUT bit is **cleared**;
* the guest's `gpio_put(pin, LOW)` writes SIO_GPIO_OUT_CLR = **0x20** →
  the engine executes **GPIO_OE = value** → the OE register is
  overwritten with the write mask (this is the "the OE write lands" half
  of the symptom);
* the guest's `gpio_set_dir(pin, OUTPUT)` writes SIO_GPIO_OE_SET =
  **0x38** → the engine's default branch treats 0x38 as "GPIO_HI_OUT_CLR"
  (`src/gpio.c:436-466`) → **the output enable for pins 0-31 is never
  set**.

**Why the M33 does not show it:** on RP2350 the pico-sdk drives the **ARM
GPIO coprocessor** instead of the SIO registers
(`pico-sdk rp2_common/hardware_gpio/include/hardware/gpio.h:16-19`
`PICO_USE_GPIO_COPROCESSOR`, `HAS_GPIO_COPROCESSOR 1` in
`rp2350/hardware_regs/include/hardware/platform_defs.h:70`), and the
engine implements those Thumb-2 instructions in
`src/thumb32.c:1564` ("RP2350 GPIO coprocessor (p0): MCRR p0,#4,Rt,Rt2").
**The RISC-V core has no coprocessor** — pico-sdk
`rp2_common/hardware_gpio/include/hardware/gpio_coproc.h:11-14`:
`#ifdef __riscv` → `#error "GPIO coprocessor port is not available on
RISC-V"` — so an RV32 guest falls back to the SIO registers and hits the
wrong map on every write.

The RV32 write path itself is fine: `src/rp2350_rv/rv_membus.c:434-495`
routes the SIO block to `mem_write32()` → `sio_write32()`
(`src/membus.c:1049`) → `gpio_write32()`.

## Runtime proof (measured 2026-10-22, repo engine bytes)

`patches/probe-pico2-rv32.{ino,mjs}` — the same sketch on all three
archs, one line of firmware (`digitalWrite(15,HIGH); digitalRead(15)`):

| arch | guest `RVPROBE:OUT15` | engine GPIO OUT latch |
|---|---|---|
| RP2040 (M0+) | **1** | 0x28000 (bit15 = 1) |
| RP2350-M33 (ARM) | 0 (the M33's IN latch does not mirror OUT) | 0x28000 (bit15 = 1) |
| **RP2350-RV32** | **0** | **0x0 (bit15 = 0)** |

The M33 escapes the bug through the coprocessor; the RV32 does not —
`gpio_put(HIGH)` is lost, so the pin can never go HIGH.

## The patch

1. `src/gpio.c`: a new `sio_gpio_addr()` translates the RP2350 SIO GPIO
   offset into the engine's internal RP2040 slot
   (`0x18 → 0x14` OUT_SET, `0x20 → 0x18` OUT_CLR, `0x30 → 0x20` OE,
   `0x38 → 0x24` OE_SET, …) and is applied at the top of
   `gpio_write32()` and `gpio_read32()` **only when
   `membus_rp2350_mode` is set** — the RP2040 path is byte-for-byte
   unchanged.
2. `src/rp2350_rv/rv_membus.c`: the RV32 ETH CSn/RSTn watch looked for
   the RP2040 offsets `0x14/0x18/0x24`; on RP2350 the guest writes
   `0x18/0x20/0x38` (OUT_SET/OUT_CLR/OE_SET) — updated.

## Acceptance test (measured, patched build)

Engine built from the patched tree (in `/tmp`, never in the engine repo),
same probe, same firmware:

```
RV32  (patched):  RVPROBE:OUT15:1    GPIO OUT latch = 0x28000 (bit15 = 1)
M33   (patched):  RVPROBE:OUT15:0    GPIO OUT latch = 0x28000   (unchanged)
M0+   (patched):  RVPROBE:OUT15:1    GPIO OUT latch = 0x28000   (unchanged)
```

→ the RV32 can now drive a pin HIGH, and the M0+/M33 are unaffected.

One-liner for the owner:

```
node patches/probe-pico2-rv32.mjs                                   # repo bytes -> OUT15:0
ENGINE=<patched>/web/picoemu.wasm.js node patches/probe-pico2-rv32.mjs   # -> OUT15:1
```

## Note for the owner

* The fix is deliberately confined to `membus_rp2350_mode` (RP2350) so
  the RP2040 path cannot change behaviour.
* The M33's `digitalRead()` of a pin it drives still reads 0 (the ARM
  coprocessor path does not mirror OUT into the IN latch — see
  `src/gpio.c:367` `case SIO_GPIO_OUT:` which does mirror it for the SIO
  path). That is a separate, smaller fidelity gap; it does not affect
  the RV32 fix.
* With GPIO-out alive on the RV32, the **RV32 SPI/CS** column becomes
  reachable: the engine's SPI *data* path already works on the RV32 (the
  SPI mirror saw the MOSI byte), but the engine never told the SPI
  *device* that CS moved (`spi_device_cs()` is only called from the
  ETH paths — `src/rp2350_rv/rv_membus.c:451/459/480/488`). The SD-CS
  watch patch (`pico-sd-cs-watch.patch`) fixes the ARM path; the RV32
  needs the same watch on the RP2350 SIO offsets.
