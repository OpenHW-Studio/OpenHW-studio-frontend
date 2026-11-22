import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  SUB_CATEGORIES,
  CATEGORY_BLOCKS,
  BLOCK_DEFS,
  VALUE_TYPES,
  HAT_TYPES,
  GET_DIGITAL_PINS,
  GET_ANALOG_PINS,
  GET_PICO_PINS,
  GET_PICO_ANALOG_PINS,
  buildGenerator,
  generateSketch,
} from '../../../src/components/BlocklyEditor.jsx';

// Lightweight mock for Blockly.Generator
class MockGenerator {
  constructor(name) {
    this.name = name;
    this.forBlock = {};
    this.ORDER_ATOMIC = 0;
    this.ORDER_ADDITION = 11;
    this.ORDER_RELATIONAL = 9;
    this.ORDER_EQUALITY = 8;
    this.ORDER_NONE = 99;
    this.usedPins = new Map();
  }
  valueToCode(block, name, order) {
    const val = block._values?.[name];
    return val !== undefined ? String(val) : '';
  }
  statementToCode(block, name) {
    return block._statements?.[name] || '';
  }
  blockToCode(block) {
    const func = this.forBlock[block.type];
    if (!func) return '';
    return func.call(this, block);
  }
}

const mockBlock = (type, fields = {}, values = {}, statements = {}) => ({
  type,
  _values: values,
  _statements: statements,
  getFieldValue: (name) => fields[name],
  getInput: (name) => (name in values || name in statements ? {} : null),
});

