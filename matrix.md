# Board × Protocol Coverage Matrix

Living tracker. Cell values: `FULL` (green e2e proof) / `PARTIAL` (note what's
missing) / `NONE` (silicon-capable, no proof yet) / `ABSENT` (no such silicon) /
`NO-GO` (deliberately declined, reason noted) / `RED` (spec failing) /
`PENDING` (reserved; zero PENDING cells — all sections survey-verified).

- Proof = serial needle + telemetry/liveOop evidence in the named spec.
- Last updated: 2026-10-09 (all sections survey-verified; RED column fills from sweep).

## STM32F1 (survey-verified 2026-10-09; DHT RED all-F103 — intermittent per-read nan under hunt; all other stm32* cells green)

| Board | UART | SoftSerial | I2C | SPI | ADC | PWM | DAC | DMA | GPIO-in | RTC | CAN-2.0 | CAN-FD | I2S | 1-Wire/DHT | USB-DEV | USB-HOST | ETH | SDIO | SD-SPI | MicroPython | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-stm32-bluepill | FULL | FULL (TX+RX loopback) | FULL (OLED+LCD+MPU+BMP) | PARTIAL (TX/write-only; MISO-read gap) | FULL | FULL | ABSENT | NONE (DMA1, no cell) | FULL | FULL (SET) | FULL (bxCAN loopback) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | RED (per-read nan ~12-16% on all F103 boards; reads exact 24.00/50.00 when good; census BP 3/26, CB 4/25, MP 4/26) | NONE (FS-device capable) | ABSENT | ABSENT | ABSENT | NONE (SPI-capable, no F1 SD cell) | NONE | FULL (OLED+LCD+MAX7219+595) |
| openhw-stm32-maple-mini | FULL | FULL (TX+RX) | FULL | PARTIAL (same write-only gap) | FULL | FULL | ABSENT | FULL (TCIF1) | FULL | FULL | FULL (exact loopback) | NO-GO | NONE | RED (same all-F103 intermittent nan; census MP 4/26) | NONE | ABSENT | ABSENT | ABSENT | NONE | ABSENT | FULL (sweep OLED+MAX7219) |
| openhw-stm32f103cb | FULL | FULL (TX+RX) | FULL | PARTIAL (same write-only gap) | FULL | FULL | ABSENT | FULL (TCIF1) | FULL | FULL | FULL (exact loopback) | NO-GO | NONE | RED (same all-F103 intermittent nan; census CB 4/25) | NONE | ABSENT | ABSENT | ABSENT | NONE | ABSENT | NONE | FULL |
| openhw-stm32-gd32f103c8 | FULL | FULL (TX+RX loopback) | FULL (OLED+RTC) | PARTIAL (TX/write-only; MISO-read gap) | FULL | FULL | ABSENT | FULL (TCIF1) | FULL | FULL (SET) | FULL (bxCAN loopback) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | RED (same all-F103 intermittent nan; reads exact 24.00/50.00) | NONE (FS-device capable) | ABSENT | ABSENT | ABSENT | NONE (SPI-capable, no F1 SD cell) | NONE | PARTIAL (OLED+MAX7219) |
| openhw-stm32-gd32f103cb | FULL | FULL (TX+RX loopback) | FULL (OLED+RTC) | PARTIAL (TX/write-only; MISO-read gap) | FULL | FULL | ABSENT | FULL (TCIF1) | FULL | FULL (SET) | FULL (bxCAN loopback) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | RED (same all-F103 intermittent nan; reads exact 24.00/50.00) | NONE (FS-device capable) | ABSENT | ABSENT | ABSENT | NONE (SPI-capable, no F1 SD cell) | NONE | PARTIAL (OLED+MAX7219) |
| openhw-stm32-gd32f103rb | FULL | FULL (TX+RX loopback) | FULL (OLED+RTC) | PARTIAL (TX/write-only; MISO-read gap) | FULL | FULL | ABSENT | FULL (TCIF1) | FULL | FULL (SET) | FULL (bxCAN loopback) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | RED (same all-F103 intermittent nan; reads exact 24.00/50.00) | NONE (FS-device capable) | ABSENT | ABSENT | ABSENT | NONE (SPI-capable, no F1 SD cell) | NONE | PARTIAL (OLED+MAX7219) |

