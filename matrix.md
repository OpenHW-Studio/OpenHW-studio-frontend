# Board × Protocol Coverage Matrix

Living tracker. Cell values: `FULL` (green e2e proof) / `PARTIAL` (note what's
missing) / `NONE` (silicon-capable, no proof yet) / `ABSENT` (no such silicon) /
`NO-GO` (deliberately declined, reason noted) / `RED` (spec failing) /
`PENDING` (reserved; zero PENDING cells — all sections survey-verified).

- Proof = serial needle + telemetry/liveOop evidence in the named spec.
- Last updated: 2026-10-09 (all sections survey-verified; RED column fills from sweep).

## STM32F1 (survey-verified 2026-10-09; engine bytes re-pinned 2026-10-20 — the shipped app was resolving the STALE npm `stm32f1-emu` build, which turned the SoftSerial RX loopback + I2C-RTC cells RED and was the real cause of the DHT RED; with the pinned owner engine bytes DHT22 is green on every F1 board and all other stm32* cells stay green)

| Board | UART | SoftSerial | I2C | SPI | ADC | PWM | DAC | DMA | GPIO-in | RTC | CAN-2.0 | CAN-FD | I2S | 1-Wire/DHT | USB-DEV | USB-HOST | ETH | SDIO | SD-SPI | MicroPython | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-stm32-bluepill | FULL | FULL (TX+RX loopback) | FULL (OLED+LCD+MPU+BMP) | PARTIAL (TX/write-only; MISO-read gap) | FULL | FULL | ABSENT | NONE (DMA1, no cell) | FULL | FULL (SET) | FULL (bxCAN loopback) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | FULL (2026-10-20, pinned owner engine bytes: BP 8/8 runs, exact 24.00/50.00; the RED was the stale npm engine build — per-read nan intermittency itself persists, ~1 in 8 reads) | NONE (FS-device capable) | ABSENT | ABSENT | ABSENT | NONE (SPI-capable, no F1 SD cell) | NONE | FULL (OLED+LCD+MAX7219+595) |
| openhw-stm32-maple-mini | FULL | FULL (TX+RX) | FULL | PARTIAL (same write-only gap) | FULL | FULL | ABSENT | FULL (TCIF1) | FULL | FULL | FULL (exact loopback) | NO-GO | NONE | FULL (2026-10-20, pinned owner engine bytes: MP green via stm32f1-maple-cb-2, exact 24.00/50.00; per-read nan intermittency persists) | NONE | ABSENT | ABSENT | ABSENT | NONE | ABSENT | FULL (sweep OLED+MAX7219) |
| openhw-stm32f103cb | FULL | FULL (TX+RX) | FULL | PARTIAL (same write-only gap) | FULL | FULL | ABSENT | FULL (TCIF1) | FULL | FULL | FULL (exact loopback) | NO-GO | NONE | FULL (2026-10-20, pinned owner engine bytes: CB green via stm32f1-maple-cb-2, exact 24.00/50.00; per-read nan intermittency persists) | NONE | ABSENT | ABSENT | ABSENT | NONE | ABSENT | NONE | FULL |
| openhw-stm32-gd32f103c8 | FULL | FULL (TX+RX loopback) | FULL (OLED+RTC) | PARTIAL (TX/write-only; MISO-read gap) | FULL | FULL | ABSENT | FULL (TCIF1) | FULL | FULL (SET) | FULL (bxCAN loopback) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | FULL (2026-10-20, pinned owner engine bytes: gd32-wave2 DHT green, exact 24.00/50.00; per-read nan intermittency persists) | NONE (FS-device capable) | ABSENT | ABSENT | ABSENT | NONE (SPI-capable, no F1 SD cell) | NONE | PARTIAL (OLED+MAX7219) |
| openhw-stm32-gd32f103cb | FULL | FULL (TX+RX loopback) | FULL (OLED+RTC) | PARTIAL (TX/write-only; MISO-read gap) | FULL | FULL | ABSENT | FULL (TCIF1) | FULL | FULL (SET) | FULL (bxCAN loopback) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | FULL (2026-10-20, pinned owner engine bytes: gd32-wave2 DHT green, exact 24.00/50.00; per-read nan intermittency persists) | NONE (FS-device capable) | ABSENT | ABSENT | ABSENT | NONE (SPI-capable, no F1 SD cell) | NONE | PARTIAL (OLED+MAX7219) |
| openhw-stm32-gd32f103rb | FULL | FULL (TX+RX loopback) | FULL (OLED+RTC) | PARTIAL (TX/write-only; MISO-read gap) | FULL | FULL | ABSENT | FULL (TCIF1) | FULL | FULL (SET) | FULL (bxCAN loopback) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | FULL (2026-10-20, pinned owner engine bytes: gd32-wave2 DHT green, exact 24.00/50.00; per-read nan intermittency persists) | NONE (FS-device capable) | ABSENT | ABSENT | ABSENT | NONE (SPI-capable, no F1 SD cell) | NONE | PARTIAL (OLED+MAX7219) |

