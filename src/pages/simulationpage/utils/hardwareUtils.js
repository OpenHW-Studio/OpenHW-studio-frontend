import { BOARD_FQBN, BOARD_DISPLAY_NAME } from '../constants/simulatorConstants';

export function normalizeBoardKind(source) {
  const s = String(source || '').toLowerCase();
  if (s.includes('nano')) return 'arduino_nano';
  // STM32F4 before F1: 'stm32f4' contains no 'f1' clash, but check anyway.
  if (s.includes('stm32f4') || s.includes('f407') || s.includes('discovery') || s.includes('f4')) return 'stm32f4';
  if (s.includes('stm32f1') || s.includes('bluepill') || s.includes('blue-pill') || s.includes('103') || s.includes('stm32')) return 'stm32f1';
  if (s.includes('esp32')) return 'esp32';
  if (s.includes('rp2040') || s.includes('pico')) return 'rp2040';
  return 'arduino_uno';
}

export function boardKindToDisplayName(kind) {
  const normalized = normalizeBoardKind(kind);
  return BOARD_DISPLAY_NAME[normalized] || BOARD_DISPLAY_NAME.arduino_uno;
}

export function boardCompToDisplayName(boardComp, fallbackKind = 'arduino_uno') {
  if (!boardComp || typeof boardComp !== 'object') {
    return boardKindToDisplayName(fallbackKind);
  }

  const boardLabel = String(boardComp.label || '').trim();
  if (boardLabel) return boardLabel;
  const boardId = String(boardComp.id || '').trim();
  const kindLabel = boardKindToDisplayName(boardComp.type || fallbackKind);
  return boardId ? `${kindLabel} (${boardId})` : kindLabel;
}

export function resolveBoardFqbnForComponent(boardComp, boardKind) {
  void boardComp;
  return BOARD_FQBN[boardKind] || BOARD_FQBN.arduino_uno;
}


export function createDefaultMainCode(boardKind, boardId, options = {}) {
  void boardKind; void boardId; void options;
  return `void setup() {\n  // put your setup code here, to run once:\n\n}\n\nvoid loop() {\n  // put your main code here, to run repeatedly:\n\n}\n`;
}

export function resolveComponentAttrString(attrs, key, fallback = '') {
  const raw = attrs?.[key];
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    if (typeof raw.value === 'string') return raw.value;
    if (typeof raw.default === 'string') return raw.default;
    if (raw.value != null) return String(raw.value);
    if (raw.default != null) return String(raw.default);
  }
  if (raw == null) return fallback;
  return String(raw);
}

export function isProgrammableBoardType(type) {
  const s = String(type || '').toLowerCase();
  return /(arduino|rp2040|pico|esp32|stm32)/i.test(s);
}

export function isBreadboardType(type) {
  const s = String(type || '').toLowerCase();
  return s.startsWith('wokwi-breadboard') || s.startsWith('openhw-breadboard');
}

export function isResistorType(type) {
  const s = String(type || '').toLowerCase();
  return s === 'wokwi-resistor' || s === 'openhw-resistor';
}

export function isMotorType(type) {
  const s = String(type || '').toLowerCase();
  return s === 'wokwi-motor' || s === 'openhw-motor';
}

export function isStepperMotorType(type) {
  const s = String(type || '').toLowerCase();
  return s === 'wokwi-stepper-motor' || s === 'openhw-stepper-motor';
}

export function isLedType(type) {
  const s = String(type || '').toLowerCase();
  return s === 'wokwi-led' || s === 'openhw-led' || s === 'wokwi-rgb-led' || s === 'openhw-rgb-led';
}

export function isBuzzerType(type) {
  const s = String(type || '').toLowerCase();
  return s === 'wokwi-buzzer' || s === 'openhw-buzzer';
}

export function isPotentiometerType(type) {
  const s = String(type || '').toLowerCase();
  return s === 'wokwi-potentiometer' || s === 'openhw-potentiometer' || s === 'wokwi-slide-potentiometer' || s === 'openhw-slide-potentiometer';
}

export function isServoType(type) {
  const s = String(type || '').toLowerCase();
  return s === 'wokwi-servo' || s === 'openhw-servo';
}

export function isPhotoresistorType(type) {
  const s = String(type || '').toLowerCase();
  return s === 'wokwi-photoresistor' || s === 'openhw-photoresistor' || s === 'wokwi-photo-resistor' || s === 'openhw-photo-resistor' || s === 'wokwi-ldr' || s === 'openhw-ldr';
}

export function isNtcType(type) {
  const s = String(type || '').toLowerCase();
  return s === 'wokwi-ntc-temperature-sensor' || s === 'openhw-ntc-temperature-sensor' || s === 'wokwi-ntc-thermistor' || s === 'openhw-ntc-thermistor';
}

