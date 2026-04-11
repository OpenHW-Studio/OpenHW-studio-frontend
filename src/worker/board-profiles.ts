// Keep frontend worker board pin defaults in one place.
// These should stay in sync with emulator component runtimeProfile files.

export const UNO_DIGITAL_PINS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];
export const UNO_ANALOG_PINS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
export const UNO_POWER_PINS = ['vin', 'gnd_1', 'gnd_2', 'gnd_3', '5V', '3v3', 'rst', 'ioref'];
export const UNO_BOARD_PINS = [...UNO_DIGITAL_PINS, ...UNO_ANALOG_PINS, ...UNO_POWER_PINS];

export const UNO_UART_PINS = {
  tx: ['1', 'D1', 'TX', 'TX0'],
  rx: ['0', 'D0', 'RX', 'RX0'],
};

export const UNO_SOFTSERIAL_PINS = {
  tx: ['10', 'D10'],
  rx: ['11', 'D11'],
};

export const PICO_GPIO_PINS = Array.from({ length: 29 }, (_, idx) => `GP${idx}`);
export const PICO_POWER_PINS = [
  'VBUS',
  'VSYS',
  '3V3',
  '3V3_EN',
  'ADC_VREF',
  'RUN',
  'AGND',
  'GND',
  'GND_1',
  'GND_2',
  'GND_3',
  'GND_4',
  'GND_5',
  'GND_6',
];
export const PICO_BOARD_PINS = [...PICO_GPIO_PINS, ...PICO_POWER_PINS];

export const PICO_UART_SOURCE_PINS = {
  uart0: {
    tx: ['TX', 'TX0', 'GP0', 'GPIO0', '0', 'D0', 'GP12', 'GPIO12', '12', 'D12', 'GP16', 'GPIO16', '16', 'D16', 'GP28', 'GPIO28', '28', 'D28'],
    rx: ['RX', 'RX0', 'GP1', 'GPIO1', '1', 'D1', 'GP13', 'GPIO13', '13', 'D13', 'GP17', 'GPIO17', '17', 'D17'],
  },
  uart1: {
    tx: ['TX1', 'GP4', 'GPIO4', '4', 'D4', 'GP8', 'GPIO8', '8', 'D8', 'GP20', 'GPIO20', '20', 'D20'],
    rx: ['RX1', 'GP5', 'GPIO5', '5', 'D5', 'GP9', 'GPIO9', '9', 'D9', 'GP21', 'GPIO21', '21', 'D21'],
  },
};

export const PICO_UART_PINS = {
  tx: Array.from(new Set([...PICO_UART_SOURCE_PINS.uart0.tx, ...PICO_UART_SOURCE_PINS.uart1.tx])),
  rx: Array.from(new Set([...PICO_UART_SOURCE_PINS.uart0.rx, ...PICO_UART_SOURCE_PINS.uart1.rx])),
};

export const PICO_SOFTSERIAL_PINS = {
  tx: ['GP10', 'GPIO10', '10', 'D10'],
  rx: ['GP11', 'GPIO11', '11', 'D11'],
};
