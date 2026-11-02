#!/usr/bin/env python3
"""Update ONLY the STM32F1 rows of matrix.md (F1 lane f1-cov2).

Touches: the six STM32F1 board rows (SPI / DMA / USB-DEV / SD-SPI /
MicroPython columns), the STM32F1 row of the system+crypto table, and the
F1 spec names in the STM32F1 section's Specs list. Nothing else.
"""
import re
import sys

PATH = "matrix.md"
with open(PATH, encoding="utf-8") as fh:
    lines = fh.read().split("\n")

F1_BOARDS = {
    "openhw-stm32-bluepill",
    "openhw-stm32-maple-mini",
    "openhw-stm32f103cb",
    "openhw-stm32-gd32f103c8",
    "openhw-stm32-gd32f103cb",
    "openhw-stm32-gd32f103rb",
}

SPI = ("FULL (2026-10-20: the guest READS an SPI slave — SPI NOR flash "
       "JEDEC ID C8 40 16 + one data byte A5 over SPI1, 6/6 boards; the "
       "MFRC522 VersionReg reads 92 on the bluepill; cell stm32f1-spi-miso. "
       "The F1 engine's MISO queue is only consumed when a device is attached "
       "to the bus (engine src/peripherals/spi.rs, the DR-write arm) — the "
       "runner now attaches the engine's own flash model, which is what "
       "unblocked SPI reads)")

USB = ("FULL (2026-10-20: USB-FS control-plane enumeration — bus reset + "
       "device/config/lang descriptors + SET_ADDRESS + SET_CONFIGURATION, "
       "host-observed (sink enumState=enumerated, rxCount=89); cell "
       "stm32f1-usb. The engine USB model is ONE model for all F1 boards "
       "(engine src/peripherals/usb.rs) and the runner host machine is one "
       "code path — proven on the bluepill; no CDC data phase yet)")

SD = ("PARTIAL (2026-10-20: the SD card's SPI answers DO reach the guest "
      "(R1 0x01, CMD8 01 00 00 01 AA, OCR 00 C0 FF 80 00) but they land one "
      "COMMAND late, so no SD driver can be written and the CMD17 block data "
      "is not byte-comparable. The F1 engine has NO SPI-mode SD device: "
      "ext_devices.sd_card is the SDIO backing store and the engine binds "
      "only spi_flash/lcd/touchscreen/usart_probe to the SPI bus (engine "
      "src/ext_devices/mod.rs:50-89), so the card answers through the "
      "runner's JS bridge, whose MISO is injected at the engine drain "
      "(stm32f1-runner.ts, the onTransfer arm). The F4 avoids this with the "
      "engine-native ext_devices.spi_sd (stm32f4-runner.ts:262-266). OWNER "
      "ASK: port the F4 engine's SPI-mode SD device to the F1 engine)")

MP = ("NONE (no F1 image: public/firmware ships micropython only for esp32 / "
      "rp2040 / rp2350 / microbit, and the F1 board families register "
      "firmware: ['arduino-sketch'] only — src/worker/boards-registry.ts:169, "
      "179, 189, 199; the F1 runner has no MicroPython REPL-inject path, "
      "unlike esp32-runner.ts:34)")

changed_rows = 0
for idx, line in enumerate(lines):
    if not line.startswith("| openhw-stm32"):
        continue
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    board = cells[0]
    if board not in F1_BOARDS:
        continue
    if len(cells) == 23:
        # Pre-existing malformation in the openhw-stm32f103cb row: a stray
        # "ABSENT" between SD-SPI and MicroPython (23 cells where the table
        # has 22). Drop it so the row lines up with the header again.
        assert cells[20] == "ABSENT" and cells[19] == "NONE", cells[18:23]
        del cells[20]
    if len(cells) != 22:
        sys.exit(f"unexpected row shape for {board}: {len(cells)} cells")
    cells[4] = SPI
    cells[15] = USB
    cells[19] = SD
    cells[20] = MP
    if board == "openhw-stm32-bluepill":
        cells[8] = "FULL (DMA1 M2M 16 words + TCIF1 — cell stm32f1-dma)"
    lines[idx] = "| " + " | ".join(cells) + " |"
    changed_rows += 1

if changed_rows != 6:
    sys.exit(f"expected 6 F1 board rows, patched {changed_rows}")