UART note: all FULL cells prove TX; HW-UART RX loopback unproven (SW-UART RX
proven on bluepill only).
Engine-bytes note (2026-10-20): under the stale npm `stm32f1-emu` build the
SoftSerial RX loopback (stm32-softserial) and the I2C RTC readback
(stm32-rtc) cells were RED — the npm wasm delivers pin events as
(port,pin,level) triples, so the runner loses the engine-domain edge stamp
and hunts coarsely. With the pinned owner engine bytes (src/engines/
stm32f1-emu — glue+wasm+facade from ONE build) both are green. See
"Infra notes" for the byte set and the resolution point.
Specs: stm32-can, stm32-softserial(+tx), stm32-dht22, stm32-rtc, stm32-gpio-in,
stm32-i2c, stm32-spi, stm32-595, stm32-adc, stm32-pwm, stm32-mpu6050,
stm32-bmp180, stm32f1-sweep, stm32f1-i2c-sweep,
stm32f1-maple-cb (6/6), stm32f1-maple-cb-2 (8/8), stm32f1-dma, stm32f1-crc,
stm32f1-sys (WDG/EXTI/BKP, all three boards), stm32-gd32-uart (3/3),
stm32-gd32-analog (9/9), stm32-gd32-core (15/15: DMA/CRC/WDG/EXTI/BKP),
stm32-gd32-wave2 (12/12: softserial/RTC/DHT/CAN).

## STM32F4 (survey-verified 2026-10-09; chip flags from engine CHIPS table)

| Board | UART | I2C | SPI | ADC | PWM | DAC | DMA | GPIO-in | RTC | CAN-2.0 | CAN-FD | I2S | 1-Wire | USB-DEV | USB-HOST | ETH | SDIO | SD-SPI/FS | LTDC | DCMI | QSPI | FSMC | SAI | MicroPython | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-stm32f4 (F407 disco) | FULL | FULL (OLED) | FULL (MAX7219+SD) | FULL | FULL | FULL (loopback) | NONE | NONE | NONE | NONE (CAN hw, no F4 CAN cell) | NO-GO | NONE (I2S2/3) | NONE | FULL (CDC echo) | ABSENT (device-only model) | FULL (gateway DORA 2026-10-15) | FULL (block5 exact) | FULL (raw+FS) | NONE (flag true; scanout proven F429-only) | NONE (flag true; proven F429-only) | NONE (flag true; proven F429-only) | NONE (flag true; proven F429-only) | NONE (sai:[1]; proven F429-only) | NONE | FULL (OLED+MAX7219; no ILI9341-on-STM32 cell) |
| openhw-stm32f401 | FULL | FULL (OLED) | FULL (MAX7219) | FULL | FULL | ABSENT | NONE | FULL | FULL | ABSENT (can:[]) | NO-GO | NONE | NONE | NONE | ABSENT | ABSENT (no MAC) | FULL | FULL (raw; FS NO-GO engine-side) | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | NONE | FULL (OLED/MAX7219) |
| openhw-stm32f411 | FULL | FULL (OLED) | FULL (MAX7219) | FULL | FULL | ABSENT | NONE | FULL | FULL | ABSENT (can:[]) | NO-GO | NONE | NONE | NONE | ABSENT | ABSENT (no MAC) | FULL | FULL (raw; FS NO-GO engine-side) | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | NONE | FULL (OLED/MAX7219) |
| openhw-stm32f407ve | FULL | FULL (OLED) | FULL (MAX7219) | FULL | FULL | FULL (loopback) | NONE | FULL | FULL | FULL (exact loopback) | NO-GO | NONE | NONE | FULL (CDC echo) | ABSENT | FULL (gateway DORA 2026-10-15, same runner path as F407) | FULL | FULL (raw; FS NO-GO engine-side) | NONE (flag; proven F429-only) | NONE | NONE | NONE | NONE (sai:[1]) | NONE | FULL (OLED/MAX7219) |
| openhw-stm32f429 | FULL | FULL (OLED) | FULL (MAX7219) | FULL | FULL | FULL (loopback) | NONE (DMA2D gate unused) | FULL | FULL | FULL (exact loopback) | NO-GO | NONE | NONE | NONE | ABSENT | FULL (gateway DORA 2026-10-15, same runner path as F407) | FULL | FULL (raw; FS NO-GO engine-side) | FULL (scanout, exact pixels) | FULL (capture, DR sum exact) | FULL* (model extension — no F4 silicon; image plumbing proven) | FULL (8080 burst, RDDID exact) | PARTIAL (DR data-path only) | NONE | FULL (OLED/MAX7219; LTDC proven) |

Specs: stm32f4-sdio, stm32f4-ltdc, stm32f4-usb, stm32f4-dcmi, stm32f4-qspi,
stm32f4-fsmc, stm32f4-sai, stm32f4-dac, stm32f4-adc, stm32f4-pwm, stm32f4-spi,
stm32f4-sd, stm32f4-sd-fs, stm32f4-sweep, multi-board-uart,
stm32f4-dcmi, stm32f4-qspi, stm32f4-fsmc, stm32f4-sai, stm32f4-can(+x),
stm32f4-429-periph, stm32f4-periph-x, stm32f4-store-x, stm32f4-display-x,
stm32f4-gpio-rtc, stm32f4-crc-rng-x, stm32f4-1wire, stm32f4-usb-ve,
stm32f4-can(+x), stm32f4-429-periph, stm32f4-periph-x, stm32f4-store-x (VE DAC),
stm32f4-sys (IWDG arm/reload/fire, EXTI-SWIER, RTC_BKP0R, HASH SHA-256/SHA-1
digests — 15 cells over F407/407VE/429), stm32f4-clock (tickMHz:24 divider
armed + guest millis advance in delay(2000) quanta),
F4 sibling NO-GOs (engine-side, specs left failing): SdFat FS (P_ERR init
contradiction), ILI9341 (tap death on 120ms+ delays), RNG (DRDY never sets),
DHT22 (micros() 1ms-quantized), I2S (SPI2 block unrouted).

