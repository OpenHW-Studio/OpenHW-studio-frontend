import { BOARD_FQBN, BOARD_DISPLAY_NAME } from '../constants/simulatorConstants';

export function normalizeBoardKind(source) {
  const s = String(source || '').toLowerCase();
  if (s.includes('esp32')) return 'esp32';
  if (s.includes('stm32')) return 'stm32';
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
  const type = String(boardComp?.type || '').toLowerCase();
  if (type.includes('pico-w') || type.includes('picow')) {
    return 'rp2040:rp2040:rpipicow';
  }
  return BOARD_FQBN[boardKind] || BOARD_FQBN.arduino_uno;
}

export function normalizeRp2040Env(source) {
  const value = String(source || '').trim().toLowerCase();
  if (!value || value === 'none' || value === 'native' || value === 'ino') return 'native';
  if (value === 'cp' || value === 'circuitpy' || value === 'circuitpython') return 'circuitpython';
  if (value.startsWith('circuitpython')) return 'circuitpython';
  if (value === 'py' || value === 'python') return 'micropython';
  if (value.startsWith('micropython')) return 'micropython';
  return 'native';
}

export function createDefaultMainCode(boardKind, boardId, options = {}) {
  const rp2040Mode = normalizeRp2040Env(options?.rp2040Mode || 'native');

  if (boardKind === 'rp2040' && rp2040Mode === 'micropython') {
    return `# Main logic for ${boardId}\n\ndef setup():\n    pass\n\ndef loop():\n    pass\n\nwhile True:\n    loop()\n`;
  }
  if (boardKind === 'rp2040' && rp2040Mode === 'circuitpython') {
    return `# Main logic for ${boardId}\nimport board\nimport time\n\nwhile True:\n    pass\n`;
  }

  return `void setup() {\n  // put your setup code here, to run once:\n\n}\n\nvoid loop() {\n  // put your main code here, to run repeatedly:\n\n}\n`;
}

export function isRp2040PythonEnv(source) {
  const env = normalizeRp2040Env(source);
  return env === 'micropython' || env === 'circuitpython';
}

export function getRp2040PythonEntryFileName(source) {
  return normalizeRp2040Env(source) === 'circuitpython' ? 'code.py' : 'main.py';
}

export function mapRp2040EnvForLegacyContextMenu(source, circuitPythonVersion) {
  const env = normalizeRp2040Env(source);
  if (env === 'micropython') return 'micropython-20241129-v1.24.1';
  if (env === 'circuitpython') return `circuitpython-${circuitPythonVersion || '8.2.7'}`;
  return '';
}

export function looksLikeMicroPythonSource(source) {
  const text = String(source || '').trim();
  if (!text) return false;
  const lower = text.toLowerCase();

  return lower.includes('from machine import')
    || lower.includes('import machine')
    || lower.includes('machine.pin(')
    || lower.includes('while true:')
    || lower.includes('sleep_ms(')
    || lower.includes('sleep_us(');
}