UART note: all FULL cells prove TX; HW-UART RX loopback unproven (SW-UART RX
proven on bluepill only).
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
| openhw-stm32f4 (F407 disco) | FULL | FULL (OLED) | FULL (MAX7219+SD) | FULL | FULL | FULL (loopback) | NONE | NONE | NONE | NONE (CAN hw, no F4 CAN cell) | NO-GO | NONE (I2S2/3) | NONE | FULL (CDC echo) | ABSENT (device-only model) | NONE (deferred — user takes ETH/WiFi later) | FULL (block5 exact) | FULL (raw+FS) | NONE (flag true; scanout proven F429-only) | NONE (flag true; proven F429-only) | NONE (flag true; proven F429-only) | NONE (flag true; proven F429-only) | NONE (sai:[1]; proven F429-only) | NONE | FULL (OLED+MAX7219; no ILI9341-on-STM32 cell) |
| openhw-stm32f401 | FULL | FULL (OLED) | FULL (MAX7219) | FULL | FULL | ABSENT | NONE | FULL | FULL | ABSENT (can:[]) | NO-GO | NONE | NONE | NONE | ABSENT | ABSENT (no MAC) | FULL | FULL (raw; FS NO-GO engine-side) | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | NONE | FULL (OLED/MAX7219) |
| openhw-stm32f411 | FULL | FULL (OLED) | FULL (MAX7219) | FULL | FULL | ABSENT | NONE | FULL | FULL | ABSENT (can:[]) | NO-GO | NONE | NONE | NONE | ABSENT | ABSENT (no MAC) | FULL | FULL (raw; FS NO-GO engine-side) | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | NONE | FULL (OLED/MAX7219) |
| openhw-stm32f407ve | FULL | FULL (OLED) | FULL (MAX7219) | FULL | FULL | FULL (loopback) | NONE | FULL | FULL | FULL (exact loopback) | NO-GO | NONE | NONE | FULL (CDC echo) | ABSENT | NONE (deferred — user takes ETH/WiFi later) | FULL | FULL (raw; FS NO-GO engine-side) | NONE (flag; proven F429-only) | NONE | NONE | NONE | NONE (sai:[1]) | NONE | FULL (OLED/MAX7219) |
| openhw-stm32f429 | FULL | FULL (OLED) | FULL (MAX7219) | FULL | FULL | FULL (loopback) | NONE (DMA2D gate unused) | FULL | FULL | FULL (exact loopback) | NO-GO | NONE | NONE | NONE | ABSENT | NONE (deferred — user takes ETH/WiFi later) | FULL | FULL (raw; FS NO-GO engine-side) | FULL (scanout, exact pixels) | FULL (capture, DR sum exact) | FULL* (model extension — no F4 silicon; image plumbing proven) | FULL (8080 burst, RDDID exact) | PARTIAL (DR data-path only) | NONE | FULL (OLED/MAX7219; LTDC proven) |

Specs: stm32f4-sdio, stm32f4-ltdc, stm32f4-usb, stm32f4-dcmi, stm32f4-qspi,
stm32f4-fsmc, stm32f4-sai, stm32f4-dac, stm32f4-adc, stm32f4-pwm, stm32f4-spi,
stm32f4-sd, stm32f4-sd-fs, stm32f4-sweep, multi-board-uart,
stm32f4-dcmi, stm32f4-qspi, stm32f4-fsmc, stm32f4-sai, stm32f4-can(+x),
stm32f4-429-periph, stm32f4-periph-x, stm32f4-store-x, stm32f4-display-x,
stm32f4-gpio-rtc, stm32f4-crc-rng-x, stm32f4-1wire, stm32f4-usb-ve,
stm32f4-can(+x), stm32f4-429-periph, stm32f4-periph-x, stm32f4-store-x (VE DAC),
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
pico2-mp-i2c, pico2-rv32, multi-board-uart, arch-clocks.