## AVR (survey-verified 2026-10-09; no RED)

| Board | UART | SoftSerial | I2C | SPI | ADC | PWM | DAC | DMA | GPIO-in | RTC | EEPROM | CAN-2.0 | CAN-FD (MCP2518FD) | I2S | 1-Wire/DHT | IR | USB-DEV | ETH | SD-SPI | Modbus | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-arduino-uno | FULL | PARTIAL (TX only, RX parked) | FULL (OLED/LCD/sensors) | FULL (FD host+MFRC522+TFT) | FULL | FULL | ABSENT | ABSENT | FULL | FULL (DS1307) | FULL (AB/CD) | NO-GO (no controller on silicon) | FULL (loopback) | FULL (TX+RX) | FULL (DS18B20+DHT22) | PARTIAL (NEC envelope, no 38kHz carrier) | ABSENT | ABSENT | FULL | FULL (two-Uno) | FULL (OLED/TFT/MAX7219/LCD/NeoPixel) |
| openhw-arduino-mega | FULL | FULL (TX) | FULL (OLED+sensors) | FULL (MAX7219+FD host) | FULL (range) | FULL | ABSENT | ABSENT | FULL | FULL (T0/T1) | FULL | NO-GO (no controller on silicon) | FULL (loopback) | FULL (40 frames) | FULL | FULL (NEC) | ABSENT | ABSENT | FULL | FULL (master) | FULL (OLED/MAX7219) |
| openhw-arduino-nano | FULL | FULL (TX) | FULL (OLED) | FULL (MAX7219) | FULL (range) | FULL | ABSENT | ABSENT | FULL | FULL | FULL | NO-GO (no controller on silicon) | FULL (loopback) | FULL | FULL | FULL (NEC) | ABSENT | ABSENT | FULL | FULL (master) | FULL (OLED/MAX7219) |
| openhw-attiny85 | PARTIAL (Uno-compiled binary; NO UART silicon, no native tiny core) | PARTIAL (TX) | PARTIAL (USI stand-in) | PARTIAL (USI stand-in) | PARTIAL (USI stand-in) | FULL | ABSENT | ABSENT | FULL (P2) | PARTIAL (DS1307 stand-in) | FULL | NONE | NONE | FULL | FULL | FULL (NEC) | ABSENT | ABSENT | PARTIAL (stand-in) | NO-GO (no UART silicon) | PARTIAL (stand-in OLED+MAX7219) |

Specs: avr-eeprom, avr-i2s, avr-inmp441, avr-dht22, avr-mcp2518fd, avr-modbus,
avr-softserial-tx, avr-softproto, avr-control, board-input, board-family-sweep,
cluster-d, peripherals, protocol-transactions, display-verify, human-senses,
spi-delivery-disc, i2c-ack-disc, avr-mega-nano, avr-mega-periph, avr-nano-periph,
avr-tiny-honest, avr-wdt.

## Pico (survey-verified 2026-10-09; W/ETH share the base die)

| Board | UART | I2C | SPI | ADC | PWM | PIO | DMA | MicroPython | DAC | USB-DEV | 1-Wire | I2S | CAN-2.0 | CAN-FD | RTC | GPIO-in | EEPROM | SD | IR | Camera | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-pico (+W/+ETH) | FULL (6-variant sweep) | FULL (OLED+LCD) | FULL (MAX7219+595) | FULL | FULL | FULL (WS2812 3px) | FULL (64B exact) | FULL (I2C) | ABSENT | NONE (CDC→UART rewrite, no cell) | NONE (GPIO/PIO-capable, no cell) | NONE (PIO-capable, no cell) | ABSENT (no CAN silicon) | ABSENT | ABSENT (no RTC silicon) | NONE (no input cell) | NONE (flash-emul capable) | NONE (sdcard.c model) | NONE | NONE (PIO-capable, no DCMI) | FULL (OLED/LCD/MAX7219) |
| openhw-pico-2 (+W/+ETH, M33) | FULL | FULL | FULL | FULL | FULL | NONE | NONE | FULL (I2C) | ABSENT | NONE | NONE | NONE | ABSENT | ABSENT | ABSENT | NONE | NONE | NONE | NONE | NONE | FULL |
| openhw-pico-2 (RV32) | PARTIAL (fixed image only; Arduino RV32 blocked upstream) | NONE | NONE | NONE | NONE | ABSENT | NONE | ABSENT | ABSENT | NONE | ABSENT (no GPIO model) | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | NONE |

Specs: pico-uart-sweep, pico-i2c, pico-spi, pico-595, pico-adc, pico-pwm,
pico-mp-i2c, pico-pio, pico-dma, pico2, pico2-spi, pico2-adc, pico2-pwm,
pico2-mp-i2c, pico2-rv32, multi-board-uart, arch-clocks,
pico2-w-wifi-gateway, pico2-eth-gateway, pico2-w-lan, pico2-w-ap2,
pico2-w-http-gateway, pico2-eth-lan, pico2-eth-http-gateway,
pico-eth-w6300-gateway, pico-eth-intn-gateway.

## ESP32 (DevKit + CAM shell — survey-verified 2026-10-09)

