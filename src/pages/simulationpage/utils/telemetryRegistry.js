/**
 * Static Telemetry Registry
 * Defines the available state parameters for all OpenHW and Wokwi component types.
 * Used for O(1) zero-overhead parameter lookup in the Telemetry Selection Modal and Delta mode filtering.
 */

export const COMPONENT_TELEMETRY_PARAMS = {
  // OpenHW Components
  'openhw-led': ['illuminated', 'brightness', 'color', 'burnedOut', 'glow', 'voltageDrop', 'current'],
  'openhw-rgb-led': ['color', 'r', 'g', 'b', 'voltageDrop'],
  'openhw-pushbutton': ['pressed', 'bounceCount', 'voltage'],
  'openhw-resistor': ['resistance', 'voltageDrop', 'current', 'powerDissipation'],
  'openhw-potentiometer': ['angle', 'value', 'voltageOut'],
  'openhw-slide-potentiometer': ['value', 'voltageOut'],
  'openhw-buzzer': ['playing', 'isBuzzing', 'frequency', 'volume', 'muted'],
  'openhw-servo': ['angle', 'pulseWidthMs', 'speed', 'moving'],
  'openhw-motor': ['speed'],
  'openhw-stepper-motor': ['angle'],
  'openhw-a4988': ['active', 'stepCount'],
  'openhw-motor-driver': ['active'],
  'openhw-l293d': ['active'],
  'openhw-ssd1306-oled': ['vram', 'invert', 'allOn', 'displayOn', 'displayStartLine', 'segmentRemap', 'comScanDir', 'displayOffset', 'vramDirty', 'updateCount', 'powerStatus', 'displayMode', 'contrast', 'vramFillPercentage', 'addressingMode'],
  'openhw-max7219': ['intensity', 'scanLimit', 'shutdown', 'decodeMode', 'updateCount'],
  'openhw-lcd1602': ['cursorX', 'cursorY', 'backlight', 'lines', 'illuminated'],
  'openhw-lcd1602-i2c': ['lines', 'illuminated', 'backlight'],
  'openhw-lcd2004-i2c': ['lines', 'illuminated', 'backlight'],
  'openhw-ili9341': ['powerOn', 't'],
  'openhw-nokia-5110': ['fbStr'],
  'openhw-7segment': ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'],
  'openhw-tm1637-7segment': ['display', 'colon', 'brightness', 'on'],
  'openhw-neopixel-matrix': ['pixels', 'brightness', 'count'],
  'openhw-neopixel-ring': ['pixels', 'brightness', 'count'],
  'openhw-ws2812b': ['pixels', 'brightness', 'count'],
  'openhw-mpu6050': ['ax', 'ay', 'az', 'gx', 'gy', 'gz', 'temp'],
  'openhw-ds1307-rtc': ['running', 'time'],
  'openhw-bmp180': ['temp', 'pressure', 'altitude'],
  'openhw-dht22': ['temperature', 'humidity', 'lastReadMs', 'error'],
  'max30102': ['ir', 'red', 'temp', 'active'],
  'openhw-hc-sr04': ['distance', 'echoTimeMs'],
  'openhw-ultrasonic-distance-sensor': ['distance', 'echoTimeMs'],
  'openhw-pir-motion-sensor': ['motion', 'triggerCount'],
  'openhw-photoresistor': ['lux', 'resistance', 'voltage'],
  'openhw-photoresistor-sensor': ['lux', 'resistance', 'voltage'],
  'openhw-photodiode': ['light'],
  'openhw-ldr-module': ['light', 'threshold', 'dOut'],
  'openhw-soil-moisture-sensor': ['moisture'],
  'openhw-ntc-thermistor': ['temperature', 'resistance', 'voltage'],
  'openhw-ntc-temperature-sensor': ['temperature', 'resistance', 'voltage'],
  'openhw-rotary-encoder': ['rot', 'sw'],
  'openhw-membrane-keypad': ['pressedKey', 'rows', 'cols'],
  'openhw-analog-joystick': ['x', 'y', 'pressed'],
  'openhw-dip-switch-8': ['switches', 'values'],
  'openhw-sd-card': ['cardInserted', 'status'],
  'shift_register': ['latch', 'clock', 'data', 'oe', 'pins', 'r', 'g', 'b'],
  'openhw-nlsf595': ['latch', 'clock', 'data', 'oe', 'pins', 'r', 'g', 'b'],
  'openhw-cd74hc4067': ['activeChannel'],
  'openhw-pca9685': [],
  'openhw-pca9865': [],
  'openhw-logic-analyzer': ['active'],
  'openhw-diode': [],
  'openhw-npn-transistor': [],
  'openhw-relay-module': ['active'],
  'openhw-ds18b20': ['temperature', 'powered', 'resolution'],
  'openhw-ir-receiver': ['protocol', 'lastCode', 'demodulatedSignal', 'powered'],
  'openhw-mfrc522': ['powered', 'cardPresent', 'cardUID'],
  'openhw-nrf24l01': ['power', 'mode', 'frequency', 'rxQueueSize', 'txQueueSize', 'statusReg'],
  'openhw-cc1101': ['state', 'frequency', 'modulation', 'rxQueueSize', 'txFifoSize', 'interruptPin'],
  'openhw-battery': ['voltage', 'capacity'],
  'openhw-charger': ['charging', 'charged'],
  'openhw-power-supply': ['voltage', 'current'],
  'openhw-breadboard': [],
  'openhw-breadboard-half': [],
  'openhw-breadboard-mini': [],
  'openhw-pcm5102': ['lastLeftSample', 'lastRightSample', 'peakAmplitude'],
  'openhw-max98357': ['lastLeftSample', 'lastRightSample', 'peakAmplitude'],
  'openhw-inmp441': ['peakAmplitude', 'liveMicEnabled', 'bufferIndex'],
  'openhw-sph0645': ['peakAmplitude', 'liveMicEnabled', 'bufferIndex'],
  'openhw-5w-speaker': ['audioChunk'],
  'openhw-arduino-uno': ['leds', 'deepSiliconRegisters', 'deepSiliconSRAM', 'deepSiliconTimers', 'deepSiliconPower', 'deepSiliconInterrupts'],
  'openhw-arduino-mega': ['leds', 'deepSiliconRegisters', 'deepSiliconSRAM', 'deepSiliconTimers', 'deepSiliconPower', 'deepSiliconInterrupts'],
  'openhw-arduino-nano': ['leds', 'deepSiliconRegisters', 'deepSiliconSRAM', 'deepSiliconTimers', 'deepSiliconPower', 'deepSiliconInterrupts'],
  'openhw-pico': ['led', 'deepSiliconRegisters', 'deepSiliconSRAM', 'deepSiliconTimers', 'deepSiliconPower', 'deepSiliconInterrupts'],
  'openhw-pico-w': ['led', 'deepSiliconRegisters', 'deepSiliconSRAM', 'deepSiliconTimers', 'deepSiliconPower', 'deepSiliconInterrupts'],
  'openhw-attiny85': ['pins', 'deepSiliconRegisters', 'deepSiliconSRAM', 'deepSiliconTimers', 'deepSiliconPower', 'deepSiliconInterrupts'],
  'openhw-arduino-sensor-shield': [],
  'logic-mux-2to1': ['d0High', 'd1High', 'selHigh', 'outputHigh'],
  'logic-d-flipflop': ['d', 'clk', 'q', 'qbar'],
  'logic-d-flipflop-r': ['d', 'clk', 'r', 'q', 'qbar'],
  'logic-d-flipflop-dsr': ['d', 'clk', 's', 'r', 'q', 'qbar'],
  'logic-clock-generator': ['out'],
  'logic-ic-74xx': ['icType', 'outputs'],

  // Legacy Wokwi Aliases
  'wokwi-led': ['illuminated', 'brightness', 'color', 'burnedOut', 'glow', 'voltageDrop', 'current'],
  'wokwi-rgb-led': ['color', 'r', 'g', 'b', 'voltageDrop'],
  'wokwi-pushbutton': ['pressed', 'bounceCount', 'voltage'],
  'wokwi-resistor': ['resistance', 'voltageDrop', 'current', 'powerDissipation'],
  'wokwi-potentiometer': ['angle', 'value', 'voltageOut'],
  'wokwi-slide-potentiometer': ['value', 'voltageOut'],
  'wokwi-buzzer': ['playing', 'isBuzzing', 'frequency', 'volume', 'muted'],
  'wokwi-servo': ['angle', 'pulseWidthMs', 'speed', 'moving'],
  'wokwi-motor': ['speed'],
  'wokwi-stepper-motor': ['angle'],
  'wokwi-a4988': ['active', 'stepCount'],
  'wokwi-ssd1306': ['vram', 'invert', 'allOn', 'displayOn', 'displayStartLine', 'segmentRemap', 'comScanDir', 'displayOffset', 'vramDirty', 'updateCount', 'powerStatus', 'displayMode', 'contrast', 'vramFillPercentage', 'addressingMode'],
  'wokwi-max7219-matrix': ['intensity', 'scanLimit', 'shutdown', 'decodeMode', 'updateCount'],
  'wokwi-lcd1602': ['cursorX', 'cursorY', 'backlight', 'lines', 'illuminated'],
  'wokwi-ili9341': ['powerOn', 't'],
  'wokwi-nokia-5110': ['fbStr'],
  'wokwi-7segment': ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'],
  'wokwi-tm1637-7segment': ['display', 'colon', 'brightness', 'on'],
  'wokwi-neopixel-matrix': ['pixels', 'brightness', 'count'],
  'wokwi-neopixel-ring': ['pixels', 'brightness', 'count'],
  'wokwi-ws2812b': ['pixels', 'brightness', 'count'],
  'wokwi-ws2821b': ['pixels', 'brightness', 'count'],
  'wokwi-mpu6050': ['ax', 'ay', 'az', 'gx', 'gy', 'gz', 'temp'],
  'wokwi-ds1307': ['running', 'time'],
  'wokwi-bmp180': ['temp', 'pressure', 'altitude'],
  'wokwi-dht22': ['temperature', 'humidity', 'lastReadMs', 'error'],
  'wokwi-max30102': ['ir', 'red', 'temp', 'active'],
  'wokwi-hc-sr04': ['distance', 'echoTimeMs'],
  'wokwi-ultrasonic-distance-sensor': ['distance', 'echoTimeMs'],
  'wokwi-pir-motion-sensor': ['motion', 'triggerCount'],
  'wokwi-photoresistor-sensor': ['lux', 'resistance', 'voltage'],
  'wokwi-photodiode': ['light'],
  'wokwi-ldr-module': ['light', 'threshold', 'dOut'],
  'wokwi-soil-moisture-sensor': ['moisture'],
  'wokwi-ntc-temperature-sensor': ['temperature', 'resistance', 'voltage'],
  'wokwi-ky-040': ['rot', 'sw'],
  'wokwi-membrane-keypad': ['pressedKey', 'rows', 'cols'],
  'wokwi-analog-joystick': ['x', 'y', 'pressed'],
  'wokwi-dip-switch-8': ['switches', 'values'],
  'wokwi-sd-card': ['cardInserted', 'status'],
  'wokwi-74hc595': ['latch', 'clock', 'data', 'oe', 'pins', 'r', 'g', 'b'],
  'wokwi-cd74hc4067': ['activeChannel'],
  'wokwi-logic-analyzer': ['active'],
  'wokwi-relay': ['active'],
  'wokwi-battery': ['voltage', 'capacity'],
  'wokwi-tp4056': ['charging', 'charged'],
  'wokwi-power-supply': ['voltage', 'current'],
  'wokwi-arduino-uno': ['leds', 'deepSiliconRegisters', 'deepSiliconSRAM', 'deepSiliconTimers', 'deepSiliconPower', 'deepSiliconInterrupts'],
  'wokwi-arduino-mega': ['leds', 'deepSiliconRegisters', 'deepSiliconSRAM', 'deepSiliconTimers', 'deepSiliconPower', 'deepSiliconInterrupts'],
  'wokwi-arduino-nano': ['leds', 'deepSiliconRegisters', 'deepSiliconSRAM', 'deepSiliconTimers', 'deepSiliconPower', 'deepSiliconInterrupts'],
  'wokwi-pi-pico': ['led', 'deepSiliconRegisters', 'deepSiliconSRAM', 'deepSiliconTimers', 'deepSiliconPower', 'deepSiliconInterrupts'],
  'wokwi-pi-pico-w': ['led', 'deepSiliconRegisters', 'deepSiliconSRAM', 'deepSiliconTimers', 'deepSiliconPower', 'deepSiliconInterrupts'],
  'wokwi-attiny85': ['pins', 'deepSiliconRegisters', 'deepSiliconSRAM', 'deepSiliconTimers', 'deepSiliconPower', 'deepSiliconInterrupts'],
  'wokwi-ds18b20': ['temperature', 'powered', 'resolution'],
  'wokwi-ir-receiver': ['protocol', 'lastCode', 'demodulatedSignal', 'powered'],
  'wokwi-mfrc522': ['powered', 'cardPresent', 'cardUID'],
  'openhw-simulation-monitor': [
    'simulationSpeed', 'timeDriftMs', 'executionJitterMs', 'frameSkips', 'workerBufferLatency',
    'workerCpuLoadPercentage', 'telemetrySerializationTimeMs', 'telemetryPayloadBytes',
    'canvasFps', 'uiMainThreadBlockedTimeMs', 'workerMessageQueueLagMs'
  ],
};