export function endpointAliases(endpoint) {
  const [compId, pinIdRaw] = String(endpoint || '').split(':');
  const pinId = String(pinIdRaw || '');
  if (!compId || !pinId) return [String(endpoint || '')];

  const aliases = new Set([`${compId}:${pinId}`]);
  if (/^\d+$/.test(pinId)) aliases.add(`${compId}:D${pinId}`);
  if (/^D\d+$/i.test(pinId)) aliases.add(`${compId}:${pinId.substring(1)}`);
  if (/^gnd(_\d+)?$/i.test(pinId) || /^GND$/i.test(pinId)) aliases.add(`${compId}:gnd`);
  if (/^5v$/i.test(pinId) || /^VCC$/i.test(pinId)) aliases.add(`${compId}:5V`);
  return Array.from(aliases);
}

export function hasCategoryIntersection(cat1, cat2) {
  if (!cat1 || !cat2) return false;
  const arr1 = Array.isArray(cat1) ? cat1 : [cat1];
  const arr2 = Array.isArray(cat2) ? cat2 : [cat2];
  return arr1.some(c => arr2.includes(c));
}

export function getPinCategory(pId, pDesc, compType) {
  const sId = String(pId || '').toLowerCase();
  const sDesc = String(pDesc || '').toLowerCase();
  const matches = (regex) => regex.test(sId) || regex.test(sDesc);
  const categories = [];

  if (matches(/^([a-z0-9]+[._])?(gnd|vss|0v|ground|com)([._]?\d+)?$/i)) categories.push('GND');

  if (matches(/^([a-z0-9]+[._])?(vcc|vdd|5v|3v3|3\.3v|v\+|power|vcc[12]|vbat|1\.8v|led|light|vout)([._]?\d+)?$/i)) {
    if (compType?.includes('arduino') && (sId === 'vin' || sId.includes('vin.'))) {
      categories.push('VIN');
    } else {
      categories.push('POWER');
    }
  }

  if (matches(/^sda([._]?\d+)?$/i)) categories.push('I2C_SDA');
  if (matches(/^scl([._]?\d+)?$/i)) categories.push('I2C_SCL');
  if (compType?.includes('arduino-uno') || compType?.includes('arduino-nano')) {
    if (sId === 'a4') categories.push('I2C_SDA');
    if (sId === 'a5') categories.push('I2C_SCL');
  }

  if (matches(/^(mosi|din|dn|sdi)([._]?\d+)?$/i)) categories.push('SPI_MOSI');
  if (matches(/^(miso|dout|sdo)([._]?\d+)?$/i)) categories.push('SPI_MISO');
  if (matches(/^(sck|sclk|clk|clock)([._]?\d+)?$/i)) categories.push('SPI_SCK');

  if (matches(/^(a\d+|vrx|vry|an|adc|out)([._]?\d+)?$/i)) {
    if (sId === 'vrx' || (compType?.includes('arduino') && sId === 'a0')) categories.push('ANALOG_X');
    if (sId === 'vry' || (compType?.includes('arduino') && sId === 'a1')) categories.push('ANALOG_Y');
    categories.push('ANALOG');
  }

  if (matches(/^(pwm|~)([._]?\d+)?$/i)) categories.push('PWM');
  if ((compType?.includes('arduino-uno') || compType?.includes('arduino-nano')) && ['3', '5', '6', '9', '10', '11'].includes(sId)) categories.push('PWM');
  if (compType?.includes('arduino-mega')) {
    const pinNum = parseInt(sId);
    if ((pinNum >= 2 && pinNum <= 13) || [44, 45, 46].includes(pinNum)) categories.push('PWM');
  }

  if (matches(/^en([._]?\d+(,\d+)?)?$/i)) {
    if (!categories.includes('PWM')) categories.push('PWM');
    if (!categories.includes('POWER')) categories.push('POWER');
  }

  if (matches(/^(out\d+)([._]?\d+)?$/i) || ((isMotorType(compType) || isStepperMotorType(compType)) && /^\d+$/.test(sId))) {
    categories.push('MOTOR');
  }

  if (matches(/^(d\d+|io\d+|gpio\d+|sw|joy_sw|dc|rst|reset|cs|ce|sce|ss|rs|en|enable|in\d+|\d+)([._]?\d+)?$/i)) {
    if (!(compType?.includes('arduino') && sId.startsWith('a'))) {
      if (!categories.includes('DIGITAL')) categories.push('DIGITAL');
    }
  }

  if (isBreadboardType(compType) && /^\d+[a-j]$/i.test(sId)) {
    const colNum = sId.match(/^\d+/)[0];
    const rowLetter = sId.slice(-1);
    const rowHalf = 'abcde'.includes(rowLetter) ? 'top' : 'bottom';
    categories.push(`BB_${colNum}_${rowHalf}`);
  }

  return categories.length > 0 ? categories : null;
}
