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
  GET_PWM_PINS,
  GET_ESP32_TOUCH_PINS,
  GET_ESP32_DAC_PINS,
  GET_ESP32_RTC_PINS,
  GET_ESP32_LEDC_CHANNELS,
  GET_ESP32CAM_FRAMESIZES,
  GET_ESP32CAM_PIXFORMATS,
  GET_ESP32CAM_EFFECTS,
  buildGenerator,
  generateSketch,
} from '../../../src/components/BlocklyEditor.jsx';

// Lightweight mock for Blockly.Generator to test buildGenerator
class MockGenerator {
  constructor(name) {
    this.name = name;
    this.forBlock = {};
    this.ORDER_ATOMIC = 0;
    this.ORDER_NONE = 99;
    this.ORDER_EQUALITY = 8;
    this.ORDER_MEMBER = 1;
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

describe('ESP32 and ESP32-CAM Blockly Blocks & Generators', () => {
  it('registers ESP32 and ESP32-CAM categories and subcategories', () => {
    const esp32Cat = CATEGORIES.find((c) => c.id === 'esp32');
    const camCat = CATEGORIES.find((c) => c.id === 'esp32cam');

    expect(esp32Cat).toBeDefined();
    expect(esp32Cat.label).toBe('ESP32');
    expect(camCat).toBeDefined();
    expect(camCat.label).toBe('ESP32-CAM');

    expect(SUB_CATEGORIES.esp32).toBeDefined();
    expect(SUB_CATEGORIES.esp32.map((s) => s.id)).toEqual([
      'esp32_system',
      'esp32_wifi',
      'esp32_io',
      'esp32_pwm',
    ]);

    expect(SUB_CATEGORIES.esp32cam).toBeDefined();
    expect(SUB_CATEGORIES.esp32cam.map((s) => s.id)).toEqual([
      'esp32cam_core',
      'esp32cam_sensor',
      'esp32cam_storage',
    ]);
  });

  it('provides all expected block types in CATEGORY_BLOCKS', () => {
    const expectedSubcats = [
      'esp32_system',
      'esp32_wifi',
      'esp32_io',
      'esp32_pwm',
      'esp32cam_core',
      'esp32cam_sensor',
      'esp32cam_storage',
    ];

    for (const subcat of expectedSubcats) {
      expect(CATEGORY_BLOCKS[subcat]).toBeDefined();
      expect(CATEGORY_BLOCKS[subcat].length).toBeGreaterThan(0);
    }
  });

  it('defines every single block in BLOCK_DEFS with valid schema', () => {
    const blockTypes = new Set(BLOCK_DEFS.map((b) => b.type));

    const requiredBlocks = [
      // ESP32 System
      'esp32_setup',
      'esp32_restart',
      'esp32_cpu_freq',
      'esp32_deep_sleep',
      'esp32_light_sleep',
      'esp32_ext0_wakeup',
      'esp32_touch_wakeup',
      'esp32_get_free_heap',
      'esp32_get_chip_model',
      // ESP32 WiFi
      'esp32_wifi_connect',
      'esp32_wifi_soft_ap',
      'esp32_wifi_is_connected',
      'esp32_wifi_local_ip',
      'esp32_wifi_soft_ap_ip',
      'esp32_wifi_rssi',
      'esp32_wifi_mac_address',
      'esp32_wifi_disconnect',
      // ESP32 IO
      'esp32_touch_read',
      'esp32_dac_write',
      'esp32_hall_read',
      'esp32_temp_read',
      'esp32_adc_resolution',
      'esp32_adc_attenuation',
      // ESP32 PWM
      'esp32_ledc_setup',
      'esp32_ledc_attach',
      'esp32_ledc_write',
      'esp32_ledc_tone',
      // ESP32-CAM Core
      'esp32cam_init',
      'esp32cam_init_status',
      'esp32cam_capture',
      'esp32cam_has_frame',
      'esp32cam_return_fb',
      'esp32cam_frame_length',
      'esp32cam_frame_width',
      'esp32cam_frame_height',
      // ESP32-CAM Sensor & Flash
      'esp32cam_flash_led',
      'esp32cam_flash_brightness',
      'esp32cam_status_led',
      'esp32cam_set_brightness',
      'esp32cam_set_contrast',
      'esp32cam_set_effect',
      'esp32cam_flip',
      // ESP32-CAM Storage
      'esp32cam_sd_init',
      'esp32cam_sd_card_size',
      'esp32cam_sd_save_photo',
    ];

    for (const type of requiredBlocks) {
      expect(blockTypes.has(type), `Block ${type} must be in BLOCK_DEFS`).toBe(true);
      const def = BLOCK_DEFS.find((b) => b.type === type);
      expect(def.message0).toBeDefined();
      expect(def.tooltip).toBeDefined();
    }
  });

  it('correctly classifies HAT_TYPES and VALUE_TYPES for ESP32 & ESP32-CAM', () => {
    expect(HAT_TYPES.has('esp32_setup')).toBe(true);

    const values = [
      'esp32_wifi_is_connected',
      'esp32_wifi_local_ip',
      'esp32_wifi_soft_ap_ip',
      'esp32_wifi_rssi',
      'esp32_wifi_mac_address',
      'esp32_touch_read',
      'esp32_hall_read',
      'esp32_temp_read',
      'esp32_get_free_heap',
      'esp32_get_chip_model',
      'esp32cam_init_status',
      'esp32cam_has_frame',
      'esp32cam_frame_length',
      'esp32cam_frame_width',
      'esp32cam_frame_height',
      'esp32cam_sd_card_size',
    ];

    for (const v of values) {
      expect(VALUE_TYPES.has(v), `${v} must be in VALUE_TYPES`).toBe(true);
    }
  });

  it('generates accurate C++ code for all ESP32 System & Power blocks', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    // esp32_setup
    const setupBlock = mockBlock('esp32_setup', { BAUD: '115200' }, {}, { DO: '  pinMode(2, OUTPUT);\n' });
    const setupCode = gen.blockToCode(setupBlock);
    expect(setupCode).toContain('Serial.begin(115200);');
    expect(setupCode).toContain('pinMode(2, OUTPUT);');

    // esp32_restart
    expect(gen.blockToCode(mockBlock('esp32_restart'))).toBe('ESP.restart();\n');

    // esp32_cpu_freq
    expect(gen.blockToCode(mockBlock('esp32_cpu_freq', { FREQ: '240' }))).toBe('setCpuFrequencyMhz(240);\n');

    // esp32_deep_sleep
    expect(gen.blockToCode(mockBlock('esp32_deep_sleep', {}, { SEC: '15' }))).toContain('esp_sleep_enable_timer_wakeup((uint64_t)(15) * 1000000ULL);');
    expect(gen.blockToCode(mockBlock('esp32_deep_sleep', {}, { SEC: '15' }))).toContain('esp_deep_sleep_start();');

    // esp32_light_sleep
    expect(gen.blockToCode(mockBlock('esp32_light_sleep', {}, { SEC: '5' }))).toContain('esp_light_sleep_start();');

    // esp32_ext0_wakeup
    expect(gen.blockToCode(mockBlock('esp32_ext0_wakeup', { PIN: '0', LEVEL: '0' }))).toBe('esp_sleep_enable_ext0_wakeup((gpio_num_t)0, 0);\n');

    // esp32_touch_wakeup
    expect(gen.blockToCode(mockBlock('esp32_touch_wakeup'))).toBe('esp_sleep_enable_touchpad_wakeup();\n');

    // esp32_get_free_heap
    expect(gen.blockToCode(mockBlock('esp32_get_free_heap'))[0]).toBe('(int)ESP.getFreeHeap()');

    // esp32_get_chip_model
    expect(gen.blockToCode(mockBlock('esp32_get_chip_model'))[0]).toBe('String(ESP.getChipModel())');
  });

  it('generates accurate C++ code for all ESP32 WiFi blocks and triggers WiFi header flag', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    gen._useWiFi = false;
    const connectCode = gen.blockToCode(mockBlock('esp32_wifi_connect', {}, { SSID: '"MyHomeWiFi"', PASS: '"SecretPass"' }));
    expect(connectCode).toBe('WiFi.begin("MyHomeWiFi", "SecretPass");\n');
    expect(gen._useWiFi).toBe(true);

    const apCode = gen.blockToCode(mockBlock('esp32_wifi_soft_ap', {}, { SSID: '"ESP32_AP"', PASS: '"12345678"' }));
    expect(apCode).toBe('WiFi.softAP("ESP32_AP", "12345678");\n');

    expect(gen.blockToCode(mockBlock('esp32_wifi_is_connected'))[0]).toBe('(WiFi.status() == WL_CONNECTED)');
    expect(gen.blockToCode(mockBlock('esp32_wifi_local_ip'))[0]).toBe('WiFi.localIP().toString()');
    expect(gen.blockToCode(mockBlock('esp32_wifi_soft_ap_ip'))[0]).toBe('WiFi.softAPIP().toString()');
    expect(gen.blockToCode(mockBlock('esp32_wifi_rssi'))[0]).toBe('(int)WiFi.RSSI()');
    expect(gen.blockToCode(mockBlock('esp32_wifi_mac_address'))[0]).toBe('WiFi.macAddress()');
    expect(gen.blockToCode(mockBlock('esp32_wifi_disconnect'))).toBe('WiFi.disconnect();\n');
  });

  it('generates accurate C++ code for ESP32 IO, DAC, ADC, and LEDC PWM blocks', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    expect(gen.blockToCode(mockBlock('esp32_touch_read', { PIN: '4' }))[0]).toBe('touchRead(4)');
    expect(gen.blockToCode(mockBlock('esp32_dac_write', { PIN: '25' }, { VAL: '200' }))).toBe('dacWrite(25, 200);\n');
    expect(gen.blockToCode(mockBlock('esp32_hall_read'))[0]).toBe('hallRead()');
    expect(gen.blockToCode(mockBlock('esp32_temp_read'))[0]).toBe('temperatureRead()');
    expect(gen.blockToCode(mockBlock('esp32_adc_resolution', { BITS: '10' }))).toBe('analogReadResolution(10);\n');
    expect(gen.blockToCode(mockBlock('esp32_adc_attenuation', { ATTEN: 'ADC_11db' }))).toBe('analogSetAttenuation(ADC_11db);\n');

    expect(gen.blockToCode(mockBlock('esp32_ledc_setup', { CHANNEL: '0', RES: '8' }, { FREQ: '5000' }))).toBe('ledcSetup(0, 5000, 8);\n');
    expect(gen.blockToCode(mockBlock('esp32_ledc_attach', { PIN: '18', CHANNEL: '0' }))).toBe('ledcAttachPin(18, 0);\n');
    expect(gen.blockToCode(mockBlock('esp32_ledc_write', { CHANNEL: '0' }, { DUTY: '128' }))).toBe('ledcWrite(0, 128);\n');
    expect(gen.blockToCode(mockBlock('esp32_ledc_tone', { CHANNEL: '0' }, { FREQ: '440' }))).toBe('ledcWriteTone(0, 440);\n');
  });