| Board | UART | I2C | SPI | ADC | PWM/LEDC | DAC | DMA | GPIO-in | 1-Wire | DHT-RMT | TWAI | I2S | Camera | MicroPython | WiFi/ETH | SD-SPI | Display-ext | Touch |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-esp32 | FULL | FULL | FULL | FULL | FULL | FULL (loopback) | NONE | PARTIAL (input path via pumps; no switch→digitalRead cell; output readback gap) | FULL (bit-bang + Dallas, centrally green) | FULL (RMT transport) | PARTIAL (RX only; TX needs ACKing peer) | FULL (DAC out) | FULL (QQVGA via camcell) | FULL (I2C) | NONE (deferred) | NONE | PARTIAL (SSD1306+MAX7219 proven; ILI9341/ePaper/N5110 not) | NONE |
| openhw-esp32-cam | FULL | NONE | NONE | NONE | NONE | ABSENT (no 25/26 on shell) | NONE | NONE | NONE | NONE | NONE (no 21/22 on shell) | NONE | FULL (QQVGA) | NONE | FULL (gateway DHCP + 2-board LAN + HTTP/NAT 2026-10-20; LAN cell FLAKY: 2nd ESP32 board sometimes never joins — client serial stops after CCLI-BEGUN while the server side completes) | NONE | NONE | NONE |

Specs: esp32-i2c, esp32-spi, esp32-adc, esp32-pwm, esp32-dac, esp32-onewire,
esp32-dht22, esp32-twai (RX), esp32-i2s-tx, esp32-camcell (DevKit camera),
esp32-camboard (cam shell), esp32-mp-i2c,
esp32-twai-tx (RX proven; TX oracle NO-GO engine-side), esp32-rmt-ir,
esp32-touch, esp32-cam-adc, esp32-gpio-in, esp32-nvs, esp32-interrupts
(centrally green), esp32-ili9341 (centrally green), esp32-sys, esp32-pcnt,
esp32-sdspi, esp32-epaper, esp32-n5110, esp32-wdt-sleep, esp32-cam-sweep,
esp32-cam-mp, esp32-cam-sdspi, esp32-freertos, esp32-hash-crc,
esp32-cam-wifi-gateway, esp32-cam-lan, esp32-cam-http-gateway.

## micro:bit v2 / Retro (survey-verified 2026-10-09)

| Board | UART | I2C | SPI | ADC | DMA | GPIO | Button/Touch | Display | RTC | NVS/EEPROM | MicroPython | I2S | 1-Wire |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-microbit-v2 | FULL (TX + RX 2026-10-20: paced UARTE0 drip, host→guest bytes) | FULL (OLED) | FULL (loopback) | FULL (SAADC AIN0 cell 2026-10-20: pot → guest count exact) | PARTIAL (EASYDMA pumps exercised, no memcpy cell) | PARTIAL (Button-A proven; generic digitalRead unproven; PWM0 readback gear proven 2026-10-20) | PARTIAL (button-A FULL; capacitive touch unproven) | PARTIAL (OLED + matrix proven; SPI displays not) | NONE | NONE (NVMC-capable) | ABSENT (fixed-bin only) | NONE (real I2S silicon) | NONE (GPIO-capable) |

| Board | UART | GPIO | GPIO-in | Bit-bang (I2C/SPI/PWM/SD) | ADC | MicroPython |
|---|---|---|---|---|---|---|
| openhw-8086 | FULL (TX + RX-echo) | FULL | FULL (switch→L2) | NONE (capable) | ABSENT (stub NaN) | ABSENT (asm only) |
| openhw-8088 | PARTIAL (TX; RX-echo typed 8086 only) | NONE (inject exists, no cell) | NONE | NONE (capable) | ABSENT | ABSENT |
| openhw-8085 | FULL (console TX) | FULL (LED) | NONE | NONE (capable) | ABSENT | ABSENT |
| openhw-8051 | FULL (console TX) | PARTIAL (LOW-sink only, quasi-bidirectional) | NONE | NONE (capable) | ABSENT | ABSENT |
| openhw-6502 | FULL (console TX) | FULL (LED) | NONE | NONE (capable) | ABSENT | ABSENT |
| openhw-z80 | FULL (console TX) | FULL (LED) | NONE | NONE (capable) | ABSENT | ABSENT |
| openhw-rv32 | FULL (console TX) | ABSENT (no GPIO model) | ABSENT | ABSENT | ABSENT | ABSENT |

Specs: microbit-cells (5 cases), microbit-uart-rx, microbit-saadc,
microbit-pwm (owner P164 readback gear), microbit-i2s/nfc/nvs/temp,
retro-boards (7 ISAs), retro-gpio(+in), retro-rx-echo (8086).

Real-system chips with NO proof yet (all NONE): 8086 PIT/PIC/DMA (XT needs
8253+8259+8237 for anything beyond polling loops), Z80 CTC, 6502 VIA timers,
8051 timer/counter array. Real nRF52833 extras: BLE 5.1 (no engine model —
needs owner work), NFC (NONE), USBD (ABSENT — not pinned on the v2 board).

## System, crypto & connectivity blocks (audited 2026-10-09 vs engine inventories)

Same vocabulary. These have no protocol spec today; NONE = capable-or-modeled,
no e2e proof. (Inventories: F1 `stm32 emu blue pill/src/peripherals/`, F4
`stm32-periph-wasm/src/peripherals/`, ESP32 `engine-wasm/src/peripherals/*`,
Pico `Pico-emu/*.c`, runners in `src/worker/runners/`.)

