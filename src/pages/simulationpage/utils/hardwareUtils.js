import { BOARD_FQBN, BOARD_DISPLAY_NAME } from '../constants/simulatorConstants';

export function normalizeBoardKind(source) {
  const s = String(source || '').toLowerCase();
  if (s.includes('nano')) return 'arduino_nano';
  if (s.includes('mega') || s.includes('2560')) return 'arduino_mega';
  // W5500-EVB-Pico carriers before bare pico (type contains 'pico' too).
  if (s.includes('pico-2-eth') || s.includes('pico2-eth') || s.includes('5500_evb_pico2') || s.includes('pico2eth')) return 'pico_2_eth';
  if (s.includes('pico-eth') || s.includes('picoeth') || s.includes('5500_evb_pico') || s.includes('w5500')) return 'pico_eth';
  // Pico W before bare pico ('pico-w' contains 'pico'; 'rpipicow' too).
  if (s.includes('pico-2-w') || s.includes('pico2w') || s.includes('rpipico2w')) return 'pico_2_w';
  if (s.includes('pico-w') || s.includes('picow') || s.includes('rpipicow')) return 'pico_w';
  // STM32F4 variants before the F4 catch-all.
  if (s.includes('429') || s.includes('f429')) return 'stm32f429';
  if (s.includes('407ve') || s.includes('407ze') || s.includes('f407ve')) return 'stm32f407ve';
  if (s.includes('401') || s.includes('f401')) return 'stm32f401';
  if (s.includes('411') || s.includes('f411')) return 'stm32f411';
  // STM32F4 before F1: 'stm32f4' contains no 'f1' clash, but check anyway.
  if (s.includes('stm32f4') || s.includes('f407') || s.includes('discovery') || s.includes('f4')) return 'stm32f4';
  // STM32F1 variants before the F1 catch-all.
  if (s.includes('maple')) return 'stm32_maple_mini';
  if (s.includes('nucleo')) return 'stm32_nucleo_f103rb';
  if (s.includes('gd32')) {
    if (s.includes('rb')) return 'stm32_gd32f103rb';
    if (s.includes('cb')) return 'stm32_gd32f103cb';
    return 'stm32_gd32f103c8';
  }
  if (s.includes('f103cb') || s.includes('103cb')) return 'stm32f103cb';
  if (s.includes('f103rc') || s.includes('103rc')) return 'stm32f103rc';
  if (s.includes('stm32f1') || s.includes('bluepill') || s.includes('blue-pill') || s.includes('103') || s.includes('stm32')) return 'stm32f1';
  if (s.includes('esp32')) return 'esp32';
  // Pico 2 / RP2350 before Pico 1: 'pico-2' contains 'pico'.
  if (s.includes('pico-2') || s.includes('pico2') || s.includes('rp2350') || s.includes('2350')) return 'rp2350';
  if (s.includes('rp2040') || s.includes('pico')) return 'rp2040';
  // Retro 8/16-bit boards (8086emu): specific ISAs before the catch-all.
  if (s.includes('8086') || s.includes('8088')) return 'retro_8086';
  if (s.includes('8085')) return 'retro_8085';
  if (s.includes('8051') || s.includes('mcs-51') || s.includes('mcs51')) return 'retro_8051';
  if (s.includes('6502')) return 'retro_6502';
  if (s.includes('z80') || s.includes('z-80')) return 'retro_z80';
  if (s.includes('rv32') || s.includes('risc-v') || s.includes('riscv')) return 'retro_rv32';
  if (s.includes('retro')) return 'retro_8086';
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
  // Per-board FQBN: the component TYPE wins over the normalized kind so
  // variants (Maple Mini, Nucleo, GD32, F401/…) compile for their own part.
  // Falls back to the kind table, then Uno.
  const typeKey = normalizeBoardKind(boardComp?.type || '');
  // RP2350 RISC-V: attrs arch=rv32 selects the riscv menu (toolchain
  // present) so the firmware matches the Hazard3 core the runner boots.
  try {
    const archAttr = String(boardComp?.attrs?.arch || '').toLowerCase();
    if ((typeKey === 'rp2350' || String(boardKind || '').toLowerCase().includes('rp2350'))
      && (archAttr === 'rv32' || archAttr === 'riscv' || archAttr === 'risc-v')) {
      if (BOARD_FQBN.pico_2_rv32) return BOARD_FQBN.pico_2_rv32;
    }
  } catch { /* fall through to the table */ }
  return BOARD_FQBN[typeKey] || BOARD_FQBN[boardKind] || BOARD_FQBN.arduino_uno;
}


export function createDefaultMainCode(boardKind, boardId, options = {}) {
  void boardId; void options;
  const kind = normalizeBoardKind(boardKind);
  // Retro boards default to a per-ISA hello program (assembled in-WASM).
  if (String(kind || '').startsWith('retro')) return defaultRetroAsm(kind);
  return `void setup() {\n  // put your setup code here, to run once:\n\n}\n\nvoid loop() {\n  // put your main code here, to run repeatedly:\n\n}\n`;
}

function defaultRetroAsm(kind) {
  const k = String(kind || '');
  if (k === 'retro_8085') {
    return `; 8085 hello world: print chars via OUT 01h\n    MVI C, 05h\n    LXI H, msg\nloop:\n    MOV A, M\n    CPI '$'\n    JZ done\n    OUT 01h\n    INX H\n    JMP loop\ndone:\n    HLT\nmsg: DB 'Hello, 8085!', '$'\nEND`;
  }
  if (k === 'retro_8051') {
    return `; 8051 hello world: write chars to SBUF (serial output)\n    MOV DPTR, #msg\n    MOV R1, #00h\nloop:\n    MOV A, R1\n    MOVC A, @A+DPTR\n    JZ done\n    MOV SBUF, A\n    INC R1\n    SJMP loop\ndone:\n    SJMP done\nmsg: DB 'Hello, 8051!', 0\nEND`;
  }
  if (k === 'retro_6502') {
    // NOTE: package 6502 DB takes one literal per DB (repo hello6502.asm).
    return `; 6502 hello world: STA $01 prints A\n    ORG 0\n    LDX #0\nloop:\n    LDA msg,X\n    BEQ done\n    STA $01\n    INX\n    JMP loop\ndone:\n    BRK\nmsg: DB 'H'\n    DB 'i'\n    DB 10\n    DB 0\n    END\n`;
  }
  if (k === 'retro_z80') {
    // NOTE: package Z80 assembler has no forward label refs (verified) —
    // unrolled OUT sequence like the repo helloz80.asm example.
    return `; Z80 hello world: OUT (1),A prints A\n    ORG 0\n    LD A, 'H'\n    OUT (1), A\n    LD A, 'i'\n    OUT (1), A\n    LD A, 10\n    OUT (1), A\n    HALT\n    END\n`;
  }
  if (k === 'retro_rv32') {
    return `# rv32 hello world: ECALL write semihosting\n    .text\n    la a0, msg\n    li a1, 12\n    li a7, 64\n    ecall\n    li a7, 93\n    ecall\nmsg:\n    .string "Hello, rv32!"\n`;
  }
  // retro_8086 default: DOS COM program (ORG 100h), INT 21h string output.
  return `; 8086 hello world via DOS INT 21h\nORG 100h\nMOV DX, OFFSET msg\nMOV AH, 09h\nINT 21h\nMOV AH, 4Ch\nINT 21h\nmsg: DB 'Hello, 8086!$'\nEND`;
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
  return /(arduino|rp2040|pico|esp32|stm32|8086|8088|8085|8051|mcs-51|6502|z80|rv32|risc|retro|microbit|nrf52)/i.test(s);
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