# ── system / crypto table: the STM32F1 row ────────────────────────────────
SYS = {
    1: ("FULL 2026-10-20 — CRC_DR of 3 words equals the silicon value "
        "FB5C7298 on 3 boards (guest MMIO, cell stm32f1-crc; the engine's "
        "crc.rs computes the same polynomial)"),
    4: ("PARTIAL 2026-10-20 — IWDG arm/reload/fire proven on 3 boards (the "
        "engine stops the core and the runner reboots it on the watchdog "
        "reset — F1WDOG_RST:1, cell stm32f1-sys); WWDG still unproven "
        "(engine wwdg.rs exists)"),
    5: ("FULL 2026-10-20 — EXTI_SWIER -> ISR on 3 boards (EXTI_FIRED, cell "
        "stm32f1-sys); other IRQs / NVIC priorities unproven"),
    6: ("PARTIAL 2026-10-20 — the PVD path is FULL: the guest's PWR->CSR "
        "PVDO level follows the engine's MODELED supply voltage (host attr "
        "supplyMv -> pwr_set_supply_mv; PVDO=1 below the 2200 mV PLS "
        "threshold, 0 above; cell stm32f1-pwr-clk). SLEEP/STOP is NOT "
        "reachable: the engine's WFI only parks the core when deliver_irqs "
        "is on and the product path leaves it off (engine "
        "src/cpu/mod.rs:122, src/cpu/thumb.rs:2136-2148), so the power-mode "
        "mirror stays RUN"),
    7: ("FULL 2026-10-20 — the BKP_DR1 magic 0xCAFE reads back on 3 boards "
        "(cell stm32f1-sys); NVS/flash unproven"),
    8: ("FULL 2026-10-20 — the engine's RCC model decodes the guest's "
        "clock-tree writes: F1RCC_HZ:32000000 (PLL x4) and F1RCC_HZ:72000000 "
        "(PLL x9) on the guest's own CFGR writes, plus the engine's SW->SWS "
        "mirror in the CFGR readback and the guest clock advancing in exact "
        "delay(2000) quanta (cell stm32f1-pwr-clk)"),
    9: ("PARTIAL 2026-10-20 — the guest reads the engine's per-chip debug "
         "ID (DBGMCU_IDCODE 0x10016410 on the F103, 0x2BA01477 on the GD32 — "
         "cell stm32f1-dbg). The host-side SWD (engine swd.rs: DP/AP, "
         "halt/resume/step, watchpoints) and bootloader (bootloader.rs) "
         "surfaces exist in the engine but the F1 runner never calls them, "
         "so there is NO host-visible debug surface (NO swd_*/bootloader_* "
         "call in src/worker/runners/stm32f1-runner.ts)"),
}
for idx, line in enumerate(lines):
    if not line.startswith("| STM32F1 |"):
        continue
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) != 10:
        sys.exit(f"unexpected STM32F1 system row shape: {len(cells)} cells")
    for col, val in SYS.items():
        cells[col] = val
    lines[idx] = "| " + " | ".join(cells) + " |"
    break
else:
    sys.exit("STM32F1 system row not found")

# ── the F1 section's Specs list ───────────────────────────────────────────
old_specs = ("stm32f1-maple-cb (6/6), stm32f1-maple-cb-2 (8/8), stm32f1-dma, stm32f1-crc,\n"
             "stm32f1-sys (WDG/EXTI/BKP, all three boards), stm32-gd32-uart (3/3),")
new_specs = ("stm32f1-maple-cb (6/6), stm32f1-maple-cb-2 (8/8), stm32f1-dma (3/3),\n"
             "stm32f1-crc (3/3), stm32f1-sys (9/9: IWDG/EXTI/BKP, all three boards),\n"
             "stm32f1-spi-miso (7/7: MFRC522 VersionReg 92 + SPI NOR flash JEDEC "
             "C8 40 16 / data A5, six boards),\n"
             "stm32f1-pwr-clk (3/3: PVD vs the modeled supply + the RCC clock tree),\n"
             "stm32f1-dbg (2/2: DBGMCU IDCODE per chip), stm32f1-usb (1/1: USB-FS "
             "control-plane enumeration),\n"
             "stm32-gd32-uart (3/3),")
hits = 0
for idx, line in enumerate(lines):
    if old_specs.split("\n")[0] in line:
        lines[idx] = line.replace(old_specs.split("\n")[0], new_specs.split("\n")[0])
        hits += 1
    elif old_specs.split("\n")[1] in line:
        lines[idx] = line.replace(old_specs.split("\n")[1], new_specs.split("\n")[1])
        hits += 1
if hits != 2:
    sys.exit(f"specs list patch hits {hits}, expected 2")

with open(PATH, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines))
print("matrix.md patched: 6 board rows + system row + specs list")
