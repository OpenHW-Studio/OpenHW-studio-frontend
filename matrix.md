# Board × Protocol Coverage Matrix

Living tracker. Cell values: `FULL` (green e2e proof) / `PARTIAL` (note what's
missing) / `NONE` (silicon-capable, no proof yet) / `ABSENT` (no such silicon) /
`NO-GO` (deliberately declined, reason noted) / `RED` (spec failing) /
`PENDING` (reserved; zero PENDING cells — all sections survey-verified).

- Proof = serial needle + telemetry/liveOop evidence in the named spec.
- Last updated: 2026-10-09 (all sections survey-verified; RED column fills from sweep).

## STM32F1 (survey-verified 2026-10-09; zero RED among stm32* specs)

| Board | UART | SoftSerial | I2C | SPI | ADC | PWM | DAC | DMA | GPIO-in | RTC | CAN-2.0 | CAN-FD | I2S | 1-Wire/DHT | USB-DEV | USB-HOST | ETH | SDIO | SD-SPI | MicroPython | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-stm32-bluepill | FULL | FULL (TX+RX loopback) | FULL (OLED+LCD+MPU+BMP) | PARTIAL (TX/write-only; MISO-read gap) | FULL | FULL | ABSENT | NONE (DMA1, no cell) | FULL | FULL (SET) | FULL (bxCAN loopback) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | FULL | NONE (FS-device capable) | ABSENT | ABSENT | ABSENT | NONE (SPI-capable, no F1 SD cell) | NONE | FULL (OLED+LCD+MAX7219+595) |
| openhw-stm32-maple-mini | FULL (sweep) | NONE | FULL (sweep OLED) | PARTIAL (same write-only gap) | NONE | NONE | ABSENT | NONE | NONE | NONE | NONE (bxCAN, no per-board cell) | NO-GO | NONE | NONE | NONE | ABSENT | ABSENT | ABSENT | NONE | NONE | FULL (sweep OLED+MAX7219) |
| openhw-stm32f103cb | FULL (sweep) | NONE | FULL (sweep OLED) | PARTIAL (same write-only gap) | NONE | NONE | ABSENT | NONE | NONE | NONE | NONE (bxCAN, no per-board cell) | NO-GO | NONE | NONE | NONE | ABSENT | ABSENT | ABSENT | NONE | NONE | FULL (sweep OLED+MAX7219) |

UART note: all FULL cells prove TX; HW-UART RX loopback unproven (SW-UART RX
proven on bluepill only).
Specs: stm32-can, stm32-softserial(+tx), stm32-dht22, stm32-rtc, stm32-gpio-in,
stm32-i2c, stm32-spi, stm32-595, stm32-adc, stm32-pwm, stm32-mpu6050,
stm32-bmp180, stm32f1-sweep, stm32f1-i2c-sweep.

## STM32F4 (survey-verified 2026-10-09; chip flags from engine CHIPS table)