export function getTelemetryParamsForComponent(compType) {
  const safeCompType = String(compType || '').toLowerCase();
  if (safeCompType === 'openhw-simulation-monitor') {
    return COMPONENT_TELEMETRY_PARAMS[compType];
  }

  const baseParams = COMPONENT_TELEMETRY_PARAMS[compType] || ['illuminated', 'voltageDrop', 'current', 'brightness', 'color', 'glow', 'value', 'pressed', 'angle'];
  
  // Every component gets basic pin state tracking
  const universalParams = ['pins', 'pinToggles'];

  // Categorize components to prevent modal clutter
  const isBoard = safeCompType.includes('arduino') || safeCompType.includes('pico') || safeCompType.includes('attiny');
  const isI2C = safeCompType.includes('ssd1306') || safeCompType.includes('lcd1602-i2c') || safeCompType.includes('lcd2004-i2c') || safeCompType.includes('mpu6050') || safeCompType.includes('ds1307') || safeCompType.includes('bmp180') || safeCompType.includes('max30102');
  const isSPI = safeCompType.includes('max7219') || safeCompType.includes('ili9341') || safeCompType.includes('nokia-5110') || safeCompType.includes('sd-card');
  const isOneWire = safeCompType.includes('dht22');
  const isAnalog = safeCompType.includes('potentiometer') || safeCompType.includes('photoresistor') || safeCompType.includes('thermistor') || safeCompType.includes('joystick') || safeCompType.includes('soil') || safeCompType.includes('sensor');
  const isPWM = safeCompType.includes('led') || safeCompType.includes('servo') || safeCompType.includes('buzzer') || safeCompType.includes('motor');

  if (isBoard) {
    universalParams.push('analogVoltages', 'i2cTraffic', 'spiTraffic', 'serialBytes', 'pwmTraffic', 'oneWireTraffic', 'pioTraffic', 'i2sTraffic');
  } else {
    if (isI2C) universalParams.push('i2cTraffic');
    if (isSPI) universalParams.push('spiTraffic');
    if (isOneWire) universalParams.push('oneWireTraffic');
    if (isAnalog) universalParams.push('analogVoltages');
    if (isPWM) universalParams.push('pwmTraffic');
  }

  return Array.from(new Set([...baseParams, ...universalParams]));
}