| Family | CRC | TRNG/RNG | HASH/CRYP | Watchdog | EXTI/Interrupts | PWR/Sleep | Backup/NVS | Clocks | Debug |
|---|---|---|---|---|---|---|---|---|---|
| STM32F1 | NONE (crc.rs) | ABSENT (no RNG silicon) | ABSENT | NONE (iwdg+wwdg.rs) | NONE (exti.rs) | NONE (pwr.rs) | NONE (bkp.rs) | NONE (rcc.rs) | NONE (swd.rs; bootloader.rs) |
| STM32F4 | NONE (crc.rs) | NONE (rng.rs) | PARTIAL — HASH FULL 2026-10-20 (SHA-256 + SHA-1 digests vs published vectors, 3 boards); CRYP still NONE (cryp.rs) | FULL 2026-10-20 — IWDG arm/reload/fire (3 boards; WWDG still NONE) | PARTIAL 2026-10-20 — EXTI_SWIER → ISR (3 boards); other IRQs/NVIC priorities unproven | NONE (pwr.rs) | PARTIAL 2026-10-20 — RTC_BKP0R backup-domain readback (3 boards); NVS/flash unproven | NONE | NONE (dbgmcu; ITM/DWT) |
| AVR | ABSENT | ABSENT | ABSENT | PARTIAL (Uno+Nano reboot+ISR; Mega vector absent, Tiny deferred) | PARTIAL (Mega+Nano/328P exact-count; Tiny INT0 unproven) | NONE | EEPROM covered in main table | PARTIAL (mega+nano+tiny gate cells) | ABSENT |
| Pico | ABSENT | NONE (ROSC jitter, no cell) | NONE on RP2350 (real SHA-256 silicon); ABSENT on RP2040 | NONE | NONE (nvic.c) | NONE | NONE (sdd_eeprom.c) | PARTIAL (arch-clocks: M33; clocks.c) | NONE (gdb.c) |
| ESP32 | NONE | NONE (rng in rmt_rng_math.rs) | NONE (aes+rsa+sha_ecc_key.rs) | NONE (timers.rs MWDT) | NONE | NONE (ULP present, unproven) | NONE (partition_table+NVS) | NONE (clock(s).rs) | NONE (gdb_session) |
| micro:bit v2 | ABSENT | NONE (nRF RNG+TEMP) | ABSENT | NONE | NONE (PPI+GPIOTE) | NONE | NONE (NVMC-backed NVS) | NONE | ABSENT |
| Retro | ABSENT | ABSENT | ABSENT | ABSENT | NONE (chip PIC/CTC/VIA) | ABSENT | ABSENT | NONE | ABSENT |

Connectivity extras not in the main tables:

