// boards-registry.ts — board capability + limit registry (plan §5.6/§11).
//
// One additive data file answering, per board family: what rail it drives,
// which engine runs it, what capabilities it claims, and what engine limits
// apply. Runners, tests, and the conformance matrix read this; nothing here
// changes simulation behavior.
//
// Rules:
// - Matchers run in order, specific before generic (same discipline as
//   normalizeBoardKind in hardwareUtils.js).
// - Limits are engine facts verified against the packages, not guesses.
//   Unknown boards fall back to the 'unknown' family (safe defaults).
// - Additive only: new families append rows; existing rows are frozen
//   unless an engine fact changes (then note it in the row comment).

export interface BoardLimit {
  /** Stable machine-readable code, e.g. 'no-gpio-output-readback'. */
  code: string;
  /** Human-readable explanation + consequence for tests. */
  detail: string;
}

export interface BoardFamily {
  /** Stable family key, e.g. 'retro_8085'. */
  family: string;
  /** Substring rules evaluated in order; first full-match wins. */
  match: string[];
  /** Logic rail volts used for GPIO fan-out. */
  railVoltage: number;
  /** Engine package behind the runner. */
  engine: string;
  /** Runner file owning the engine adapter. */
  runner: string;
  /** Claimed capabilities (capability vocabulary in getComponentCapabilities). */
  capabilities: string[];
  /** Firmware kinds accepted without backend compile. */
  firmware: string[];
  /** Verified engine limits. */
  limits: BoardLimit[];
  /** Substring rules that veto a match (component shells sharing a
    family token, e.g. openhw-esp32-cam is not an ESP32 board). */
  exclude?: string[];
}

const NO_LIMITS: BoardLimit[] = [];