## ESP32 (DevKit + CAM shell — survey-verified 2026-10-09)

| Board | UART | I2C | SPI | ADC | PWM/LEDC | DAC | DMA | GPIO-in | 1-Wire | DHT-RMT | TWAI | I2S | Camera | MicroPython | WiFi/ETH | SD-SPI | Display-ext | Touch |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-esp32 | FULL | FULL | FULL | FULL | FULL | FULL (loopback) | NONE | PARTIAL (input path via pumps; no switch→digitalRead cell; output readback gap) | FULL (bit-bang + Dallas, centrally green) | FULL (RMT transport) | PARTIAL (RX only; TX needs ACKing peer) | FULL (DAC out) | FULL (QQVGA via camcell) | FULL (I2C) | NONE (deferred) | NONE | PARTIAL (SSD1306+MAX7219 proven; ILI9341/ePaper/N5110 not) | NONE |
| openhw-esp32-cam | FULL | NONE | NONE | NONE | NONE | ABSENT (no 25/26 on shell) | NONE | NONE | NONE | NONE | NONE (no 21/22 on shell) | NONE | FULL (QQVGA) | NONE | NONE | NONE | NONE | NONE |

Specs: esp32-i2c, esp32-spi, esp32-adc, esp32-pwm, esp32-dac, esp32-onewire,
esp32-dht22, esp32-twai (RX), esp32-i2s-tx, esp32-camcell (DevKit camera),
esp32-camboard (cam shell), esp32-mp-i2c,
esp32-twai-tx (RX proven; TX oracle NO-GO engine-side), esp32-rmt-ir,
esp32-touch, esp32-cam-adc, esp32-gpio-in, esp32-nvs, esp32-interrupts
(centrally green), esp32-ili9341 (centrally green), esp32-sys, esp32-pcnt,
esp32-sdspi, esp32-epaper, esp32-n5110, esp32-wdt-sleep, esp32-cam-sweep,
esp32-cam-mp, esp32-cam-sdspi, esp32-freertos, esp32-hash-crc.

## micro:bit v2 / Retro (survey-verified 2026-10-09)

| Board | UART | I2C | SPI | ADC | DMA | GPIO | Button/Touch | Display | RTC | NVS/EEPROM | MicroPython | I2S | 1-Wire |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-microbit-v2 | PARTIAL (TX only; no RX path) | FULL (OLED) | FULL (loopback) | NONE (SAADC fill exists, no cell) | PARTIAL (EASYDMA pumps exercised, no memcpy cell) | PARTIAL (Button-A proven; generic digitalRead unproven) | PARTIAL (button-A FULL; capacitive touch unproven) | PARTIAL (OLED + matrix proven; SPI displays not) | NONE | NONE (NVMC-capable) | ABSENT (fixed-bin only) | NONE (real I2S silicon) | NONE (GPIO-capable) |

| Board | UART | GPIO | GPIO-in | Bit-bang (I2C/SPI/PWM/SD) | ADC | MicroPython |
|---|---|---|---|---|---|---|
| openhw-8086 | FULL (TX + RX-echo) | FULL | FULL (switch→L2) | NONE (capable) | ABSENT (stub NaN) | ABSENT (asm only) |
| openhw-8088 | PARTIAL (TX; RX-echo typed 8086 only) | NONE (inject exists, no cell) | NONE | NONE (capable) | ABSENT | ABSENT |
| openhw-8085 | FULL (console TX) | FULL (LED) | NONE | NONE (capable) | ABSENT | ABSENT |
| openhw-8051 | FULL (console TX) | PARTIAL (LOW-sink only, quasi-bidirectional) | NONE | NONE (capable) | ABSENT | ABSENT |
| openhw-6502 | FULL (console TX) | FULL (LED) | NONE | NONE (capable) | ABSENT | ABSENT |
| openhw-z80 | FULL (console TX) | FULL (LED) | NONE | NONE (capable) | ABSENT | ABSENT |
| openhw-rv32 | FULL (console TX) | ABSENT (no GPIO model) | ABSENT | ABSENT | ABSENT | ABSENT |