export function arduinoBlinkToMicroPython(sourceCode, boardId) {
  const src = String(sourceCode || '');

  const pinMatch =
    src.match(/#define\s+\w*LED\w*\s+(\d+)/i) ||
    src.match(/const\s+\w+\s+\w*LED\w*\s*=\s*(\d+)/i) ||
    src.match(/int\s+\w*LED\w*\s*=\s*(\d+)/i) ||
    src.match(/LED_BUILTIN\b/);

  let pinExpr;
  if (pinMatch && pinMatch[1]) {
    pinExpr = pinMatch[1];
  } else if (src.includes('LED_BUILTIN')) {
    pinExpr = "'LED'";
  } else {
    const pinModeMatch = src.match(/pinMode\s*\(\s*(\d+)/) ||
      src.match(/digitalWrite\s*\(\s*(\d+)/);
    pinExpr = pinModeMatch ? pinModeMatch[1] : "'LED'";
  }

  const delayMatches = [...src.matchAll(/\bdelay\s*\(\s*(\d+)\s*\)/g)].map(m => Number(m[1]));
  const delayOn = delayMatches[0] ?? 1000;
  const delayOff = delayMatches[1] ?? delayOn;

  const pinArg = /^\d+$/.test(String(pinExpr)) ? Number(pinExpr) : pinExpr;

  return (
    `# Auto-converted from Arduino sketch for ${boardId}\n` +
    `from machine import Pin\n` +
    `from time import sleep_ms\n` +
    `\n` +
    `led = Pin(${pinArg}, Pin.OUT)\n` +
    `\n` +
    `while True:\n` +
    `    led.value(1)   # LED ON\n` +
    `    sleep_ms(${delayOn})\n` +
    `    led.value(0)   # LED OFF\n` +
    `    sleep_ms(${delayOff})\n`
  );
}

export function arduinoSerialToMicroPython(sourceCode, boardId) {
  const src = String(sourceCode || '');
  if (!/\bSerial1?\s*\.\s*println\s*\(/.test(src)) return '';

  const printMatches = [...src.matchAll(/\bSerial1?\s*\.\s*println\s*\(([^)]*)\)\s*;/g)]
    .map((m) => String(m[1] || '').trim())
    .filter(Boolean);
  if (printMatches.length === 0) return '';

  const pyLiteral = (expr) => {
    const e = String(expr || '').trim();
    if (/^"[\s\S]*"$/.test(e) || /^'[\s\S]*'$/.test(e)) return e;
    if (/^[0-9.+\-*/ ()]+$/.test(e)) return `str(${e})`;
    return `str(${JSON.stringify(e)})`;
  };

  const setupMsg = pyLiteral(printMatches[0]);
  const loopMsg = pyLiteral(printMatches[1] || printMatches[0]);
  const delayMatch = src.match(/\bdelay\s*\(\s*(\d+)\s*\)/i);
  const loopDelay = delayMatch ? Math.max(1, Number(delayMatch[1])) : 1000;

  return [
    `# Auto-converted Serial sketch for ${boardId}`,
    'from time import sleep_ms',
    '',
    `print(${setupMsg})`,
    '',
    'while True:',
    `  print(${loopMsg})`,
    `  sleep_ms(${loopDelay})`,
    '',
  ].join('\n');
}

export function prepareRp2040SketchForSimulation(sourceCode) {
  const source = String(sourceCode || '');
  if (!source.trim()) return source;
  if (!/\bSerial1?\b/.test(source)) return source;
  if (/OPENHW_SIM_SERIAL_REWRITE/.test(source)) return source;

  const hasBlockingSerialWaitCondition = (condition) => {
    const cond = String(condition || '');
    if (!/!\s*Serial1?\b/.test(cond)) return false;
    if (/!\s*Serial1?\s*(?:\.|\[)/.test(cond)) return false;
    return true;
  };

  const stripBlockingSerialWaits = (text) => String(text || '')
    .replace(/\bwhile\s*\(([^)]*)\)\s*;/g, (match, condition) => (
      hasBlockingSerialWaitCondition(condition)
        ? '/* OPENHW_SIM_SERIAL_WAIT_REMOVED: skip blocking serial wait in simulator. */'
        : match
    ))
    .replace(/\bwhile\s*\(([^)]*)\)\s*\{/g, (match, condition) => (
      hasBlockingSerialWaitCondition(condition)
        ? 'if (false) { /* OPENHW_SIM_SERIAL_WAIT_REMOVED */'
        : match
    ))
    .replace(/\bwhile\s*\(([^)]*)\)\s*(?!\{|;)[^;\n]*;/g, (match, condition) => (
      hasBlockingSerialWaitCondition(condition)
        ? '/* OPENHW_SIM_SERIAL_WAIT_REMOVED: skip blocking serial wait in simulator. */'
        : match
    ))
    .replace(/\bfor\s*\(\s*;\s*([^;]*?)\s*;\s*\)\s*\{/g, (match, condition) => (
      hasBlockingSerialWaitCondition(condition)
        ? 'if (false) { /* OPENHW_SIM_SERIAL_WAIT_REMOVED */'
        : match
    ))
    .replace(/\bfor\s*\(\s*;\s*([^;]*?)\s*;\s*\)\s*;/g, (match, condition) => (
      hasBlockingSerialWaitCondition(condition)
        ? '/* OPENHW_SIM_SERIAL_WAIT_REMOVED: skip blocking serial wait in simulator. */'
        : match
    ));

  const rewritten = stripBlockingSerialWaits(source.replace(/\bSerial\b(?!1)/g, 'Serial1'));
  if (rewritten === source) return source;

  const serialShim = [
    '#ifdef ARDUINO_ARCH_RP2040',
    '// OPENHW_SIM_SERIAL_REWRITE: route Serial monitor traffic to UART0 (GP0/GP1)',
    '// and prevent blocking while(!Serial...) waits in simulator mode.',
    '#endif',
    '',
  ].join('\n');

  return `${serialShim}${rewritten}`;
}

export function resolveRp2040SourceMode({
  configuredMode,
  activePrefersIno,
  activePrefersPy,
  hasNativeSketch,
  hasPythonSource,
  prefersNativeFromSyntax = false,
}) {
  const mode = String(configuredMode || 'auto').toLowerCase();

  if (mode === 'cp' || mode === 'circuitpy' || mode === 'circuitpython') {
    return 'cp';
  }

  if (mode === 'py' || mode === 'python' || mode === 'micropython') {
    return 'py';
  }

  if (mode === 'ino' || mode === 'native' || mode === 'none') return 'ino';

  if (activePrefersIno) return 'ino';
  if (activePrefersPy) return mode === 'cp' ? 'cp' : 'py';

  if (hasNativeSketch || prefersNativeFromSyntax) return 'ino';
  if (hasPythonSource) return mode === 'cp' ? 'cp' : 'py';
  return 'ino';
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

export function ensureMicroPythonSerialProbe(sourceCode, boardId) {
  const script = String(sourceCode || '').trim();
  const marker = 'OpenHW RP2040 UART0 ready';
  if (script.includes(marker)) return script;

  const probe = `print("${marker}: ${boardId}")`;
  if (!script) return `${probe}\n`;
  return `${probe}\n${script}\n`;
}

export function applyRp2040MicroPythonCompat(sourceCode) {
  const script = String(sourceCode || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!script) return script;
  if (script.includes('OPENHW_RP2040_SLEEP_COMPAT')) return script;

  const needsSleepCompat = /\btime\.sleep_ms\s*\(|\bsleep_ms\s*\(/.test(script);
  if (!needsSleepCompat) return script;

  const prelude = [
    '# OPENHW_RP2040_SLEEP_COMPAT',
    'def _openhw_sleep_ms(ms):',
    '    ms = int(ms)',
    '    if ms <= 0:',
    '        return',
    '    for _ in range(ms * 500):',
    '        pass',
    '',
  ].join('\n');

  const rewritten = script
    .replace(/\btime\.sleep_ms\s*\(/g, '_openhw_sleep_ms(')
    .replace(/\bsleep_ms\s*\(/g, '_openhw_sleep_ms(');

  return `${prelude}\n${rewritten}\n`;
}

export function isProgrammableBoardType(type) {
  const s = String(type || '').toLowerCase();
  return /(arduino|esp32|stm32|rp2040|pico)/i.test(s);
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
