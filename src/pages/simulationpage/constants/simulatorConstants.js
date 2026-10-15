import { API_BASE_URL } from '../../../services/simulatorService';

export const BOARD_BAUD_PRESETS = {
  arduino_uno: ['300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200', '921600'],
  arduino_nano: ['300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200', '921600'],
  rp2040: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  rp2350: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  esp32: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  stm32f1: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  stm32f4: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  retro_8086: ['9600', '19200', '38400', '57600', '115200'],
  retro_8085: ['9600', '19200', '38400', '57600', '115200'],
  retro_8051: ['9600', '19200', '38400', '57600', '115200'],
  retro_6502: ['9600', '19200', '38400', '57600', '115200'],
  retro_z80: ['9600', '19200', '38400', '57600', '115200'],
  retro_rv32: ['9600', '19200', '38400', '57600', '115200'],
};

export const BOARD_DEFAULT_BAUD = {
  arduino_uno: '9600',
  arduino_nano: '9600',
  rp2040: '115200',
  rp2350: '115200',
  esp32: '115200',
  stm32f1: '115200',
  stm32f4: '115200',
  retro_8086: '9600',
  retro_8085: '9600',
  retro_8051: '9600',
  retro_6502: '9600',
  retro_z80: '9600',
  retro_rv32: '9600',
};

export const SERIAL_LINE_ENDINGS = {
  none: '',
  nl: '\n',
  crlf: '\r\n',
  cr: '\r',
};

export const BOARD_FQBN = {
  arduino_uno: 'arduino:avr:uno',
  arduino_nano: 'arduino:avr:nano:cpu=atmega328old',
  arduino_mega: 'arduino:avr:mega:cpu=atmega2560',
  rp2040: 'rp2040:rp2040:rpipico',
  rp2350: 'rp2040:rp2040:rpipico2',
  // RP2350 RISC-V (Hazard3): arduino-pico riscv menu (toolchain present).
  // Selected per-board via attrs arch=rv32 (see resolveBoardFqbnForComponent).
  pico_2_rv32: 'rp2040:rp2040:rpipico2:arch=riscv',
  // Pico W / Pico 2 W (CYW43) — arduino-pico board entries.
  pico_w: 'rp2040:rp2040:rpipicow',
  pico_2_w: 'rp2040:rp2040:rpipico2w',
  // W5500-EVB-Pico carriers (pico-emu pico-eth / pico-eth2 boards).
  pico_eth: 'rp2040:rp2040:wiznet_5500_evb_pico',
  pico_2_eth: 'rp2040:rp2040:wiznet_5500_evb_pico2',
  esp32: 'esp32:esp32:esp32',
  stm32f1: 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8',
  // STM32F1 variants (GenF1 pnum menu — probed via arduino-cli board details).
  stm32f103cb: 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103CB',
  stm32_maple_mini: 'STMicroelectronics:stm32:GenF1:pnum=MAPLEMINI_F103CB',
  stm32_nucleo_f103rb: 'STMicroelectronics:stm32:Nucleo_64:pnum=NUCLEO_F103RB',
  stm32f103rc: 'STMicroelectronics:stm32:GenF1:pnum=GENERIC_F103RCTX',
  // GD32F103 has no arduino-core board entry (probed: no gd32 match in
  // listall) — compile as the closest STM32F103 part; the runner still
  // applies the GD32 IDCODE via the chip opt. Owner gap: gapStm32f1.md.
  stm32_gd32f103c8: 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8',
  stm32_gd32f103cb: 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103CB',
  stm32_gd32f103rb: 'STMicroelectronics:stm32:GenF1:pnum=GENERIC_F103RBTX',
  stm32f4: 'STMicroelectronics:stm32:Disco:pnum=DISCO_F407VG',
  // STM32F4 variants.
  stm32f401: 'STMicroelectronics:stm32:GenF4:pnum=BLACKPILL_F401CE',
  stm32f411: 'STMicroelectronics:stm32:GenF4:pnum=BLACKPILL_F411CE',
  stm32f407ve: 'STMicroelectronics:stm32:GenF4:pnum=BLACK_F407VE',
  stm32f429: 'STMicroelectronics:stm32:Disco:pnum=DISCO_F429ZI',
  // Retro 8/16-bit boards (8086emu, in-WASM assembler — no arduino FQBN;
  // the runner assembles .asm source locally; backend `asm` passthrough).
  retro_8086: 'retro:8086',
  retro_8085: 'retro:8085',
  retro_8051: 'retro:8051',
  retro_6502: 'retro:6502',
  retro_z80: 'retro:z80',
  retro_rv32: 'retro:rv32',
};