describe('Raspberry Pi Pico & Pico W Blockly Blocks & Code Generators', () => {
  it('registers Raspberry Pi Pico category and subcategories', () => {
    const picoCat = CATEGORIES.find((c) => c.id === 'pico');
    expect(picoCat).toBeDefined();
    expect(picoCat.label).toBe('Raspberry Pi Pico');
    expect(picoCat.color).toBe('#c51a4a');

    expect(SUB_CATEGORIES.pico).toBeDefined();
    expect(SUB_CATEGORIES.pico.map((s) => s.id)).toEqual([
      'pico_system',
      'pico_io',
      'pico_pwm',
      'pico_multicore',
      'pico_wifi',
    ]);
  });

  it('provides all expected subcategories in CATEGORY_BLOCKS', () => {
    const expectedSubcats = [
      'pico',
      'pico_system',
      'pico_io',
      'pico_pwm',
      'pico_multicore',
      'pico_wifi',
    ];

    for (const subcat of expectedSubcats) {
      expect(CATEGORY_BLOCKS[subcat]).toBeDefined();
      expect(CATEGORY_BLOCKS[subcat].length).toBeGreaterThan(0);
    }
  });

  it('defines all Pico and Pico W blocks in BLOCK_DEFS with valid schemas', () => {
    const blockTypes = new Set(BLOCK_DEFS.map((b) => b.type));

    const requiredBlocks = [
      // System & Core
      'pico_setup',
      'pico_cpu_freq',
      'pico_get_temp',
      'pico_reboot',
      'pico_get_free_ram',
      'pico_get_chip_id',
      // IO & Sensors
      'pico_led_builtin',
      'pico_led_toggle',
      'pico_analog_read',
      'pico_analog_read_voltage',
      'pico_adc_resolution',
      // Hardware PWM
      'pico_pwm_write',
      'pico_pwm_freq',
      'pico_pwm_range',
      'pico_tone',
      'pico_no_tone',
      // Multicore
      'pico_core1_setup',
      'pico_core1_loop',
      'pico_fifo_push',
      'pico_fifo_pop',
      'pico_fifo_available',
      // Pico W WiFi
      'pico_wifi_connect',
      'pico_wifi_soft_ap',
      'pico_wifi_is_connected',
      'pico_wifi_local_ip',
      'pico_wifi_soft_ap_ip',
      'pico_wifi_rssi',
      'pico_wifi_mac_address',
      'pico_wifi_disconnect',
    ];

    for (const type of requiredBlocks) {
      expect(blockTypes.has(type), `Block ${type} must be defined in BLOCK_DEFS`).toBe(true);
      const def = BLOCK_DEFS.find((b) => b.type === type);
      expect(def.message0).toBeDefined();
      expect(def.tooltip).toBeDefined();
      expect(def.colour).toBe('#c51a4a');
    }
  });

  it('correctly classifies HAT_TYPES and VALUE_TYPES for Pico blocks', () => {
    expect(HAT_TYPES.has('pico_setup')).toBe(true);
    expect(HAT_TYPES.has('pico_core1_setup')).toBe(true);
    expect(HAT_TYPES.has('pico_core1_loop')).toBe(true);

    const values = [
      'pico_get_temp',
      'pico_get_free_ram',
      'pico_get_chip_id',
      'pico_analog_read',
      'pico_analog_read_voltage',
      'pico_fifo_pop',
      'pico_fifo_available',
      'pico_wifi_is_connected',
      'pico_wifi_local_ip',
      'pico_wifi_soft_ap_ip',
      'pico_wifi_rssi',
      'pico_wifi_mac_address',
    ];

    for (const v of values) {
      expect(VALUE_TYPES.has(v), `${v} must be in VALUE_TYPES`).toBe(true);
    }
  });

  it('generates accurate C++ code for Pico System & Core blocks', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    // pico_setup
    const setupBlock = mockBlock('pico_setup', { BAUD: '115200' }, {}, { DO: '  pinMode(LED_BUILTIN, OUTPUT);\n' });
    const setupCode = gen.blockToCode(setupBlock);
    expect(setupCode).toContain('Serial.begin(115200);');
    expect(setupCode).toContain('pinMode(LED_BUILTIN, OUTPUT);');

    // pico_setup with None baud
    const noSerialSetup = gen.blockToCode(mockBlock('pico_setup', { BAUD: 'NONE' }, {}, { DO: '  int x = 1;\n' }));
    expect(noSerialSetup).not.toContain('Serial.begin');
    expect(noSerialSetup).toContain('int x = 1;');

    // pico_cpu_freq
    expect(gen.blockToCode(mockBlock('pico_cpu_freq', { FREQ: '250' }))).toBe('set_sys_clock_khz(250 * 1000, true);\n');

    // pico_get_temp
    expect(gen.blockToCode(mockBlock('pico_get_temp', { UNIT: 'C' }))[0]).toBe('analogReadTemp()');
    expect(gen.blockToCode(mockBlock('pico_get_temp', { UNIT: 'F' }))[0]).toContain('analogReadTemp() * 1.8f + 32.0f');

    // pico_reboot
    expect(gen.blockToCode(mockBlock('pico_reboot'))).toBe('rp2040.reboot();\n');

    // pico_get_free_ram
    expect(gen.blockToCode(mockBlock('pico_get_free_ram'))[0]).toBe('(int)rp2040.getFreeHeap()');

    // pico_get_chip_id
    expect(gen.blockToCode(mockBlock('pico_get_chip_id'))[0]).toBe('String(rp2040.getChipID(), HEX)');
  });

  it('generates accurate C++ code for Pico IO & Sensor blocks', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    // Built-in LED (universal across Pico and Pico W via LED_BUILTIN)
    expect(gen.blockToCode(mockBlock('pico_led_builtin', { VAL: 'HIGH' }))).toContain('digitalWrite(LED_BUILTIN, HIGH);');
    expect(gen.blockToCode(mockBlock('pico_led_builtin', { VAL: 'LOW' }))).toContain('digitalWrite(LED_BUILTIN, LOW);');
    expect(gen.blockToCode(mockBlock('pico_led_toggle'))).toContain('digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));');

    // Analog read
    expect(gen.blockToCode(mockBlock('pico_analog_read', { PIN: '26' }))[0]).toBe('analogRead(26)');
    expect(gen.blockToCode(mockBlock('pico_analog_read_voltage', { PIN: '27' }))[0]).toBe('(analogRead(27) * 3.3f / 1023.0f)');

    // ADC resolution
    expect(gen.blockToCode(mockBlock('pico_adc_resolution', { BITS: '12' }))).toBe('analogReadResolution(12);\n');
  });

  it('generates accurate C++ code for Pico Hardware PWM blocks', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    // PWM write
    expect(gen.blockToCode(mockBlock('pico_pwm_write', { PIN: '15' }, { DUTY: '200' }))).toBe('analogWrite(15, 200);\n');

    // PWM freq & range
    expect(gen.blockToCode(mockBlock('pico_pwm_freq', {}, { FREQ: '5000' }))).toBe('analogWriteFreq(5000);\n');
    expect(gen.blockToCode(mockBlock('pico_pwm_range', {}, { RANGE: '1023' }))).toBe('analogWriteRange(1023);\n');

    // Tone & noTone
    expect(gen.blockToCode(mockBlock('pico_tone', { PIN: '2' }, { FREQ: '880', DUR: '250' }))).toBe('tone(2, 880, 250);\n');
    expect(gen.blockToCode(mockBlock('pico_no_tone', { PIN: '2' }))).toBe('noTone(2);\n');
  });

  it('generates accurate C++ code for RP2040 Dual-Core Multiprocessing blocks', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    // setup1 and loop1
    const core1Setup = gen.blockToCode(mockBlock('pico_core1_setup', {}, {}, { DO: '  pinMode(LED_BUILTIN, OUTPUT);\n' }));
    expect(core1Setup).toBe('void setup1() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\n');

    const core1Loop = gen.blockToCode(mockBlock('pico_core1_loop', {}, {}, { DO: '  digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n' }));
    expect(core1Loop).toBe('void loop1() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n}\n\n');

    // Hardware FIFO
    expect(gen.blockToCode(mockBlock('pico_fifo_push', {}, { VAL: '42' }))).toBe('rp2040.fifo.push((uint32_t)(42));\n');
    expect(gen.blockToCode(mockBlock('pico_fifo_pop'))[0]).toBe('(int)rp2040.fifo.pop()');
    expect(gen.blockToCode(mockBlock('pico_fifo_available'))[0]).toBe('(rp2040.fifo.available() > 0)');
  });

  it('generates accurate C++ code for Pico W WiFi blocks and enables WiFi header', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    gen._useWiFi = false;
    const connectCode = gen.blockToCode(mockBlock('pico_wifi_connect', {}, { SSID: '"MyHomeNetwork"', PASS: '"SecretPicoPass"' }));
    expect(connectCode).toBe('WiFi.begin("MyHomeNetwork", "SecretPicoPass");\n');
    expect(gen._useWiFi).toBe(true);

    const apCode = gen.blockToCode(mockBlock('pico_wifi_soft_ap', {}, { SSID: '"PicoAP"', PASS: '"87654321"' }));
    expect(apCode).toBe('WiFi.softAP("PicoAP", "87654321");\n');

    expect(gen.blockToCode(mockBlock('pico_wifi_is_connected'))[0]).toBe('(WiFi.status() == WL_CONNECTED)');
    expect(gen.blockToCode(mockBlock('pico_wifi_local_ip'))[0]).toBe('WiFi.localIP().toString()');
    expect(gen.blockToCode(mockBlock('pico_wifi_soft_ap_ip'))[0]).toBe('WiFi.softAPIP().toString()');
    expect(gen.blockToCode(mockBlock('pico_wifi_rssi'))[0]).toBe('(int)WiFi.RSSI()');
    expect(gen.blockToCode(mockBlock('pico_wifi_mac_address'))[0]).toBe('WiFi.macAddress()');
    expect(gen.blockToCode(mockBlock('pico_wifi_disconnect'))).toBe('WiFi.disconnect();\n');
  });

  it('provides dedicated Pico pins and analog channels via pin helpers', () => {
    const picoPins = GET_PICO_PINS();
    expect(picoPins.length).toBe(26);
    expect(picoPins.some((p) => p[0].includes('GP0') && p[1] === '0')).toBe(true);
    expect(picoPins.some((p) => p[0].includes('GP28') && p[1] === '28')).toBe(true);

    const analogPins = GET_PICO_ANALOG_PINS();
    expect(analogPins.length).toBe(4);
    expect(analogPins.some((p) => p[0].includes('GP26') && p[1] === '26')).toBe(true);

    window.BLOCKLY_BOARD_KIND = 'openhw-pico';
    const digital = GET_DIGITAL_PINS();
    expect(digital.length).toBe(29);
    expect(digital.some((p) => p[0].includes('GP25 (LED)') && p[1] === '25')).toBe(true);

    const analog = GET_ANALOG_PINS();
    expect(analog.length).toBe(3);
    window.BLOCKLY_BOARD_KIND = 'arduino_uno';
  });

  it('assembles a full dual-core RP2040 multitasking sketch with generateSketch', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    const blocks = [
      mockBlock('pico_setup', { BAUD: '115200' }, {}, {
        DO: '  set_sys_clock_khz(133 * 1000, true);\n'
      }),
      mockBlock('forever', {}, {}, {
        DO: '  if ((rp2040.fifo.available() > 0)) {\n    int val = (int)rp2040.fifo.pop();\n    Serial.println(val);\n  }\n  delay(100);\n'
      }),
      mockBlock('pico_core1_setup', {}, {}, {
        DO: '  pinMode(LED_BUILTIN, OUTPUT);\n'
      }),
      mockBlock('pico_core1_loop', {}, {}, {
        DO: '  digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(500);\n  rp2040.fifo.push((uint32_t)(1));\n'
      }),
    ];

    const mockWs = {
      getAllBlocks: () => blocks,
      getTopBlocks: () => blocks,
      getAllVariables: () => [],
    };

    const sketch = generateSketch(gen, mockWs);

    expect(sketch).toContain('void setup() {');
    expect(sketch).toContain('Serial.begin(115200);');
    expect(sketch).toContain('set_sys_clock_khz(133 * 1000, true);');
    expect(sketch).toContain('void loop() {');
    expect(sketch).toContain('rp2040.fifo.available()');
    expect(sketch).toContain('void setup1() {');
    expect(sketch).toContain('void loop1() {');
    expect(sketch).toContain('rp2040.fifo.push');
  });

  it('assembles a complete Pico W IoT WiFi station sketch with generateSketch', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    const blocks = [
      mockBlock('pico_setup', { BAUD: '115200' }, {}, {
        DO: '  WiFi.begin("IoT-Network", "pico1234");\n'
      }),
      mockBlock('forever', {}, {}, {
        DO: '  if ((WiFi.status() == WL_CONNECTED)) {\n    Serial.println(WiFi.localIP().toString());\n    Serial.println(analogReadTemp());\n  }\n  delay(2000);\n'
      }),
    ];

    const mockWs = {
      getAllBlocks: () => blocks,
      getTopBlocks: () => blocks,
      getAllVariables: () => [],
    };

    const sketch = generateSketch(gen, mockWs);

    expect(sketch).toContain('#include <WiFi.h>');
    expect(sketch).toContain('Serial.begin(115200);');
    expect(sketch).toContain('WiFi.begin("IoT-Network", "pico1234");');
    expect(sketch).toContain('WiFi.localIP().toString()');
    expect(sketch).toContain('analogReadTemp()');
  });
});