| Feature | Status |
|---|---|
| Pico-W CYW43 WiFi traffic | FULL 2026-10-15 — Arduino join + gateway DHCP (STATUS=3 IP=192.168.4.2) via unified gateway :5030; runner enables + WS pump in pico-runner.ts, engine from owner folder (vite alias) |
| Pico-W LAN (2-board TCP) | FULL 2026-10-20 — STA+STA same room, TCP echo both directions observed (SRV-RX/SRV-ECHOED/CLI-RX). v4 DNS now green + asserted (CLI-DNS:1:104.20.23.154): the static-IP client had NO resolver (no DHCP lease) — it now calls `WiFi.setDNS(192.168.4.1)` (gateway resolver). |
| Pico-W v4 DNS (gateway resolver) | FULL 2026-10-20 — `WiFi.hostByName("example.com")` → 104.20.23.154 / 172.66.147.243 (cell `tests/e2e/pico-wifi-dns.spec.js`). Resolver = the gateway's own DNS on 192.168.4.1:53 (gVisor VN DNS, answers through the host resolver) — reachable from the guest's L2 domain, no host egress needed. DHCP-carried DNS (lease advertises 192.168.4.1 first, 8.8.8.8 fallback) needs the gateway patch on branch `lane/net-dns` (not yet on main); explicit `WiFi.setDNS(192.168.4.1)` works on any gateway. Packet trace: guest→192.168.4.1:53 → `A 104.20.23.154 A 172.66.147.243`. |
| Pico-W HTTP client | FULL 2026-10-15 — Arduino HTTPClient GET via gateway NAT (10.150.211.85→host :8092): 200 + body exact. |
| F4 HTTP client | FULL 2026-10-15 — owner eth_http.bin via gateway NAT (TCP + GET + 200 + body, byte-exact response); polling firmware (no ethIrq). |
| Pico IPv6 (SLAAC) | PARTIAL 2026-10-15 — RV32 ping6 guest gets gateway RA (RA-OK live, SLAAC addressing works); ICMPv6 echo unproven (guest targets a hardcoded vnet peer, gateway answers NS only for its own addresses). |
| Pico-W SoftAP | FULL 2026-10-20 — guest beginAP + STA join (STA DHCP lease .2) + TCP BOTH directions: AP-terminated (STA→AP-hosted server, `AP-ECHO:HELLO-AP-SERVE` bytes observed) and AP-client→STA-server. AP subnet fixed at .4.1 by the engine (softAPConfig not honored); the .1 collision with the gateway is resolved GATEWAY-side (room-aware .1 arbitration: a room member that claims .4.1 as a soft AP makes the gateway stop answering .1 ARP). Cells: pico-wifi-ap-serve (new, green), pico-wifi-ap (green), pico-wifi-ap2 (green). |
| Pico-ETH W5500 traffic | FULL 2026-10-15 — Arduino Wiznet5500lwIP DORA via unified gateway :5030 (MACRAW sock0, tickMHz 125); runner board enables + WS pump in pico-runner.ts, engine from owner folder (vite alias). Polled configuration (no IRQ pin). |
| Pico-ETH W6300 traffic | FULL 2026-10-20 — board attr `ethChip:'w6300'` on the existing W5500-EVB shells (openhw-pico-eth / openhw-pico-2-eth, W5500 stays the default): the runner attaches the engine's W6300 board instead (`_picoemu_board_eth6300` + `_picoemu_w6300_gw_enable`) on the SAME gateway room + 192.168.4.0/24 DHCP pool as CYW43 and the W5500; FQBN wiznet_6300_evb_pico. Arduino `lwIP_w6300` guest (PIO+DMA QSPI transport, engine PIO-QSI bridge) full DORA: version=0x61, MAC RAW mode, ETH-BEGIN-OK, lease 192.168.4.3, plus HTTP 200 + body hello-openhw through the gateway NAT (M0+ and M33). The guest uses the INTn=15 constructor, so this also proves the W6300 interrupt path. Cell: pico-eth-w6300-gateway. |
| Pico-ETH W5500 INTn interrupt (GPIO21) | FULL 2026-10-20 — `Wiznet5500lwIP eth(17, SPI, 21)` on openhw-pico-eth: in IRQ-pin mode the arduino-pico driver registers NO polled RX handler (only `attachInterruptParam(pin, _irq, LOW)`), so the OFFER/ACK can only reach the guest through the INTn interrupt. Observed: ETH-BEGIN-OK + lease 192.168.4.3, guest IO_IRQ_BANK0 deliveries = 3, PROC0_INTE armed = GPIO21 LEVEL_LOW only (1048576). Polled control (`eth(17, SPI)`): same lease, 0 deliveries, nothing armed. Cell: pico-eth-intn-gateway. |
>>>>>>> a7d38f0b (Pico W6300 Ethernet carrier (ethChip attr) + W5500 INTn interrupt path proven)
| Pico 2 W (M33) CYW43 WiFi traffic | FULL 2026-10-20 — openhw-pico-2-w joins the fake AP + gateway DHCP (STATUS=3, IP=192.168.4.2) via unified gateway :5030; runner boots the RP2350/M33 arch (arch 2) and enables CYW43 + WS pump, engine from owner folder (vite alias). Cell: pico2-w-wifi-gateway. |
| Pico 2 W (M33) LAN (2-board TCP) | FULL 2026-10-20 — two openhw-pico-2-w as STAs in one gateway room, static 192.168.4.20/.21, TCP echo both directions observed (SRV-RX:HELLO-LAN, SRV-ECHOED, CLI-RX:ECHO:HELLO-LAN, CLI-LAN-DONE). No clock attr needed — the M33 arch default (150MHz) paces the guest. Cell: pico2-w-lan. |
| Pico 2 W (M33) SoftAP | FULL 2026-10-20 — guest beginAP (APC-IP:192.168.4.1) + STA join on a static address (STS-STATUS=3, STS-IP=192.168.4.20) + TCP echo across the AP<->STA link (APC-CONN:1, STS-ECHOED, APC-RX:AP-ECHO2:HELLO-STA). The guest AP address is engine-fixed at .4.1 (softAPConfig not honored, same as M0+) and the direction is AP-client -> STA-server: the gateway fast-answers ARP for .1 and would steal the AP address from a joining STA (room.go apOwner). Cell: pico2-w-ap2. |
| Pico 2 W (M33) HTTP client | FULL 2026-10-20 — Arduino HTTPClient GET via gateway NAT (10.150.211.85 -> host :8092): HTTP-STATUS=3, HTTP-IP=192.168.4.2, HTTP-CODE:200, HTTP-BODY:hello-openhw. Cell: pico2-w-http-gateway. |
| Pico 2 ETH (M33) W5500 traffic | FULL 2026-10-20 — openhw-pico-2-eth full DORA via unified gateway :5030 (ETH-BEGIN-OK, conn=1, lease 192.168.4.3); MACRAW sock0 on the M33 arch, tickMHz 125 (same engine-side quirk as the M0+ ETH cell). Cell: pico2-eth-gateway. |
| Pico 2 ETH (M33) LAN (2-board W5500 TCP) | FULL 2026-10-20 — two openhw-pico-2-eth in one gateway room, static 192.168.4.20/.21, TCP echo over the W5500 MACRAW path (ETH-BEGIN-OK both, ESRV-IP=192.168.4.20, ECLI-IP=192.168.4.21, ECLI-CONN:1, ESRV-ECHOED, ECLI-RX:ECHO:HELLO-LAN). tickMHz 125 on both boards. Two engine-side facts the cell must respect: the guest waits need delay() (the arduino-pico lwIP pump only runs while the sketch yields — under a busy spin the client emits no frame at all), and both boards keep the engine's default W5500 MAC (4E:55:30:31:02:01, from the engine's fixed Pico board id) — with an explicit per-board eth.begin(mac) the peer's ARP reply is never delivered (the peer never emits it) and connect() times out; engine-side, reported to the owner. Cell: pico2-eth-lan. |
| Pico 2 ETH (M33) HTTP client | FULL 2026-10-20 — Arduino HTTPClient GET via gateway NAT on the W5500 stack: ETH-BEGIN-OK, ETH-IP=192.168.4.4, ETH-GW=192.168.4.1, HTTP-CODE:200, HTTP-BODY:hello-openhw. Cell: pico2-eth-http-gateway. |
| Pico 2 ETH (M33) W6300 traffic | FULL 2026-10-20 — same `ethChip:'w6300'` attr on openhw-pico-2-eth (FQBN wiznet_6300_evb_pico2, RP2350/M33 arch): version=0x61, MAC RAW mode, ETH-BEGIN-OK, lease 192.168.4.4, HTTP 200 + body hello-openhw through the gateway NAT. Cell: pico-eth-w6300-gateway. |
| Pico USB device | NONE (usb.c; CDC→UART rewrite, no cell; real silicon does device+host) |
| Pico RTC (rtc.c) | NONE (model exists; RP2040 has no RTC silicon — RP2350 stamps only) |
| Pico SD/FATFS (sdcard.c, fatfs.c) | NONE |
| ESP32 WiFi link | FULL 2026-10-15 — Arduino STA join + gateway DHCP (STATUS=3, scan + IP) via unified gateway :5030; runner passes config.wifi + throttled stats telemetry. Root cause of the RED was a host-side SAB wedge (stats CMD unserviced mid-run), fixed inline in the vendor mirror (see session notes); engine itself exonerated. |
| ESP32-CAM WiFi link | FULL 2026-10-20 — openhw-esp32-cam STA join + gateway DHCP (STATUS=3, IP=192.168.4.4) on the esp32-cam board preset (4MB flash + 4MB PSRAM, picked from the board type by esp32-runner.ts); engine dials :5030 at boot. Firmware target is the core's generic esp32:esp32:esp32 build (the frontend maps the cam shell to kind 'esp32'; no per-shell FQBN override). Cell: esp32-cam-wifi-gateway. |
| ESP32-CAM LAN (2-board TCP) | FULL 2026-10-20 — two openhw-esp32-cam as STAs in one gateway room, static 192.168.4.20/.21, TCP echo both directions observed (CSRV-STATUS=3, CSRV-IP=192.168.4.20, CCLI-STATUS=3, CCLI-IP=192.168.4.21, CCLI-CONN:1, CSRV-RX:HELLO-LAN, CSRV-ECHOED, CCLI-RX:ECHO:HELLO-LAN). Needs the per-board MAC attr (macAddress 24:6F:28:00:00:21/:22, new in esp32-runner.ts): without it the STA MAC is all zeros (00:00:00:00:00:00), the gateway's ARP reply never resolves on the guest and two boards in one room would share one DHCP lease. Cell: esp32-cam-lan. |
| ESP32-CAM HTTP client | FULL 2026-10-20 — Arduino HTTPClient GET via gateway NAT (10.150.211.85 -> host :8092): STATUS=3, IP=192.168.4.6, HTTP-CODE:200, HTTP-BODY:hello-openhw (same per-board MAC attr; the scan runs after the proof markers, off the proof path). Cell: esp32-cam-http-gateway. |
| ESP32 multi-board boot | FULL 2026-10-20 — two ESP32 boards in ONE run now boot and run (before this, a 2-board ESP32 run produced NO serial at all). The engine's SAB CMD field holds ONE slot and run() is fire-and-forget, so in multi-board mode the lockstep tick's CMD flood (GPIO-change + 8x LEDC + TWAI/RMT/camera polls — 36.6k CMD exchanges measured in one 90s run) always overwrote the pending RUN and the guest never started. esp32-runner.ts now gates every CMD-posting poll on the core being provably alive and re-posts RUN every 250ms while it is idle (frontend-side fix, no engine change). |
| ESP32 BLE | ABSENT (no engine model) |
| ESP32 PCNT / SDMMC / ULP / FreeRTOS tasks / eFuse | NONE each (models exist) |
| ESP32 USB-CDC (usbcdc.rs) | ABSENT at board level (classic ESP32, no USB silicon) |
| F1 USB-FS extra (usb.rs/otg.rs in engine) | NONE on bluepill (FS-device capable; F105/107 OTG ABSENT on C8) |
| F4 DMA2D | NONE (F429 flag true, gate unused) |
| micro:bit NFC / USB | NONE (NFC silicon) / ABSENT (USBD not pinned on v2 board) |
| LittleFS/SPIFFS anywhere | NONE (no cell) |