export const BOARD_DISPLAY_NAME = {
  arduino_uno: 'Arduino Uno',
  arduino_nano: 'Arduino Nano (Old Bootloader)',
  arduino_mega: 'Arduino Mega 2560',
  rp2040: 'Raspberry Pi Pico',
  rp2350: 'Raspberry Pi Pico 2',
  pico_w: 'Raspberry Pi Pico W',
  pico_2_w: 'Raspberry Pi Pico 2 W',
  pico_eth: 'WIZnet W5500-EVB-Pico',
  pico_2_eth: 'WIZnet W5500-EVB-Pico2',
  esp32: 'ESP32 DevKit',
  stm32f1: 'STM32F1 Blue Pill',
  stm32f103cb: 'STM32F103CB Blue Pill (128K)',
  stm32_maple_mini: 'Maple Mini (F103CB)',
  stm32_nucleo_f103rb: 'Nucleo-F103RB',
  stm32f103rc: 'STM32F103RC (256K)',
  stm32_gd32f103c8: 'GD32F103C8 Blue Pill',
  stm32_gd32f103cb: 'GD32F103CB (128K)',
  stm32_gd32f103rb: 'GD32F103RB (128K)',
  stm32f4: 'STM32F4 Discovery',
  stm32f401: 'STM32F401 BlackPill',
  stm32f411: 'STM32F411 BlackPill',
  stm32f407ve: 'STM32F407VE Black Board',
  stm32f429: 'STM32F429 Discovery',
  retro_8086: 'Intel 8086 (16-bit)',
  retro_8085: 'Intel 8085 (8-bit)',
  retro_8051: 'Intel 8051 (MCS-51)',
  retro_6502: 'MOS 6502 (8-bit)',
  retro_z80: 'Zilog Z80 (8-bit)',
  retro_rv32: 'RISC-V rv32i (32-bit)',
};

export const UF2_PAYLOAD_PREFIX = 'UF2BASE64:';
export const DEFAULT_PICO_MICROPYTHON_UF2_URL = `${API_BASE_URL}/compile/pico/micropython-uf2`;
export const DEFAULT_PICO_CIRCUITPYTHON_UF2_URL = `${API_BASE_URL}/compile/pico/circuitpython-uf2`;
export const DEFAULT_PICO_CIRCUITPYTHON_VERSION = '8.2.7';
export const DISABLED_FILE_SUFFIX = '.disabled';

export const ARDUINO_CODE_EXTENSIONS = new Set(['.ino', '.h', '.hpp', '.c', '.cpp']);
export const ROOT_UPLOADABLE_EXTENSIONS = new Set(['.ino', '.cpp', '.h', '.hpp', '.c', '.txt', '.json', '.xml', '.py', '.uf2']);
export const RP2040_NATIVE_ALLOWED_EXTENSIONS = new Set(['.ino', '.h', '.hpp', '.c', '.cpp', '.txt', '.json', '.xml', '.uf2']);
export const RP2040_MICROPYTHON_ALLOWED_EXTENSIONS = new Set(['.py', '.txt', '.json', '.xml', '.uf2']);

export const GROUP_MAPPING = {
  'Basic': 'basic',
  'Passives': 'basic',
  'Power': 'basic',
  'Outputs': 'output',
  'Inputs': 'input',
  'Sensors': 'sensor',
  'Displays': 'display',
  'Memory': 'misc',
  'Logic': 'logic'
};