export const BOARD_FAMILIES: BoardFamily[] = [
  {
    family: 'arduino_uno',
    match: ['arduino-uno', 'arduino_nano', 'nano'],
    railVoltage: 5.0,
    engine: 'avr8js',
    runner: 'runners/avr-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'softserial', 'i2c-target', 'spi-target', 'pwm', 'onewire'],
    firmware: ['arduino-sketch'],
    limits: NO_LIMITS,
  },
  {
    family: 'attiny85',
    match: ['attiny85', 'attiny'],
    railVoltage: 5.0,
    engine: 'avr8js',
    runner: 'runners/avr-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc'],
    firmware: ['arduino-sketch'],
    limits: [{ code: 'attiny-path-unverified', detail: 'Routes to AVRRunner by default; no live attiny85 verification yet.' }],
  },
  {
    family: 'arduino_mega',
    match: ['arduino-mega', 'mega'],
    railVoltage: 5.0,
    engine: 'avr8js',
    runner: 'runners/avr-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'softserial', 'i2c-target', 'spi-target', 'pwm', 'onewire'],
    firmware: ['arduino-sketch'],
    limits: NO_LIMITS,
  },
  // Raspberry Pi 3 B+ / 4 B / 5 — real CPython in Pyodide driving the
  // deterministic JS peripheral models mirrored under src/engines/pyodide.
  // These are peripheral-programming models, NOT machine emulation: no Linux
  // kernel, no ARM CPU, no boot or device-driver execution (see limits).
  // Matchers are exact family tokens; 'pi3' etc. cannot hit 'pico' boards.
  {
    family: 'pi3',
    match: ['openhw-pi3', 'raspberry-pi-3', 'rpi3'],
    railVoltage: 3.3,
    engine: 'pyodide',
    runner: 'runners/rpi-pyodide-runner.ts',
    // Proved by tests/e2e/rpi-boards.spec.js: GPIO LED, I2C EEPROM/SSD1306,
    // SPI MAX7219, PWM duty/servo, ADC potentiometer roundtrip, UART both
    // directions, 1-Wire DS18B20, DHT22 and NeoPixel host reactions, plus
    // the board_info() clock/temperature/PWM-policy differences.
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'onewire', 'i2c-target', 'spi-target', 'pwm'],
    firmware: ['python-script'],
    limits: [
      { code: 'no-linux-arm-emulation', detail: 'Pyodide runs CPython shims over deterministic JS peripheral models. No Linux kernel, ARM CPU, boot firmware, real device tree or C drivers. Peripheral-level API/fidelity only.' },
      { code: 'virtual-time-only', detail: 'time.sleep/monotonic/time advance an in-process virtual millisecond clock instantly; no wall-clock-real-time scheduling, OS threads or hardware interrupts.' },
      { code: 'pi3-pwm-pin-policy', detail: 'BCM2837 PWM is limited to GPIO 12/13/18/19; pwmCreate() on any other GPIO raises. Model clock 1200 MHz, CPU temp baseline 45 C.' },
      { code: 'camera-no-host-component', detail: 'picamera2 shim returns a deterministic in-memory test pattern; there is no wired host camera component/model in the studio to react to a capture, so no camera cell is claimed (test.skip with this reason).' },
      { code: 'dht-neopixel-no-cap-code', detail: 'DHT22 and NeoPixel cells are green, but the conformance vocabulary has no dht/neopixel need code; their proof lives in rpi-boards.spec.js telemetry, not in the capability matrix.' },
    ],
  },
  {
    family: 'pi4',
    match: ['openhw-pi4', 'raspberry-pi-4', 'rpi4'],
    railVoltage: 3.3,
    engine: 'pyodide',
    runner: 'runners/rpi-pyodide-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'onewire', 'i2c-target', 'spi-target', 'pwm'],
    firmware: ['python-script'],
    limits: [
      { code: 'no-linux-arm-emulation', detail: 'Pyodide runs CPython shims over deterministic JS peripheral models. No Linux kernel, ARM CPU, boot firmware, real device tree or C drivers. Peripheral-level API/fidelity only.' },
      { code: 'virtual-time-only', detail: 'time.sleep/monotonic/time advance an in-process virtual millisecond clock instantly; no wall-clock-real-time scheduling, OS threads or hardware interrupts.' },
      { code: 'pi4-pwm-pin-policy', detail: 'BCM2711 PWM is limited to GPIO 12/13/18/19; pwmCreate() on any other GPIO raises. Model clock 1500 MHz, CPU temp baseline 50 C.' },
      { code: 'camera-no-host-component', detail: 'picamera2 shim returns a deterministic in-memory test pattern; there is no wired host camera component/model in the studio to react to a capture, so no camera cell is claimed (test.skip with this reason).' },
      { code: 'dht-neopixel-no-cap-code', detail: 'DHT22 and NeoPixel cells are green, but the conformance vocabulary has no dht/neopixel need code; their proof lives in rpi-boards.spec.js telemetry, not in the capability matrix.' },
    ],
  },
  {
    family: 'pi5',
    match: ['openhw-pi5', 'raspberry-pi-5', 'rpi5'],
    railVoltage: 3.3,
    engine: 'pyodide',
    runner: 'runners/rpi-pyodide-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'onewire', 'i2c-target', 'spi-target', 'pwm'],
    firmware: ['python-script'],
    limits: [
      { code: 'no-linux-arm-emulation', detail: 'Pyodide runs CPython shims over deterministic JS peripheral models. No Linux kernel, ARM CPU (BCM2712/RP1), boot firmware, real device tree or C drivers. Peripheral-level API/fidelity only.' },
      { code: 'virtual-time-only', detail: 'time.sleep/monotonic/time advance an in-process virtual millisecond clock instantly; no wall-clock-real-time scheduling, OS threads or hardware interrupts.' },
      { code: 'pi5-rp1-pwm-policy', detail: 'RP1 accepts PWM on any valid header GPIO (no 12/13/18/19 restriction). Model clock 2400 MHz, PWM clock 200 MHz, CPU temp baseline 55 C.' },
      { code: 'camera-no-host-component', detail: 'picamera2 shim returns a deterministic in-memory test pattern; there is no wired host camera component/model in the studio to react to a capture, so no camera cell is claimed (test.skip with this reason).' },
      { code: 'dht-neopixel-no-cap-code', detail: 'DHT22 and NeoPixel cells are green, but the conformance vocabulary has no dht/neopixel need code; their proof lives in rpi-boards.spec.js telemetry, not in the capability matrix.' },
    ],
  },
  {
    family: 'pico_2_eth',
    match: ['pico-2-eth', 'pico2-eth', '5500_evb_pico2'],
    railVoltage: 3.3,
    engine: 'pico-emu',
    runner: 'runners/pico-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'softserial', 'ethernet'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: [{ code: 'ethernet-gateway', detail: 'W5500 MACRAW via unified gateway (:5030); sockets 1-7 offload deferred. W6300 carrier: board attr ethChip=w6300 (same room/pool/pump).' }],
  },
  {
    family: 'pico_eth',
    match: ['pico-eth', 'picoeth', '5500_evb_pico', 'w5500'],
    railVoltage: 3.3,
    engine: 'pico-emu',
    runner: 'runners/pico-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'softserial', 'ethernet'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: [{ code: 'ethernet-gateway', detail: 'W5500 MACRAW via unified gateway (:5030); sockets 1-7 offload deferred. W6300 carrier: board attr ethChip=w6300 (same room/pool/pump).' }],
  },
  {
    family: 'pico_2_w',
    match: ['pico-2-w', 'pico2w', 'rpipico2w'],
    railVoltage: 3.3,
    engine: 'pico-emu',
    runner: 'runners/pico-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'softserial', 'wifi'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: [{ code: 'wifi-gateway', detail: 'CYW43 via unified gateway (:5030); BLE HCI deferred.' }],
  },
  {
    family: 'pico_w',
    match: ['pico-w', 'picow', 'rpipicow'],
    railVoltage: 3.3,
    engine: 'pico-emu',
    runner: 'runners/pico-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'softserial', 'wifi'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: [{ code: 'wifi-gateway', detail: 'CYW43 via unified gateway (:5030); BLE HCI deferred.' }],
  },
  {
    family: 'rp2350',
    match: ['pico-2', 'pico2', 'rp2350', '2350'],
    railVoltage: 3.3,
    engine: 'pico-emu',
    runner: 'runners/pico-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'softserial', 'pwm', 'i2c-target', 'spi-target'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: NO_LIMITS,
  },
  {
    family: 'rp2040',
    match: ['rp2040', 'pico'],
    railVoltage: 3.3,
    engine: 'pico-emu',
    runner: 'runners/pico-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'softserial', 'pwm', 'i2c-target', 'spi-target'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: NO_LIMITS,
  },
  {
    family: 'esp32sc',
    // Specific before the generic `esp32` family below: 'openhw-esp32sc'
    // contains 'esp32', so this row must win. No exclude — the component is
    // its own board shell (openhw-esp32sc), not a peripheral sharing a token.
    match: ['esp32sc'],
    railVoltage: 3.3,
    engine: 'esp32sim',
    runner: 'runners/esp32sc-runner.ts',
    // Only what is proved in the browser A/B spec: classic ESP32 boots from
    // the esp32sim mask ROM + merged flash image and streams guest serial.
    capabilities: ['uart'],
    firmware: ['arduino-sketch'],
    limits: [
      {
        code: 'no-gpio-output-readback',
        detail: 'esp32sim_new_bridge refuses classic ESP32 ("the host bridge supports only S3, C3 and C6 boards", verified against the staged WASM). No GPIO output readback/edge export is reachable, so firmware-driven LED components cannot be lit. The GPIO LED cell is test.skip, never weakened.',
      },
      {
        code: 'no-i2c-spi-pwm-adc-i2s-bridge',
        detail: 'The same bridge refusal makes esp32sim_bridge_{i2c,spi,pwm,adc,i2s}_* unreachable on classic ESP32. Host I2C EEPROM / SSD1306 / SPI MAX7219 / PWM / ADC / I2S component cells cannot be driven; skipped with this reason.',
      },
      {
        code: 'merged-flash-image-only',
        detail: 'Firmware must be the backend compiled merged .bin (bootloader@0x1000 + ptable@0x8000 + app@0x10000) loaded with esp32sim_load(kind=5), or Intel HEX text. MicroPython images / REPL injection are not bridged.',
      },
      {
        code: 'no-wifi-gateway',
        detail: 'WiFi/gateway dialing and the esp32sim network exports are not bridged by this runner; classic WiFi cells are out of scope for the A/B.',
      },
    ],
  },
  {
    family: 'esp32_cam',
    match: ['esp32-cam', 'esp32_cam', 'esp32cam'],
    railVoltage: 3.3,
    engine: 'esp32-emu',
    runner: 'runners/esp32-runner.ts',
    capabilities: ['digital-gpio-input', 'analog-adc', 'uart', 'onewire', 'pwm', 'i2c-target', 'spi-target', 'i2s', 'twai', 'camera', 'wifi'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: [{ code: 'no-gpio-output-readback', detail: 'SAB proxy exposes setPinInput only; firmware-driven outputs cannot light components.' }, { code: 'wifi-gateway', detail: 'WiFi via unified gateway (:5030); engine dials at boot.' }],
  },
  {
    family: 'esp32',
    match: ['esp32'],
    // openhw-esp32-cam resolves to the esp32_cam family above (not here):
    // the runner boots it on the esp32-cam board preset (4MB flash + 4MB
    // PSRAM) instead of dying on "Unknown chip: esp32-cam".
    exclude: ['-cam'],
    railVoltage: 3.3,
    engine: 'esp32-emu',
    runner: 'runners/esp32-runner.ts',
    capabilities: ['digital-gpio-input', 'analog-adc', 'uart', 'onewire', 'pwm', 'i2c-target', 'spi-target', 'i2s', 'twai', 'wifi'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: [{ code: 'no-gpio-output-readback', detail: 'SAB proxy exposes setPinInput only; firmware-driven outputs cannot light components.' }, { code: 'wifi-gateway', detail: 'WiFi via unified gateway (:5030); engine dials at boot.' }],
  },
  {
    family: 'stm32_maple_mini',
    match: ['maple'],
    railVoltage: 3.3,
    engine: 'stm32f1-emu',
    runner: 'runners/stm32f1-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart'],
    firmware: ['arduino-sketch'],
    limits: NO_LIMITS,
  },
  {
    family: 'stm32_nucleo_f103rb',
    match: ['nucleo'],
    railVoltage: 3.3,
    engine: 'stm32f1-emu',
    runner: 'runners/stm32f1-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart'],
    firmware: ['arduino-sketch'],
    limits: NO_LIMITS,
  },
  {
    family: 'stm32_gd32',
    match: ['gd32'],
    railVoltage: 3.3,
    engine: 'stm32f1-emu',
    runner: 'runners/stm32f1-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart'],
    firmware: ['arduino-sketch'],
    limits: NO_LIMITS,
  },
  {
    family: 'stm32f1',
    match: ['stm32f1', 'bluepill', 'blue-pill', '103', 'stm32'],
    railVoltage: 3.3,
    engine: 'stm32f1-emu',
    runner: 'runners/stm32f1-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'pwm', 'i2c-target', 'spi-target'],
    firmware: ['arduino-sketch'],
    limits: NO_LIMITS,
  },
  {
    family: 'stm32f429',
    match: ['429', 'f429'],
    railVoltage: 3.3,
    engine: 'stm32f4-emu',
    runner: 'runners/stm32f4-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'ethernet'],
    firmware: ['arduino-sketch'],
    limits: [{ code: 'uart-tx-global-tap', detail: 'TX capture is global to usart1 regardless of port.' }, { code: 'ethernet-gateway', detail: 'On-chip MAC via unified gateway (:5030); link driven up at boot.' }],
  },
  {
    family: 'stm32f407ve',
    match: ['407ve', '407ze', 'f407ve'],
    railVoltage: 3.3,
    engine: 'stm32f4-emu',
    runner: 'runners/stm32f4-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'ethernet'],
    firmware: ['arduino-sketch'],
    limits: [{ code: 'uart-tx-global-tap', detail: 'TX capture is global to usart1 regardless of port.' }, { code: 'ethernet-gateway', detail: 'On-chip MAC via unified gateway (:5030); link driven up at boot.' }],
  },
  {
    family: 'stm32f401',
    match: ['401', 'f401'],
    railVoltage: 3.3,
    engine: 'stm32f4-emu',
    runner: 'runners/stm32f4-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart'],
    firmware: ['arduino-sketch'],
    limits: [{ code: 'uart-tx-global-tap', detail: 'TX capture is global to usart1 regardless of port.' }],
  },
  {
    family: 'stm32f411',
    match: ['411', 'f411'],
    railVoltage: 3.3,
    engine: 'stm32f4-emu',
    runner: 'runners/stm32f4-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart'],
    firmware: ['arduino-sketch'],
    limits: [{ code: 'uart-tx-global-tap', detail: 'TX capture is global to usart1 regardless of port.' }],
  },
  {
    family: 'stm32f4',
    match: ['stm32f4', 'f407', 'discovery', 'f4'],
    railVoltage: 3.3,
    engine: 'stm32f4-emu',
    runner: 'runners/stm32f4-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'pwm', 'i2c-target', 'spi-target', 'ethernet'],
    firmware: ['arduino-sketch'],
    limits: [{ code: 'uart-tx-global-tap', detail: 'TX capture is global to usart1 regardless of port.' }, { code: 'ethernet-gateway', detail: 'On-chip MAC (F407) via unified gateway (:5030); link driven up at boot.' }],
  },
  {
    family: 'retro_8086',
    match: ['8086', '8088'],
    railVoltage: 5.0,
    engine: '8086emu',
    runner: 'runners/retro-runner.ts',
    capabilities: ['digital-gpio', 'uart-console'],
    firmware: ['asm-source'],
    limits: NO_LIMITS,
  },
  {
    family: 'retro_8085',
    match: ['8085'],
    railVoltage: 5.0,
    engine: '8086emu',
    runner: 'runners/retro-runner.ts',
    capabilities: ['digital-gpio', 'uart-console'],
    firmware: ['asm-source'],
    limits: NO_LIMITS,
  },
  {
    family: 'retro_8051',
    match: ['8051', 'mcs-51', 'mcs51'],
    railVoltage: 5.0,
    engine: '8086emu',
    runner: 'runners/retro-runner.ts',
    capabilities: ['digital-gpio-sink', 'uart-console'],
    firmware: ['asm-source'],
    limits: [{ code: 'quasi-bidirectional-ports', detail: 'P1/P2 HIGH floats (input); only LOW bits actively drive. Sourcing HIGH to light loads is unsupported.' }],
  },
  {
    family: 'retro_6502',
    match: ['6502'],
    railVoltage: 5.0,
    engine: '8086emu',
    runner: 'runners/retro-runner.ts',
    capabilities: ['digital-gpio', 'uart-console'],
    firmware: ['asm-source'],
    limits: [{ code: 'via-ddr-gated', detail: 'VIA pins drive only when DDR configures them as outputs.' }],
  },
  {
    family: 'retro_z80',
    match: ['z80', 'z-80'],
    railVoltage: 5.0,
    engine: '8086emu',
    runner: 'runners/retro-runner.ts',
    capabilities: ['digital-gpio', 'uart-console'],
    firmware: ['asm-source'],
    limits: [{ code: 'z80-output-latch', detail: 'Kit port is a plain output latch (no direction): HIGH wins, external pull-down of a driven-HIGH line is unsupported.' }],
  },
  {
    family: 'retro_rv32',
    match: ['rv32', 'risc-v', 'riscv'],
    railVoltage: 5.0,
    engine: '8086emu',
    runner: 'runners/retro-runner.ts',
    capabilities: ['uart-console'],
    firmware: ['asm-source'],
    limits: [{ code: 'no-gpio-model', detail: 'rv32 exposes no GPIO model; input injection is inert.' }],
  },
  {
    family: 'retro',
    match: ['retro'],
    railVoltage: 5.0,
    engine: '8086emu',
    runner: 'runners/retro-runner.ts',
    capabilities: ['digital-gpio', 'uart-console'],
    firmware: ['asm-source'],
    limits: NO_LIMITS,
  },
  {
    family: 'microbit_v2',
    match: ['microbit', 'micro-bit', 'nrf52833', 'nrf52'],
    railVoltage: 3.3,
    engine: 'nrf52833-periph-wasm',
    runner: 'runners/microbit-runner.ts',
    // 'analog-adc' is proven: AIN0 (edge pin P0 = P0.02) is sampled by the
    // SAADC and the host injects the wiper voltage of a wired potentiometer
    // (tests/e2e/microbit-saadc.spec.js — MB_SAADC:1877 for a 50 % pot on
    // the 3.3 V rail).
    // 'pwm' is proven: PWM0 duty/frequency are read back from the engine
    // (owner P164 gear) and drive the LED model wired to the PWM pin
    // (tests/e2e/microbit-pwm.spec.js — 25 % duty -> brightness 64,
    // 16000 Hz).
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'i2c-target', 'spi-target', 'pwm'],
    firmware: ['fixed-bin'],
    limits: NO_LIMITS,
  },
];

