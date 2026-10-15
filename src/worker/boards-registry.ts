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
  {
    family: 'pico_2_eth',
    match: ['pico-2-eth', 'pico2-eth', '5500_evb_pico2'],
    railVoltage: 3.3,
    engine: 'pico-emu',
    runner: 'runners/pico-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'softserial', 'ethernet-stub'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: [{ code: 'ethernet-stub-only', detail: 'W5500 is stub mode (fake net); no live gateway socket.' }],
  },
  {
    family: 'pico_eth',
    match: ['pico-eth', 'picoeth', '5500_evb_pico', 'w5500'],
    railVoltage: 3.3,
    engine: 'pico-emu',
    runner: 'runners/pico-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'softserial', 'ethernet-stub'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: [{ code: 'ethernet-stub-only', detail: 'W5500 is stub mode (fake net); no live gateway socket.' }],
  },
  {
    family: 'pico_2_w',
    match: ['pico-2-w', 'pico2w', 'rpipico2w'],
    railVoltage: 3.3,
    engine: 'pico-emu',
    runner: 'runners/pico-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'softserial', 'wifi-stub'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: [{ code: 'wifi-stub-only', detail: 'CYW43 stub mode; live gateway proxy deferred.' }],
  },
  {
    family: 'pico_w',
    match: ['pico-w', 'picow', 'rpipicow'],
    railVoltage: 3.3,
    engine: 'pico-emu',
    runner: 'runners/pico-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'softserial', 'wifi-stub'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: [{ code: 'wifi-stub-only', detail: 'CYW43 stub mode; live gateway proxy deferred.' }],
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
    family: 'esp32',
    match: ['esp32'],
    // openhw-esp32-cam is a camera *component* shell, not a board —
    // without this it claims the esp32-emu engine and dies on
    // "Unknown chip: esp32-cam", taking the UNO run down with it.
    exclude: ['-cam'],
    railVoltage: 3.3,
    engine: 'esp32-emu',
    runner: 'runners/esp32-runner.ts',
    capabilities: ['digital-gpio-input', 'analog-adc', 'uart', 'onewire', 'pwm', 'i2c-target', 'spi-target', 'i2s', 'twai'],
    firmware: ['arduino-sketch', 'micropython-script'],
    limits: [{ code: 'no-gpio-output-readback', detail: 'SAB proxy exposes setPinInput only; firmware-driven outputs cannot light components.' }],
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
    capabilities: ['digital-gpio', 'analog-adc', 'uart'],
    firmware: ['arduino-sketch'],
    limits: [{ code: 'uart-tx-global-tap', detail: 'TX capture is global to usart1 regardless of port.' }],
  },
  {
    family: 'stm32f407ve',
    match: ['407ve', '407ze', 'f407ve'],
    railVoltage: 3.3,
    engine: 'stm32f4-emu',
    runner: 'runners/stm32f4-runner.ts',
    capabilities: ['digital-gpio', 'analog-adc', 'uart'],
    firmware: ['arduino-sketch'],
    limits: [{ code: 'uart-tx-global-tap', detail: 'TX capture is global to usart1 regardless of port.' }],
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
    capabilities: ['digital-gpio', 'analog-adc', 'uart', 'pwm', 'i2c-target', 'spi-target'],
    firmware: ['arduino-sketch'],
    limits: [{ code: 'uart-tx-global-tap', detail: 'TX capture is global to usart1 regardless of port.' }],
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
    capabilities: ['digital-gpio', 'uart', 'i2c-target', 'spi-target'],
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