Specs: microbit-cells (5 cases), retro-boards (7 ISAs), retro-gpio(+in),
retro-rx-echo (8086).

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
| STM32F4 | NONE (crc.rs) | NONE (rng.rs) | NONE (hash+cryp.rs) | NONE (iwdg.rs) | NONE (exti.rs) | NONE (pwr.rs) | NONE | NONE | NONE (dbgmcu; ITM/DWT) |
| AVR | ABSENT | ABSENT | ABSENT | PARTIAL (Uno+Nano reboot+ISR; Mega vector absent, Tiny deferred) | PARTIAL (Mega+Nano/328P exact-count; Tiny INT0 unproven) | NONE | EEPROM covered in main table | PARTIAL (mega+nano+tiny gate cells) | ABSENT |
| Pico | ABSENT | NONE (ROSC jitter, no cell) | NONE on RP2350 (real SHA-256 silicon); ABSENT on RP2040 | NONE | NONE (nvic.c) | NONE | NONE (sdd_eeprom.c) | PARTIAL (arch-clocks: M33; clocks.c) | NONE (gdb.c) |
| ESP32 | NONE | NONE (rng in rmt_rng_math.rs) | NONE (aes+rsa+sha_ecc_key.rs) | NONE (timers.rs MWDT) | NONE | NONE (ULP present, unproven) | NONE (partition_table+NVS) | NONE (clock(s).rs) | NONE (gdb_session) |
| micro:bit v2 | ABSENT | NONE (nRF RNG+TEMP) | ABSENT | NONE | NONE (PPI+GPIOTE) | NONE | NONE (NVMC-backed NVS) | NONE | ABSENT |
| Retro | ABSENT | ABSENT | ABSENT | ABSENT | NONE (chip PIC/CTC/VIA) | ABSENT | ABSENT | NONE | ABSENT |

Connectivity extras not in the main tables:

| Feature | Status |
|---|---|
| Pico-W CYW43 WiFi traffic | NONE (deferred — user later) |
| Pico-ETH W5500/W6300 traffic | NONE (deferred — user later) |
| Pico USB device | NONE (usb.c; CDC→UART rewrite, no cell; real silicon does device+host) |
| Pico RTC (rtc.c) | NONE (model exists; RP2040 has no RTC silicon — RP2350 stamps only) |
| Pico SD/FATFS (sdcard.c, fatfs.c) | NONE |
| ESP32 WiFi link (wifi_bridge.rs) | NONE (deferred — user later) |
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
  TickMHz divider proven INERT (identical pace all presets) — menu removed.
- Engine adoptions: F1 bytes (130 MIPS showcase), F4 bytes (42 MIPS warmed) —
  both export-verified, guardrail-proven. ESP32 bytes refreshed (no speedup).
- ESP32 boot chain fixed (crypto stub, WASM handoff, TWAI wedge, seedMMU
  removal); OLED cell green centrally. TWAI-TX oracle + SD-SPI + sleep are
  engine-side NO-GOs.
- F1 DHT nan regression under active hunt (runner exonerated by A/B, engine
  bytes verified, firmware stable) — bluepill cell marked RED until green.


- Pace pill now reports step-counted virtual time (was wall clock — always
  ~100%). Expect single digits on F4 at 1x; that is the truth.
- PROOF STANDARD (new): every board proves guest-time advance — pace specs
  assert monotonic millis + divider markers vs wall elapsed, alongside the
  serial needle. Speed is a main test now, not an observation.
- F4 tickMHz divider: PROVEN INERT 2026-10-10 (preset sweep div 1/2/4/7/21:
  identical 26 virt-ms/s; wasm period doesn't follow LOAD). Menu removed;
  attr path dormant default-off. F1/Pico/ESP32 dividers share the design and
  are UNVERIFIED for effect — no acceleration claims until pace tables prove
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