## Infra notes (2026-10-10/11)

- F4 pace breakthrough: LOAD-sized chunking (same instructions, more SysTick
  fires per tick) took Disco 45→288 guest-ms/s (6.4x), guardrails green.
  TickMHz divider — see the 2026-10-20 correction below (it is NOT inert;
  the old verdict came from the step-counted pace pill, which is
  divider-independent by construction).
- Engine adoptions: F1 bytes (130 MIPS showcase), F4 bytes (42 MIPS warmed) —
  both export-verified, guardrail-proven. ESP32 bytes refreshed (no speedup).
- ESP32 boot chain fixed (crypto stub, WASM handoff, TWAI wedge, seedMMU
  removal); OLED cell green centrally. TWAI-TX oracle + SD-SPI + sleep are
  engine-side NO-GOs.
- F1 DHT nan regression under active hunt (runner exonerated by A/B, engine
  bytes verified, firmware stable) — bluepill cell marked RED until green.
  RESOLVED 2026-10-20: the RED was the app running the STALE npm engine
  bytes (see below), not the engine; with the pinned owner bytes the cell
  is green 8/8 (BP), 8/8 (MP+CB via maple-cb-2) and 12/12 (gd32 wave2).
  The per-read nan intermittency itself is still there (~1 in 8 reads).
