// Keep frontend worker board pin defaults in one place.
// These should stay in sync with emulator component runtimeProfile files.

export const UNO_DIGITAL_PINS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];
export const UNO_ANALOG_PINS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
export const UNO_POWER_PINS = [
  'vin',
  'VIN',
  'gnd_1',
  'gnd_2',
  'gnd_3',
  'GND',
  '5V',
  '3v3',
  '3V3',
  'rst',
  'RST',
  'ioref',
  'IOREF',
];
export const UNO_BOARD_PINS = [...UNO_DIGITAL_PINS, ...UNO_ANALOG_PINS, ...UNO_POWER_PINS];

export const UNO_UART_PINS = {
  tx: ['1', 'D1', 'TX', 'TX0'],
  rx: ['0', 'D0', 'RX', 'RX0'],
};

export const UNO_SOFTSERIAL_PINS = {
  tx: ['10', 'D10'],
  rx: ['11', 'D11'],
};

// ── Pico (RP2040) pin tables (pico-emu runner) ──────────────────────────
// GPIO0-28 + power rails; UART0 = GP0/GP1 (Arduino Serial1 default).
export const PICO_GPIO_PINS = Array.from({ length: 29 }, (_, idx) => `GP${idx}`);
export const PICO_POWER_PINS = [
  'VBUS', 'VSYS', '3V3', '3V3_EN', 'ADC_VREF', 'RUN', 'AGND',
  'GND', 'GND_1', 'GND_2', 'GND_3', 'GND_4', 'GND_5', 'GND_6',
];
export const PICO_BOARD_PINS = [...PICO_GPIO_PINS, ...PICO_POWER_PINS];

export const PICO_UART_PINS = {
  tx: ['GP0', 'GPIO0', '0', 'D0', 'TX', 'TX0'],
  rx: ['GP1', 'GPIO1', '1', 'D1', 'RX', 'RX0'],
};

export const PICO_SOFTSERIAL_PINS = {
  tx: ['GP10', 'GPIO10', '10', 'D10'],
  rx: ['GP11', 'GPIO11', '11', 'D11'],
};

// ── ESP32 DevKit pin tables (esp32-emu runner) ──────────────────────────
// Hardware UART0: TX0=GPIO1, RX0=GPIO3 (USB serial).
export const ESP32_GPIO_PINS = Array.from({ length: 40 }, (_, idx) => `GPIO${idx}`);
export const ESP32_BOARD_PINS = [...ESP32_GPIO_PINS, 'EN', 'VP', 'VN', '3V3', 'GND', 'VIN'];

export const ESP32_UART_PINS = {
  tx: ['GPIO1', '1', 'D1', 'TX', 'TX0'],
  rx: ['GPIO3', '3', 'D3', 'RX', 'RX0'],
};

export const ESP32_SOFTSERIAL_PINS = {
  tx: ['GPIO17', '17', 'D17'],
  rx: ['GPIO16', '16', 'D16'],
};

// ── STM32F1 Blue Pill pin tables (stm32f1-emu runner) ────────────────────
// USART1: TX=PA9, RX=PA10. LED: PC13.
export const STM32F1_GPIO_PINS = [
  ...Array.from({ length: 16 }, (_, n) => `PA${n}`),
  ...Array.from({ length: 16 }, (_, n) => `PB${n}`),
  'PC13', 'PC14', 'PC15',
];
export const STM32F1_BOARD_PINS = [...STM32F1_GPIO_PINS, '5V', 'GND', '3V3', 'VBAT', 'RESET'];

export const STM32F1_UART_PINS = {
  tx: ['PA9', 'A9', 'TX', 'TX0', 'TX1'],
  rx: ['PA10', 'A10', 'RX', 'RX0', 'RX1'],
};

// ── STM32F4 Discovery pin tables (stm32f4-emu runner) ───────────────────
// USART1: TX=PA9, RX=PA10. LEDs: PD12–PD15.
export const STM32F4_GPIO_PINS = [
  ...Array.from({ length: 16 }, (_, n) => `PA${n}`),
  ...Array.from({ length: 16 }, (_, n) => `PB${n}`),
  ...Array.from({ length: 16 }, (_, n) => `PC${n}`),
  ...Array.from({ length: 16 }, (_, n) => `PD${n}`),
  ...Array.from({ length: 16 }, (_, n) => `PE${n}`),
];
export const STM32F4_BOARD_PINS = [...STM32F4_GPIO_PINS, '5V', 'GND', '3V3', 'RESET'];

export const STM32F4_UART_PINS = {
  tx: ['PA9', 'A9', 'TX', 'TX0', 'TX1'],
  rx: ['PA10', 'A10', 'RX', 'RX0', 'RX1'],
};