  it('generates accurate C++ code for all ESP32-CAM Core blocks and sets _useCamera', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    gen._useCamera = false;
    const initCode = gen.blockToCode(mockBlock('esp32cam_init', { FRAMESIZE: 'FRAMESIZE_VGA', FORMAT: 'PIXFORMAT_JPEG' }, { QUALITY: '10' }));
    expect(gen._useCamera).toBe(true);
    expect(initCode).toContain('camera_config_t config;');
    expect(initCode).toContain('config.pin_d0 = 5;');
    expect(initCode).toContain('config.pin_vsync = 25;');
    expect(initCode).toContain('config.pin_href = 23;');
    expect(initCode).toContain('config.pixel_format = PIXFORMAT_JPEG;');
    expect(initCode).toContain('config.frame_size = FRAMESIZE_VGA;');
    expect(initCode).toContain('config.jpeg_quality = 10;');
    expect(initCode).toContain('camera_init_result = esp_camera_init(&config);');

    expect(gen.blockToCode(mockBlock('esp32cam_init_status'))[0]).toBe('(camera_init_result == ESP_OK)');

    const captureCode = gen.blockToCode(mockBlock('esp32cam_capture'));
    expect(captureCode).toContain('esp_camera_fb_return(fb);');
    expect(captureCode).toContain('fb = esp_camera_fb_get();');

    expect(gen.blockToCode(mockBlock('esp32cam_has_frame'))[0]).toBe('(fb != NULL)');
    expect(gen.blockToCode(mockBlock('esp32cam_return_fb'))).toContain('esp_camera_fb_return(fb);');
    expect(gen.blockToCode(mockBlock('esp32cam_frame_length'))[0]).toBe('(fb ? (int)fb->len : 0)');
    expect(gen.blockToCode(mockBlock('esp32cam_frame_width'))[0]).toBe('(fb ? (int)fb->width : 0)');
    expect(gen.blockToCode(mockBlock('esp32cam_frame_height'))[0]).toBe('(fb ? (int)fb->height : 0)');
  });

  it('generates accurate C++ code for ESP32-CAM Flash, Sensor Adjustments, and SD Card storage', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    // Flash LED on GPIO 4
    expect(gen.blockToCode(mockBlock('esp32cam_flash_led', { VAL: 'HIGH' }))).toContain('digitalWrite(4, HIGH);');
    expect(gen.blockToCode(mockBlock('esp32cam_flash_brightness', {}, { VAL: '255' }))).toContain('ledcAttachPin(4, 7);');

    // Status LED on GPIO 33
    expect(gen.blockToCode(mockBlock('esp32cam_status_led', { VAL: 'LOW' }))).toContain('digitalWrite(33, LOW);');

    // Sensor tweaks
    expect(gen.blockToCode(mockBlock('esp32cam_set_brightness', {}, { VAL: '1' }))).toContain('s->set_brightness(s, 1);');
    expect(gen.blockToCode(mockBlock('esp32cam_set_contrast', {}, { VAL: '-1' }))).toContain('s->set_contrast(s, -1);');
    expect(gen.blockToCode(mockBlock('esp32cam_set_effect', { EFFECT: '2' }))).toContain('s->set_special_effect(s, 2);');
    expect(gen.blockToCode(mockBlock('esp32cam_flip', { VFLIP: '1', HMIRROR: '1' }))).toContain('s->set_vflip(s, 1); s->set_hmirror(s, 1);');

    // MicroSD
    gen._useSD = false;
    expect(gen.blockToCode(mockBlock('esp32cam_sd_init'))).toContain('SD_MMC.begin("/sdcard", true);');
    expect(gen._useSD).toBe(true);

    expect(gen.blockToCode(mockBlock('esp32cam_sd_card_size'))[0]).toContain('SD_MMC.cardSize()');

    const saveCode = gen.blockToCode(mockBlock('esp32cam_sd_save_photo', {}, { PATH: '"/capture.jpg"' }));
    expect(saveCode).toContain('SD_MMC.open("/capture.jpg", FILE_WRITE)');
    expect(saveCode).toContain('file.write(fb->buf, fb->len);');
  });

  it('properly adapts pins for ESP32-CAM and ESP32 DevKit', () => {
    window.BLOCKLY_BOARD_KIND = 'openhw-esp32-cam';
    const camDigital = GET_DIGITAL_PINS();
    expect(camDigital.some((p) => p[0].includes('Flash LED') && p[1] === '4')).toBe(true);
    expect(camDigital.some((p) => p[0].includes('Red LED') && p[1] === '33')).toBe(true);

    window.BLOCKLY_BOARD_KIND = 'openhw-esp32';
    const espDigital = GET_DIGITAL_PINS();
    expect(espDigital.some((p) => p[0].includes('GPIO 2 (LED)') && p[1] === '2')).toBe(true);
    expect(espDigital.some((p) => p[0].includes('SDA') && p[1] === '21')).toBe(true);

    const espPwm = GET_PWM_PINS();
    // Input-only pins 34, 35, 36, 39 must be excluded from PWM
    expect(espPwm.some((p) => ['34', '35', '36', '39'].includes(p[1]))).toBe(false);

    window.BLOCKLY_BOARD_KIND = 'arduino_uno';
  });

  it('assembles a full sketch with generateSketch including WiFi, Camera and SD headers', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    const blocks = [
      mockBlock('esp32_setup', { BAUD: '115200' }, {}, {
        DO: '  WiFi.begin("Wokwi-GUEST", "");\n  SD_MMC.begin("/sdcard", true);\n'
      }),
      mockBlock('esp32cam_init', { FRAMESIZE: 'FRAMESIZE_QQVGA', FORMAT: 'PIXFORMAT_RGB565' }, { QUALITY: '12' }),
      mockBlock('forever', {}, {}, {
        DO: '  if (fb) { esp_camera_fb_return(fb); fb = NULL; }\n  fb = esp_camera_fb_get();\n  delay(1000);\n'
      }),
    ];

    const mockWs = {
      getAllBlocks: () => blocks,
      getTopBlocks: () => blocks,
      getAllVariables: () => [],
    };

    const sketch = generateSketch(gen, mockWs);

    expect(sketch).toContain('// Generated by OpenHW Studio Block Editor');
    expect(sketch).toContain('#include <WiFi.h>');
    expect(sketch).toContain('#include "esp_camera.h"');
    expect(sketch).toContain('#include "esp_system.h"');
    expect(sketch).toContain('#include "FS.h"');
    expect(sketch).toContain('#include "SD_MMC.h"');
    expect(sketch).toContain('camera_fb_t *fb = NULL;');
    expect(sketch).toContain('void setup() {');
    expect(sketch).toContain('Serial.begin(115200);');
    expect(sketch).toContain('camera_init_result = esp_camera_init(&config);');
    expect(sketch).toContain('void loop() {');
    expect(sketch).toContain('fb = esp_camera_fb_get();');
  });

  it('handles edge cases and fallback values gracefully across all blocks', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    // esp32_setup with NONE baud (no Serial.begin)
    const noneSetup = gen.blockToCode(mockBlock('esp32_setup', { BAUD: 'NONE' }, {}, { DO: '  pinMode(4, OUTPUT);\n' }));
    expect(noneSetup).not.toContain('Serial.begin');
    expect(noneSetup).toContain('pinMode(4, OUTPUT);');

    // Default WiFi params when inputs empty
    const defWifi = gen.blockToCode(mockBlock('esp32_wifi_connect'));
    expect(defWifi).toBe('WiFi.begin("Wokwi-GUEST", "");\n');

    // Default sleep seconds
    const defSleep = gen.blockToCode(mockBlock('esp32_deep_sleep'));
    expect(defSleep).toContain('(uint64_t)(10) * 1000000ULL');

    // Default LEDC PWM frequency and resolution
    const defPwm = gen.blockToCode(mockBlock('esp32_ledc_setup'));
    expect(defPwm).toBe('ledcSetup(0, 5000, 8);\n');

    // Default SD path
    const defSdSave = gen.blockToCode(mockBlock('esp32cam_sd_save_photo'));
    expect(defSdSave).toContain('SD_MMC.open("/picture.jpg", FILE_WRITE)');
  });

  it('generates a full ESP32 IoT WiFi station sketch with sensors and telemetry', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    const blocks = [
      mockBlock('esp32_setup', { BAUD: '115200' }, {}, {
        DO: '  WiFi.begin("Home-Network", "MyPass123");\n  analogReadResolution(12);\n  analogSetAttenuation(ADC_11db);\n'
      }),
      mockBlock('forever', {}, {}, {
        DO: '  if ((WiFi.status() == WL_CONNECTED)) {\n    Serial.println(WiFi.localIP().toString());\n    Serial.println(touchRead(4));\n    Serial.println(temperatureRead());\n  }\n  delay(2000);\n'
      }),
    ];

    const mockWs = {
      getAllBlocks: () => blocks,
      getTopBlocks: () => blocks,
      getAllVariables: () => [],
    };

    const sketch = generateSketch(gen, mockWs);

    expect(sketch).toContain('#include <WiFi.h>');
    expect(sketch).toContain('WiFi.begin("Home-Network", "MyPass123");');
    expect(sketch).toContain('analogReadResolution(12);');
    expect(sketch).toContain('analogSetAttenuation(ADC_11db);');
    expect(sketch).toContain('touchRead(4)');
    expect(sketch).toContain('temperatureRead()');
  });

  it('generates a complete ESP32-CAM Timelapse & Flash snapshot sketch', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    const blocks = [
      mockBlock('esp32_setup', { BAUD: '115200' }, {}, {
        DO: '  SD_MMC.begin("/sdcard", true);\n'
      }),
      mockBlock('esp32cam_init', { FRAMESIZE: 'FRAMESIZE_SVGA', FORMAT: 'PIXFORMAT_JPEG' }, { QUALITY: '10' }),
      mockBlock('forever', {}, {}, {
        DO: '  pinMode(4, OUTPUT);\n  digitalWrite(4, HIGH);\n  delay(100);\n  if (fb) { esp_camera_fb_return(fb); fb = NULL; }\n  fb = esp_camera_fb_get();\n  digitalWrite(4, LOW);\n  if (fb) {\n    File file = SD_MMC.open("/timelapse.jpg", FILE_WRITE);\n    if (file) { file.write(fb->buf, fb->len); file.close(); }\n  }\n  delay(5000);\n'
      }),
    ];

    const mockWs = {
      getAllBlocks: () => blocks,
      getTopBlocks: () => blocks,
      getAllVariables: () => [],
    };

    const sketch = generateSketch(gen, mockWs);

    expect(sketch).toContain('#include "esp_camera.h"');
    expect(sketch).toContain('#include "FS.h"');
    expect(sketch).toContain('#include "SD_MMC.h"');
    expect(sketch).toContain('camera_fb_t *fb = NULL;');
    expect(sketch).toContain('esp_err_t camera_init_result = ESP_FAIL;');
    expect(sketch).toContain('config.frame_size = FRAMESIZE_SVGA;');
    expect(sketch).toContain('config.pixel_format = PIXFORMAT_JPEG;');
    expect(sketch).toContain('config.jpeg_quality = 10;');
    expect(sketch).toContain('SD_MMC.begin("/sdcard", true);');
    expect(sketch).toContain('digitalWrite(4, HIGH);');
    expect(sketch).toContain('esp_camera_fb_get()');
    expect(sketch).toContain('SD_MMC.open("/timelapse.jpg", FILE_WRITE)');
  });

  it('generates ESP32 hardware LEDC PWM motor/dimmer control sketch', () => {
    const mockB = { Generator: MockGenerator };
    const gen = buildGenerator(mockB);

    const blocks = [
      mockBlock('esp32_setup', { BAUD: '115200' }, {}, {
        DO: '  ledcSetup(0, 5000, 8);\n  ledcAttachPin(18, 0);\n'
      }),
      mockBlock('forever', {}, {}, {
        DO: '  ledcWrite(0, 200);\n  delay(1000);\n  ledcWriteTone(0, 880);\n  delay(500);\n'
      }),
    ];

    const mockWs = {
      getAllBlocks: () => blocks,
      getTopBlocks: () => blocks,
      getAllVariables: () => [],
    };

    const sketch = generateSketch(gen, mockWs);

    expect(sketch).toContain('ledcSetup(0, 5000, 8);');
    expect(sketch).toContain('ledcAttachPin(18, 0);');
    expect(sketch).toContain('ledcWrite(0, 200);');
    expect(sketch).toContain('ledcWriteTone(0, 880);');
  });
});