| Board | UART | I2C | SPI | ADC | PWM | DAC | DMA | GPIO-in | RTC | CAN-2.0 | CAN-FD | I2S | 1-Wire | USB-DEV | USB-HOST | ETH | SDIO | SD-SPI/FS | LTDC | DCMI | QSPI | FSMC | SAI | MicroPython | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-stm32f4 (F407 disco) | FULL | FULL (OLED) | FULL (MAX7219+SD) | FULL | FULL | FULL (loopback) | NONE | NONE | NONE | NONE (CAN hw, no F4 CAN cell) | NO-GO | NONE (I2S2/3) | NONE | FULL (CDC echo) | ABSENT (device-only model) | NONE (exports exist, no cell) | FULL (block5 exact) | FULL (raw+FS) | NONE (flag true; scanout proven F429-only) | NONE (flag true; proven F429-only) | NONE (flag true; proven F429-only) | NONE (flag true; proven F429-only) | NONE (sai:[1]; proven F429-only) | NONE | FULL (OLED+MAX7219; no ILI9341-on-STM32 cell) |
| openhw-stm32f401 | FULL | NONE | NONE | NONE | NONE | ABSENT | NONE | NONE | NONE | ABSENT (can:[]) | NO-GO | NONE | NONE | NONE | ABSENT | ABSENT (no MAC) | NONE (sdio:T) | NONE | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | NONE | NONE |
| openhw-stm32f411 | FULL | NONE | NONE | NONE | NONE | ABSENT | NONE | NONE | NONE | ABSENT (can:[]) | NO-GO | NONE | NONE | NONE | ABSENT | ABSENT (no MAC) | NONE | NONE | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | NONE | NONE |
| openhw-stm32f407ve | FULL | NONE | NONE | NONE | NONE | NONE (dac:T; cell ran Disco-only) | NONE | NONE | NONE | NONE (CAN hw, no cell) | NO-GO | NONE | NONE | NONE | ABSENT | NONE (MAC, no cell) | NONE | NONE | NONE (flag; proven F429-only) | NONE | NONE | NONE | NONE (sai:[1]) | NONE | NONE |
| openhw-stm32f429 | FULL | NONE | NONE | NONE | NONE | NONE (dac:T; cell ran Disco-only) | NONE (DMA2D gate unused) | NONE | NONE | NONE (CAN hw, no cell) | NO-GO | NONE | NONE | NONE | ABSENT | NONE (MAC, no cell) | NONE | NONE | FULL (scanout) | FULL (capture) | FULL (mmap) | FULL (8080) | PARTIAL (DR data-path only) | NONE | NONE (ext displays unproven; LTDC in LTDC col) |

Specs: stm32f4-sdio, stm32f4-ltdc, stm32f4-usb, stm32f4-dcmi, stm32f4-qspi,
stm32f4-fsmc, stm32f4-sai, stm32f4-dac, stm32f4-adc, stm32f4-pwm, stm32f4-spi,
stm32f4-sd, stm32f4-sd-fs, stm32f4-sweep, multi-board-uart.

## AVR (survey-verified 2026-10-09; no RED)

| Board | UART | SoftSerial | I2C | SPI | ADC | PWM | DAC | DMA | GPIO-in | RTC | EEPROM | CAN-2.0 | CAN-FD (MCP2518FD) | I2S | 1-Wire/DHT | IR | USB-DEV | ETH | SD-SPI | Modbus | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-arduino-uno | FULL | PARTIAL (TX only, RX parked) | FULL (OLED/LCD/sensors) | FULL (FD host+MFRC522+TFT) | FULL | FULL | ABSENT | ABSENT | FULL | FULL (DS1307) | FULL (AB/CD) | NONE (no controller cell) | FULL (loopback) | FULL (TX+RX) | FULL (DS18B20+DHT22) | PARTIAL (NEC envelope, no 38kHz carrier) | ABSENT | ABSENT | FULL | FULL (two-Uno) | FULL (OLED/TFT/MAX7219/LCD/NeoPixel) |
| openhw-arduino-mega | FULL | NONE | NONE | NONE | NONE | NONE | ABSENT | ABSENT | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | ABSENT | ABSENT | NONE | NONE (Modbus side is Uno) | NONE |
| openhw-arduino-nano | FULL | NONE | NONE | NONE | NONE | NONE | ABSENT | ABSENT | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | ABSENT | ABSENT | NONE | NONE | NONE |
| openhw-attiny85 | FULL | NONE | NONE | NONE | NONE | NONE | ABSENT | ABSENT | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | ABSENT | ABSENT | NONE | NONE | NONE |

Specs: avr-eeprom, avr-i2s, avr-inmp441, avr-dht22, avr-mcp2518fd, avr-modbus,
avr-softserial-tx, avr-softproto, avr-control, board-input, board-family-sweep,
cluster-d, peripherals, protocol-transactions, display-verify, human-senses,
spi-delivery-disc, i2c-ack-disc.

## Pico (survey-verified 2026-10-09; W/ETH share the base die)

