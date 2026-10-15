import { API_BASE_URL } from '../../../services/simulatorService';

export const BOARD_BAUD_PRESETS = {
  arduino_uno: ['300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200', '921600'],
  arduino_nano: ['300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200', '921600'],
  rp2040: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  esp32: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  stm32f1: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  stm32f4: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
};

export const BOARD_DEFAULT_BAUD = {
  arduino_uno: '9600',
  arduino_nano: '9600',
  rp2040: '115200',
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
  esp32: 'esp32:esp32:esp32',
  stm32f1: 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8',
  stm32f4: 'STMicroelectronics:stm32:GenF4:pnum=DISCO_F407VG',
};

export const BOARD_DISPLAY_NAME = {
  arduino_uno: 'Arduino Uno',
  arduino_nano: 'Arduino Nano (Old Bootloader)',
  rp2040: 'Raspberry Pi Pico',
  esp32: 'ESP32 DevKit',
  stm32f1: 'STM32F1 Blue Pill',
  stm32f4: 'STM32F4 Discovery',
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