- F1 ENGINE BYTES re-pinned 2026-10-20 (single resolution point):
  the F1 runner resolves `stm32f1-emu` → the npm package, so dev AND the
  built app both ran the OLD npm build (glue 7387b216 / wasm ddfbc2a5 /
  facade 44845aa9 / emulator d2f7fcf3 — 132 wasm exports, pin events as
  triples), while public/vendor carried a THIRD byte set (glue 43c24f16 /
  wasm d1e69c28) that nothing ever loaded. The npm build is an older build
  of the same engine: no `instruction_count_now` / `i2c_clear_rx` /
  `tim_chan_pin` exports and no edge tcount → SoftSerial RX + I2C RTC RED.
  Fix: the owner's matched byte set is committed in src/engines/stm32f1-emu
  (glue 43c24f16 + wasm d1e69c28 + emulator 091a0746 + facade f2cff22c — one
  build, 135 exports) and vite.config.js aliases the npm-shaped specifiers
  onto it, so dev, the built bundle (hashed wasm asset) and the /vendor
  runtime fallback all load the SAME pair. An alias to the owner FOLDER is
  not deployable: the container build (deploy.yml → Dockerfile) checks out
  only this repo + openhw-studio-emulator, so an absolute owner path is a
  hard vite failure, and the owner rebuilds that folder every few minutes,
  so dev could never match a committed deploy snapshot.
- DEPLOY BUILD HAZARD (found 2026-10-20, pre-existing): vite.config.js still
  aliases pico-emu + esp32-emu to absolute owner-folder paths. Those folders
  do not exist in the CI/Docker build → "[vite:load-fallback] Could not load
  …" = build failure. F1 was therefore pinned to repo-committed bytes
  instead of the owner folder; pico/esp32 need the same treatment.


- Pace pill now reports step-counted virtual time (was wall clock — always
  ~100%). Expect single digits on F4 at 1x; that is the truth.
- PROOF STANDARD (new): every board proves guest-time advance — pace specs
  assert monotonic millis + divider markers vs wall elapsed, alongside the
  serial needle. Speed is a main test now, not an observation.
- F4 tickMHz divider: the 2026-10-10 "PROVEN INERT" verdict was WRONG and
  is retracted 2026-10-20. It was taken from the step-counted pace pill
  (virt-ms/s), which is divider-independent BY CONSTRUCTION and therefore
  could not observe the effect. Measured A/B on the deployed engine bytes
  (wasm md5 9455e31c, glue md5 19a9630), same sketch (Disco + MAX7219),
  same box, back to back, guest-ms per WALL second:
    tickMHz:24 (div=7) -> 1267   |   default (div=1) -> 158      (8.0x)
  and in an earlier session with a lighter sketch: 469 vs 106 (4.4x) —
  the ratio moves with the host load, because a 7x-faster SysTick also
  means 7x more ISR entries and on a busy host the ISR storm eats part
  of the gain. So the divider really does speed the GUEST clock up
  ~4-8x (the guest SysTick LOAD is rewritten 168000 -> 24000). The e2e
  cell `stm32f4-clock` proves the divider is ARMED (the F4CLK:div=7 write
  receipt) and that the guest clock advances in exact delay(2000) quanta
  (measured: 50 of 50 sample pairs exactly +2000 guest-ms); it
  deliberately makes NO acceleration claim (one run cannot measure a
  ratio) and it asserts the guest advance in guest-time quanta, not in
  wall-dependent milliseconds — the old "max(millis) >= 8000" floor turned
  the cell into a host-speed test (on a slow host the guest clock only
  reached ~2300 guest-ms in 120 s and the cell failed although the clock
  was fine: it had advanced by exactly one delay quantum). F4 preset is
  attr-only (no menu); F1/Pico/ESP32 dividers share the design and are
  UNVERIFIED for effect — no acceleration claims until pace tables prove
  them (Pico set_clock and ESP32 nanos-scaler are engine-honored by code
  reading, still unproven live).

## Deliberately out of scope (engine-limited)

- USB-HOST everywhere (all engine USB models are device-only).
- DSI, SWD/JTAG/DFU/OTA (no host/enumeration model anywhere).
- Native CAN-FD on F1/F4/ESP32 (classic-only silicon; FD proven via AVR MCP2518FD).

## Next to prove (NONE cells worth a cell)

1. F4 CAN-2.0 (bxCAN like F1) — same loopback recipe as stm32-can.
2. SAI full-duplex wording stays narrow unless the model gains clocking.
3. Mega/Nano/MapleMini sweeps (same cores, low risk).
4. F1 USB-DEV cell (real C8 silicon; engine taps verified, plan in .tmp-vitest/usb-f1-plan.md).

Deferred to the user (not queued): all WiFi/ETH — F4 EMAC (plan in
.tmp-vitest/eth-plan.md), ESP32 WiFi link, Pico CYW43/W5500 traffic.