| Board | UART | I2C | SPI | ADC | PWM | PIO | DMA | MicroPython | DAC | USB-DEV | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-pico (+W/+ETH) | FULL (6-variant sweep) | FULL (OLED+LCD) | FULL (MAX7219+595) | FULL | FULL | FULL (WS2812 3px) | FULL (64B exact) | FULL (I2C) | ABSENT | NONE (CDC->UART rewrite, no cell) | FULL (OLED/LCD/MAX7219) |
| openhw-pico-2 (+W/+ETH, M33) | FULL | FULL | FULL | FULL | FULL | NONE | NONE | FULL (I2C) | ABSENT | NONE | FULL |
| openhw-pico-2 (RV32) | PARTIAL (fixed image only; Arduino RV32 blocked upstream) | NONE | NONE | NONE | NONE | ABSENT | NONE | ABSENT | ABSENT | NONE | NONE |

Specs: pico-uart-sweep, pico-i2c, pico-spi, pico-595, pico-adc, pico-pwm,
pico-mp-i2c, pico-pio, pico-dma, pico2, pico2-spi, pico2-adc, pico2-pwm,
pico2-mp-i2c, pico2-rv32, multi-board-uart, arch-clocks.

## ESP32 (DevKit + CAM shell — survey-verified 2026-10-09)

| Board | UART | I2C | SPI | ADC | PWM/LEDC | DAC | DMA | GPIO-in | 1-Wire | DHT-RMT | TWAI | I2S | Camera | MicroPython | WiFi/ETH | SD-SPI | Display-ext | Touch |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-esp32 | FULL | FULL | FULL | FULL | FULL | FULL (loopback) | NONE | PARTIAL (input path via pumps; no switch→digitalRead cell; output readback gap) | FULL (25C) | FULL (RMT transport) | PARTIAL (RX only; TX needs ACKing peer) | FULL (DAC out) | FULL (QQVGA via camcell) | FULL (I2C) | NONE (deferred) | NONE | PARTIAL (SSD1306+MAX7219 proven; ILI9341/ePaper/N5110 not) | NONE |
| openhw-esp32-cam | FULL | NONE | NONE | NONE | NONE | ABSENT (no 25/26 on shell) | NONE | NONE | NONE | NONE | NONE (no 21/22 on shell) | NONE | FULL (QQVGA) | NONE | NONE | NONE | NONE | NONE |

Specs: esp32-i2c, esp32-spi, esp32-adc, esp32-pwm, esp32-dac, esp32-onewire,
esp32-dht22, esp32-twai (RX), esp32-i2s-tx, esp32-camcell (DevKit camera),
esp32-camboard (cam shell), esp32-mp-i2c.

## micro:bit v2 / Retro (survey-verified 2026-10-09)

| Board | UART | I2C | SPI | ADC | DMA | GPIO | Button/Touch | Display | RTC | NVS/EEPROM | MicroPython |
|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-microbit-v2 | PARTIAL (TX only; no RX path) | FULL (OLED) | FULL (loopback) | NONE (SAADC fill exists, no cell) | PARTIAL (EASYDMA pumps exercised, no memcpy cell) | PARTIAL (Button-A proven; generic digitalRead unproven) | PARTIAL (button-A FULL; capacitive touch unproven) | PARTIAL (OLED + matrix proven; SPI displays not) | NONE | NONE (NVMC-capable) | ABSENT (fixed-bin only) |

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

## System, crypto & connectivity blocks (audited 2026-10-09 vs engine inventories)

Same vocabulary. These have no protocol spec today; NONE = capable-or-modeled,
no e2e proof. (Inventories: F1 `stm32 emu blue pill/src/peripherals/`, F4
`stm32-periph-wasm/src/peripherals/`, ESP32 `engine-wasm/src/peripherals/*`,
Pico `Pico-emu/*.c`, runners in `src/worker/runners/`.)