export const UNKNOWN_BOARD_FAMILY: BoardFamily = {
  family: 'unknown',
  match: [],
  railVoltage: 3.3,
  engine: 'unknown',
  runner: 'runners/avr-runner.ts',
  capabilities: [],
  firmware: [],
  limits: [{ code: 'unrecognized-board-type', detail: 'Board type matched no family; treated as capability-less.' }],
};

/** First matching family wins; matchers are ordered specific-before-generic. */
export function matchBoardFamily(boardType: string): BoardFamily {
  const t = String(boardType || '').toLowerCase();
  for (const fam of BOARD_FAMILIES) {
    if (Array.isArray(fam.exclude) && fam.exclude.some((e) => e && t.includes(e))) continue;
    for (const m of fam.match) {
      if (m && t.includes(m)) return fam;
    }
  }
  return UNKNOWN_BOARD_FAMILY;
}

/** Capability predicate used by the conformance matrix. */
export function boardHasCapability(boardType: string, capability: string): boolean {
  return matchBoardFamily(boardType).capabilities.includes(String(capability || ''));
}

/** Limit-code predicate used to mark expected gaps in tests. */
export function boardHasLimit(boardType: string, code: string): boolean {
  return matchBoardFamily(boardType).limits.some((l) => l.code === String(code || ''));
}
