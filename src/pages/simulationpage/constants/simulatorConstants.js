import { API_BASE_URL } from '../../../services/simulatorService';

export const BOARD_BAUD_PRESETS = {
  arduino_uno: ['300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200', '921600'],
  arduino_nano: ['300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200', '921600'],
  rp2040: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  rp2350: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  esp32: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  stm32f1: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  stm32f4: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
};

export const BOARD_DEFAULT_BAUD = {
  arduino_uno: '9600',
  arduino_nano: '9600',
  rp2040: '115200',
  rp2350: '115200',
  esp32: '115200',
  stm32f1: '115200',
  stm32f4: '115200',
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
  rp2040: 'rp2040:rp2040:rpipico',
  rp2350: 'rp2040:rp2040:rpipico2',
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
};

export const BOARD_DISPLAY_NAME = {
  arduino_uno: 'Arduino Uno',
  arduino_nano: 'Arduino Nano (Old Bootloader)',
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
