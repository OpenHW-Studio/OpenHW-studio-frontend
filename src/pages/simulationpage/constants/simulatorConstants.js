import { API_BASE_URL } from '../../../services/simulatorService';

export const BOARD_BAUD_PRESETS = {
  arduino_uno: ['300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200'],
  esp32: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  stm32: ['9600', '19200', '38400', '57600', '115200', '230400', '460800'],
  rp2040: ['9600', '19200', '38400', '57600', '115200', '230400', '460800'],
};

export const BOARD_DEFAULT_BAUD = {
  arduino_uno: '9600',
  esp32: '115200',
  stm32: '115200',
  rp2040: '115200',
};

export const SERIAL_LINE_ENDINGS = {
  none: '',
  nl: '\n',
  crlf: '\r\n',
  cr: '\r',
};

export const BOARD_FQBN = {
  arduino_uno: 'arduino:avr:uno',
  esp32: 'esp32:esp32:esp32',
  stm32: 'STMicroelectronics:stm32:GenF1',
  rp2040: 'rp2040:rp2040:rpipico',
};

export const BOARD_DISPLAY_NAME = {
  arduino_uno: 'Arduino Uno',
  esp32: 'ESP32',
  stm32: 'STM32',
  rp2040: 'Raspberry Pi Pico',
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
