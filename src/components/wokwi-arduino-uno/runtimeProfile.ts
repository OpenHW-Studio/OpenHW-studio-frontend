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

export const UNO_PLOTTER_PINS = [...UNO_DIGITAL_PINS, ...UNO_ANALOG_PINS];