| Family | CRC | TRNG/RNG | HASH/CRYP | Watchdog | EXTI/Interrupts | PWR/Sleep | Backup/NVS | Clocks | Debug |
|---|---|---|---|---|---|---|---|---|---|
| STM32F1 | NONE (crc.rs) | ABSENT (no RNG silicon) | ABSENT | NONE (iwdg+wwdg.rs) | NONE (exti.rs) | NONE (pwr.rs) | NONE (bkp.rs) | NONE (rcc.rs) | NONE (swd.rs; bootloader.rs) |
| STM32F4 | NONE (crc.rs) | NONE (rng.rs) | NONE (hash+cryp.rs) | NONE (iwdg.rs) | NONE (exti.rs) | NONE (pwr.rs) | NONE | NONE | NONE (dbgmcu; ITM/DWT) |
| AVR | ABSENT | ABSENT | ABSENT | NONE (no runner WDT) | NONE | NONE | EEPROM covered in main table | PARTIAL (arch-clocks: mega) | ABSENT |
| Pico | ABSENT | NONE (ROSC jitter, no cell) | ABSENT | NONE | NONE (nvic.c) | NONE | NONE (sdd_eeprom.c) | PARTIAL (arch-clocks: M33; clocks.c) | NONE (gdb.c) |
| ESP32 | NONE | NONE (rng in rmt_rng_math.rs) | NONE (aes+rsa+sha_ecc_key.rs) | NONE (timers.rs MWDT) | NONE | NONE (ULP present, unproven) | NONE (partition_table+NVS) | NONE (clock(s).rs) | NONE (gdb_session) |
| micro:bit v2 | ABSENT | NONE (nRF RNG+TEMP) | ABSENT | NONE | NONE (PPI+GPIOTE) | NONE | NONE (NVMC-backed NVS) | NONE | ABSENT |
| Retro | ABSENT | ABSENT | ABSENT | ABSENT | NONE (chip PIC/CTC/VIA) | ABSENT | ABSENT | NONE | ABSENT |

Connectivity extras not in the main tables:

| Feature | Status |
|---|---|
| Pico-W CYW43 WiFi traffic | NONE (cyw43.c model; no traffic proof) |
| Pico-ETH W5500/W6300 traffic | NONE (w5500.c/w6300.c; boot flag only) |
| Pico USB device | NONE (usb.c; CDC→UART rewrite, no cell) |
| Pico RTC (rtc.c) | NONE (model exists; RP2040 has no RTC silicon — RP2350 stamps only) |
| Pico SD/FATFS (sdcard.c, fatfs.c) | NONE |
| ESP32 WiFi link (wifi_bridge.rs) | NONE (deferred per runner header) |
| ESP32 BLE | ABSENT (no engine model) |
| ESP32 PCNT / SDMMC / ULP / FreeRTOS tasks / eFuse | NONE each (models exist) |
| ESP32 USB-CDC (usbcdc.rs) | ABSENT at board level (classic ESP32, no USB silicon) |
| F1 USB-FS extra (usb.rs/otg.rs in engine) | NONE on bluepill (FS-device capable; F105/107 OTG ABSENT on C8) |
| F4 DMA2D | NONE (F429 flag true, gate unused) |
| micro:bit NFC / USB | NONE (NFC silicon) / ABSENT (USBD not pinned on v2 board) |
| LittleFS/SPIFFS anywhere | NONE (no cell) |


## Deliberately out of scope (engine-limited)

- USB-HOST everywhere (all engine USB models are device-only).
- DSI, SWD/JTAG/DFU/OTA (no host/enumeration model anywhere).
- Native CAN-FD on F1/F4/ESP32 (classic-only silicon; FD proven via AVR MCP2518FD).

## Next to prove (NONE cells worth a cell)

1. F4 native ETH (model exists) — runner bridge + cell.
2. F4 CAN-2.0 (bxCAN like F1) — same loopback recipe as stm32-can.
3. SAI full-duplex wording stays narrow unless the model gains clocking.
4. Mega/Nano/MapleMini sweeps (same cores, low risk).
