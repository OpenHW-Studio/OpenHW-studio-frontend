import { BaseComponent } from '@openhw/emulator';
import { LEDLogic } from '@openhw/emulator/src/components/openhw-led/logic';
import { UnoLogic } from '@openhw/emulator/src/components/openhw-arduino-uno/logic';
import { Esp32Logic } from '@openhw/emulator/src/components/ESP32/logic';
import { Esp32CamLogic } from '@openhw/emulator/src/components/openhw-esp32-cam/logic';
import { HCSR04Logic } from '@openhw/emulator/src/components/openhw-hc-sr04/logic';
import { PicoLogic } from '../pico-logic';
import { PicoWLogic } from '@openhw/emulator/src/components/openhw-pico-w/logic';
import { ResistorLogic } from '@openhw/emulator/src/components/openhw-resistor/logic';
import { PhotoresistorLogic } from '@openhw/emulator/src/components/openhw-photoresistor/logic';
import { PushbuttonLogic } from '@openhw/emulator/src/components/openhw-pushbutton/logic';
import { PowerSupplyLogic } from '@openhw/emulator/src/components/openhw-power-supply/logic';
import { BatteryLogic } from '@openhw/emulator/src/components/openhw-battery/logic';
import { NeopixelLogic } from '@openhw/emulator/src/components/openhw-neopixel-matrix/logic';
import { BuzzerLogic } from '@openhw/emulator/src/components/openhw-buzzer/logic';
import { MotorLogic } from '@openhw/emulator/src/components/openhw-motor/logic';
import { ServoLogic } from '@openhw/emulator/src/components/openhw-servo/logic';
import { MotorDriverLogic } from '@openhw/emulator/src/components/openhw-motor-driver/logic';
import { SlidePotLogic } from '@openhw/emulator/src/components/openhw-slide-potentiometer/logic';
import { PotentiometerLogic } from '@openhw/emulator/src/components/openhw-potentiometer/logic';
import { HC595Logic as ShiftRegisterLogic } from '@openhw/emulator/src/components/openhw-74hc595/logic';
import { JoystickLogic } from '@openhw/emulator/src/components/openhw-analog-joystick/logic';
import { AndGateLogic } from '@openhw/emulator/src/components/logic-and-gate/logic';
import { OrGateLogic } from '@openhw/emulator/src/components/logic-or-gate/logic';
import { NotGateLogic } from '@openhw/emulator/src/components/logic-not-gate/logic';
import { NandGateLogic } from '@openhw/emulator/src/components/logic-nand-gate/logic';
import { NorGateLogic } from '@openhw/emulator/src/components/logic-nor-gate/logic';
import { XorGateLogic } from '@openhw/emulator/src/components/logic-xor-gate/logic';
import { XnorGateLogic } from '@openhw/emulator/src/components/logic-xnor-gate/logic';
import { LogicIC74xxLogic } from '@openhw/emulator/src/components/logic-ic-74xx/logic';
import { Mux2to1Logic } from '@openhw/emulator/src/components/logic-mux-2to1/logic';
import { DFlipFlopLogic } from '@openhw/emulator/src/components/logic-d-flipflop/logic';
import { DFlipFlopRLogic } from '@openhw/emulator/src/components/logic-d-flipflop-r/logic';
import { DFlipFlopDsrLogic } from '@openhw/emulator/src/components/logic-d-flipflop-dsr/logic';
import { ClockGeneratorLogic } from '@openhw/emulator/src/components/logic-clock-generator/logic';
import { WokwiTM1637Logic } from '@openhw/emulator/src/components/openhw-tm1637-7segment/logic';
import { RGBLEDLogic } from '@openhw/emulator/src/components/openhw-rgb-led/logic';
import { RotaryEncoderLogic } from '@openhw/emulator/src/components/openhw-rotary-encoder/logic';
import { Nokia5110Logic } from '@openhw/emulator/src/components/openhw-nokia-5110/logic';
import { L293DLogic } from '@openhw/emulator/src/components/openhw-l293d/logic';
import { Lcd2004I2CLogic } from '@openhw/emulator/src/components/openhw-lcd2004-i2c/logic';
// import { Lcd1602Logic } from '@openhw/emulator/src/components/openhw-lcd1602/logic';
import { SSD1306Logic } from '@openhw/emulator/src/components/openhw-ssd1306-oled/logic';
import { PCA9685Logic } from '@openhw/emulator/src/components/openhw-pca9685/logic';
import { MAX30102Logic } from '@openhw/emulator/src/components/max30102/logic';
import { DHT22Logic } from '@openhw/emulator/src/components/DHT-22/logic';
import { GasSensorLogic } from '@openhw/emulator/src/components/MQ2-gas-sensor/logic';
import { PIRLogic } from '@openhw/emulator/src/components/PIR-Motion-Sensor/logic';
import { RaindropModuleLogic } from '@openhw/emulator/src/components/Raindrop-module/logic';
import { RaindropPadLogic } from '@openhw/emulator/src/components/Raindrop-pad/logic';
import { LdrModuleLogic } from '@openhw/emulator/src/components/openhw-ldr-module/logic';
import { SoilMoistureSensorLogic } from '@openhw/emulator/src/components/openhw-soil-moisture-sensor/logic';
import { PhotodiodeLogic } from '@openhw/emulator/src/components/openhw-photodiode/logic';
import { DiodeLogic } from '@openhw/emulator/src/components/openhw-diode/logic';
import { NPNTransistorLogic } from '@openhw/emulator/src/components/openhw-npn-transistor/logic';
import { MAX7219Logic } from '@openhw/emulator/src/components/openhw-max7219/logic';
import { A4988Logic } from '@openhw/emulator/src/components/openhw-a4988/logic';
import { StepperMotorLogic } from '@openhw/emulator/src/components/openhw-stepper-motor/logic';
import { Wokwi7SegmentLogic } from '@openhw/emulator/src/components/openhw-7segment/logic';
import { ILI9341Logic } from '@openhw/emulator/src/components/openhw-ili9341/logic';
import { Ks2eLogic } from '@openhw/emulator/src/components/openhw-ks2e-m-dc5/logic';
import { RelayModuleLogic } from '@openhw/emulator/src/components/openhw-relay-module/logic';

import { LogicAnalyzerLogic } from '@openhw/emulator/src/components/openhw-logic-analyzer/logic';
import { MegaLogic } from '@openhw/emulator/src/components/openhw-arduino-mega/logic';
import { DS18B20Logic } from '@openhw/emulator/src/components/openhw-ds18b20/logic';
import { IRReceiverLogic } from '@openhw/emulator/src/components/openhw-ir-receiver/logic';
import { MFRC522Logic } from '@openhw/emulator/src/components/openhw-mfrc522/logic';
import { SlideSwitchLogic } from '@openhw/emulator/src/components/openhw-slide-switch/logic';
import { PhotoresistorLogic } from '@openhw/emulator/src/components/openhw-photoresistor/logic';
import { NtcLogic } from '@openhw/emulator/src/components/openhw-ntc-temperature-sensor/logic';

import { PICO_BOARD_PINS, UNO_ANALOG_PINS, UNO_BOARD_PINS, UNO_DIGITAL_PINS } from '../board-profiles';


import { KeypadLogic } from '../protocol-handlers/keypad';
import { SDCardLogic } from '../protocol-handlers/sd-card';
import { SimulationMonitorLogic } from '../protocol-handlers/simulation-monitor';

// Provide fallback protocols since base protocols are now integrated directly into BaseComponent
const I2CProtocol = BaseComponent;
const SPIProtocol = BaseComponent;
const PWMProtocol = BaseComponent;
const DigitalProtocol = BaseComponent;
const AnalogProtocol = BaseComponent;
const UARTProtocol = BaseComponent;
const OneWireProtocol = BaseComponent;
const I2SProtocol = BaseComponent;

export const LOGIC_REGISTRY: Record<string, any> = {
    'wokwi-led': LEDLogic,
    'openhw-led': LEDLogic,
    'wokwi-arduino-uno': UnoLogic,
    'openhw-arduino-uno': UnoLogic,
    'openhw-esp32': Esp32Logic,
    'openhw-esp32-cam': Esp32CamLogic,
    'wokwi-esp32-cam': Esp32CamLogic,
    'esp32-cam': Esp32CamLogic,
    'wokwi-raspberry-pi-pico': PicoLogic,
    'openhw-raspberry-pi-pico': PicoLogic,
    'wokwi-raspberry-pi-pico-w': PicoWLogic,
    'openhw-raspberry-pi-pico-w': PicoWLogic,
    'wokwi-resistor': ResistorLogic,
    'openhw-resistor': ResistorLogic,
    'wokwi-slide-switch': SlideSwitchLogic,
    'openhw-slide-switch': SlideSwitchLogic,
    'wokwi-pushbutton': PushbuttonLogic,
    'openhw-pushbutton': PushbuttonLogic,
    'wokwi-power-supply': PowerSupplyLogic,
    'openhw-power-supply': PowerSupplyLogic,
    'wokwi-battery': BatteryLogic,
    'openhw-battery': BatteryLogic,
    'wokwi-neopixel-matrix': NeopixelLogic,
    'openhw-neopixel-matrix': NeopixelLogic,
    'wokwi-ws2812b': NeopixelLogic,
    'openhw-ws2812b': NeopixelLogic,
    'wokwi-ws2821b': NeopixelLogic,
    'openhw-ws2821b': NeopixelLogic,
    'wokwi-buzzer': BuzzerLogic,
    'openhw-buzzer': BuzzerLogic,
    'wokwi-motor': MotorLogic,
    'openhw-motor': MotorLogic,
    'wokwi-servo': ServoLogic,
    'openhw-servo': ServoLogic,
    'wokwi-motor-driver': MotorDriverLogic,
    'openhw-motor-driver': MotorDriverLogic,
    'wokwi-slide-potentiometer': SlidePotLogic,
    'openhw-slide-potentiometer': SlidePotLogic,
    'wokwi-potentiometer': PotentiometerLogic,
    'openhw-potentiometer': PotentiometerLogic,
    'wokwi-lcd2004-i2c': Lcd2004I2CLogic,
    'openhw-lcd2004-i2c': Lcd2004I2CLogic,
    // 'wokwi-lcd1602': Lcd1602Logic,
    // 'openhw-lcd1602': Lcd1602Logic,
    'wokwi-lcd1602-i2c': Lcd2004I2CLogic,
    'openhw-lcd1602-i2c': Lcd2004I2CLogic,
    'wokwi-ssd1306-oled': SSD1306Logic,
    'openhw-ssd1306-oled': SSD1306Logic,
    max30102: MAX30102Logic,
    'wokwi-max7219': MAX7219Logic,
    'openhw-max7219': MAX7219Logic,
    'wokwi-ldr-module': LdrModuleLogic,
    'openhw-ldr-module': LdrModuleLogic,
    'wokwi-7segment': BaseComponent,
    'openhw-7segment': Wokwi7SegmentLogic,
    'wokwi-ili9341': ILI9341Logic,
    'openhw-ili9341': ILI9341Logic,
    'wokwi-sd-card': SDCardLogic,
    'openhw-sd-card': SDCardLogic,
    'shift_register': ShiftRegisterLogic,
    'wokwi-membrane-keypad': KeypadLogic,
    'openhw-membrane-keypad': KeypadLogic,
    'wokwi-analog-joystick': JoystickLogic,
    'openhw-analog-joystick': JoystickLogic,
    'openhw-rotary-encoder': RotaryEncoderLogic,
    'wokwi-rotary-encoder': RotaryEncoderLogic,
    'logic-and-gate': AndGateLogic,
    'logic-or-gate': OrGateLogic,
    'logic-not-gate': NotGateLogic,
    'logic-nand-gate': NandGateLogic,
    'logic-nor-gate': NorGateLogic,
    'logic-xor-gate': XorGateLogic,
    'logic-xnor-gate': XnorGateLogic,
    'logic-ic-74xx': LogicIC74xxLogic,
    'logic-mux-2to1': Mux2to1Logic,
    'logic-d-flipflop': DFlipFlopLogic,
    'logic-d-flipflop-r': DFlipFlopRLogic,
    'logic-d-flipflop-dsr': DFlipFlopDsrLogic,
    'logic-clock-generator': ClockGeneratorLogic,
    'wokwi-tm1637-7segment': WokwiTM1637Logic,
    'openhw-tm1637-7segment': WokwiTM1637Logic,
    'wokwi-rgb-led': RGBLEDLogic,
    'openhw-rgb-led': RGBLEDLogic,
    'wokwi-nokia-5110': Nokia5110Logic,
    'openhw-nokia-5110': Nokia5110Logic,
    'wokwi-l293d': L293DLogic,
    'openhw-l293d': L293DLogic,
    'wokwi-arduino-nano': UnoLogic,
    'openhw-arduino-nano': UnoLogic,
    'wokwi-pca9685': PCA9685Logic,
    'openhw-pca9685': PCA9685Logic,
    'wokwi-pca9865': PCA9685Logic,
    'openhw-pca9865': PCA9685Logic,
    'wokwi-soil-moisture-sensor': SoilMoistureSensorLogic,
    'openhw-soil-moisture-sensor': SoilMoistureSensorLogic,
    'wokwi-photodiode': PhotodiodeLogic,
    'openhw-photodiode': PhotodiodeLogic,
    'wokwi-diode': DiodeLogic,
    'openhw-diode': DiodeLogic,
    'wokwi-npn-transistor': NPNTransistorLogic,
    'openhw-npn-transistor': NPNTransistorLogic,
    'wokwi-a4988': A4988Logic,
    'openhw-a4988': A4988Logic,
    'wokwi-cd74hc4067': BaseComponent,
    'openhw-cd74hc4067': BaseComponent,
    'wokwi-logic-analyzer': SimulationMonitorLogic,
    'openhw-logic-analyzer': SimulationMonitorLogic,
    'openhw-ks2e-m-dc5': Ks2eLogic,

    // I2S Audio Components
    'openhw-pcm5102': I2SProtocol,
    'openhw-max98357': I2SProtocol,
    'openhw-inmp441': I2SProtocol,
    'openhw-sph0645': I2SProtocol,

    // Sensors — custom components
    'DHT-22': DHT22Logic,
    'openhw-dht22': DHT22Logic,
    'MQ-2 Gas Sensor': GasSensorLogic,
    'openhw-mq2-gas-sensor': GasSensorLogic,
    'wokwi-pir-motion-sensor': PIRLogic,
    'openhw-pir-motion-sensor': PIRLogic,
    'wokwi-raindrop-module': RaindropModuleLogic,
    'openhw-raindrop-module': RaindropModuleLogic,
    'wokwi-raindrop-pad': RaindropPadLogic,
    'openhw-raindrop-pad': RaindropPadLogic,

    'wokwi-breadboard': BaseComponent,
    'openhw-breadboard': BaseComponent,
    'wokwi-breadboard-half': BaseComponent,
    'openhw-breadboard-half': BaseComponent,
    'wokwi-bmp180': BaseComponent,
    'openhw-bmp180': BaseComponent,
    'wokwi-bmp180-breakout': BaseComponent,
    'openhw-bmp180-breakout': BaseComponent,
    'wokwi-ds1307-rtc': BaseComponent,
    'openhw-ds1307-rtc': BaseComponent,
    'wokwi-hc-sr04': HCSR04Logic,
    'openhw-hc-sr04': HCSR04Logic,
    'wokwi-mpu6050': BaseComponent,
    'openhw-mpu6050': BaseComponent,
    'wokwi-nlsf595': BaseComponent,
    'openhw-nlsf595': BaseComponent,
    'wokwi-relay-module': RelayModuleLogic,
    'openhw-relay-module': RelayModuleLogic,
    'wokwi-stepper-motor': StepperMotorLogic,
    'openhw-stepper-motor': StepperMotorLogic,
    'wokwi-arduino-mega': MegaLogic,
    'openhw-arduino-mega': MegaLogic,
    'wokwi-attiny85': BaseComponent,
    'openhw-attiny85': BaseComponent,
    'openhw-pico': PicoLogic,
    'openhw-pico-w': PicoWLogic,
    'wokwi-photoresistor': PhotoresistorLogic,
    'openhw-photoresistor': PhotoresistorLogic,
    'openhw-ntc-thermistor': BaseComponent,
    'openhw-ntc-temperature-sensor': NtcLogic,
    'openhw-charger': BaseComponent,
    'openhw-breadboard-mini': BaseComponent,
    'openhw-neopixel-ring': NeopixelLogic,
    'openhw-arduino-sensor-shield': BaseComponent,
    'openhw-simulation-monitor': SimulationMonitorLogic,
    'wokwi-ds18b20': DS18B20Logic,
    'openhw-ds18b20': DS18B20Logic,
    'wokwi-ir-receiver': IRReceiverLogic,
    'openhw-ir-receiver': IRReceiverLogic,
    'wokwi-mfrc522': MFRC522Logic,
    'openhw-mfrc522': MFRC522Logic,
};

// Per-type pin lists so every component's pins are registered correctly.
// §6: manifests are the source of truth. This table is GENERATED from
// emulator manifests (see scripts/gen-component-pins.mjs — run it after any
// manifest pin change and paste the output below). Entries below the
// "generated" marker are build output; hand edits will be overwritten.
// Covered ids: every openhw-*/wokwi-* type with manifest pins; the 4 pin-less
// types (openhw-image/ir-remote/text/wifi-ap) resolve to [] (not undefined)
// so callers can distinguish "no pins" from "unknown type".
export const COMPONENT_PINS: Record<string, {
    'logic-and-gate': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'OUT' }],
    'logic-buffer-gate': [{ id: 'IN' }, { id: 'OUT' }],
    'logic-clock-generator': [{ id: 'OUT' }],
    'logic-d-flipflop': [{ id: 'D' }, { id: 'CLK' }, { id: 'Q' }, { id: 'Qbar' }],
    'logic-d-flipflop-dsr': [{ id: 'D' }, { id: 'CLK' }, { id: 'S' }, { id: 'R' }, { id: 'Q' }, { id: 'Qbar' }],
    'logic-d-flipflop-r': [{ id: 'D' }, { id: 'CLK' }, { id: 'R' }, { id: 'Q' }, { id: 'Qbar' }],
    'logic-ic-74xx': [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }, { id: 'p5' }, { id: 'p6' }, { id: 'p7' }, { id: 'p8' }, { id: 'p9' }, { id: 'p10' }, { id: 'p11' }, { id: 'p12' }, { id: 'p13' }, { id: 'p14' }],
    'logic-mux-2to1': [{ id: 'D0' }, { id: 'D1' }, { id: 'SEL' }, { id: 'OUT' }],
    'logic-nand-gate': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'OUT' }],
    'logic-nor-gate': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'OUT' }],
    'logic-not-gate': [{ id: 'IN' }, { id: 'OUT' }],
    'logic-or-gate': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'OUT' }],
    'logic-xnor-gate': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'OUT' }],
    'logic-xor-gate': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'OUT' }],
    'max30102': [{ id: 'VIN' }, { id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'INT' }, { id: 'IRD' }, { id: 'RD' }, { id: 'NC' }],
    'openhw-5w-speaker': [{ id: 'IN+' }, { id: 'IN-' }],
    'openhw-74hc165': [{ id: 'vcc' }, { id: 'ce' }, { id: 'd3' }, { id: 'd2' }, { id: 'd1' }, { id: 'd0' }, { id: 'ds' }, { id: 'q7' }, { id: 'pl' }, { id: 'cp' }, { id: 'd4' }, { id: 'd5' }, { id: 'd6' }, { id: 'd7' }, { id: 'q7n' }, { id: 'gnd' }],
    'openhw-74hc595': [{ id: 'vcc' }, { id: 'q0' }, { id: 'ser' }, { id: 'oe' }, { id: 'rclk' }, { id: 'srclk' }, { id: 'srclr' }, { id: 'q7s' }, { id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }, { id: 'q6' }, { id: 'q7' }, { id: 'gnd' }],
    'openhw-7segment': [{ id: 'G' }, { id: 'F' }, { id: 'COM.2' }, { id: 'A' }, { id: 'B' }, { id: 'E' }, { id: 'D' }, { id: 'COM.1' }, { id: 'C' }, { id: 'DP' }],
    'openhw-a4988': [{ id: 'ENABLE' }, { id: 'MS1' }, { id: 'MS2' }, { id: 'MS3' }, { id: 'RESET' }, { id: 'SLEEP' }, { id: 'STEP' }, { id: 'DIR' }, { id: 'VMOT' }, { id: 'GND_MOT' }, { id: '2B' }, { id: '2A' }, { id: '1A' }, { id: '1B' }, { id: 'VDD' }, { id: 'GND_LOGIC' }],
    'openhw-adxl345': [{ id: 'GND' }, { id: 'VCC' }, { id: 'CS' }, { id: 'INT1' }, { id: 'INT2' }, { id: 'SDO' }, { id: 'SDA' }, { id: 'SCL' }],
    'openhw-analog-joystick': [{ id: 'VCC' }, { id: 'VERT' }, { id: 'HORZ' }, { id: 'SEL' }, { id: 'GND' }],
    'openhw-arduino-mega': [{ id: 'SCL' }, { id: 'SDA' }, { id: 'AREF' }, { id: 'GND.1' }, { id: '13' }, { id: '12' }, { id: '11' }, { id: '10' }, { id: '9' }, { id: '8' }, { id: '7' }, { id: '6' }, { id: '5' }, { id: '4' }, { id: '3' }, { id: '2' }, { id: '1' }, { id: '0' }, { id: '14' }, { id: '15' }, { id: '16' }, { id: '17' }, { id: '18' }, { id: '19' }, { id: '20' }, { id: '21' }, { id: '5V.1' }, { id: '5V.2' }, { id: '22' }, { id: '23' }, { id: '24' }, { id: '25' }, { id: '26' }, { id: '27' }, { id: '28' }, { id: '29' }, { id: '30' }, { id: '31' }, { id: '32' }, { id: '33' }, { id: '34' }, { id: '35' }, { id: '36' }, { id: '37' }, { id: '38' }, { id: '39' }, { id: '40' }, { id: '41' }, { id: '42' }, { id: '43' }, { id: '44' }, { id: '45' }, { id: '46' }, { id: '47' }, { id: '48' }, { id: '49' }, { id: '50' }, { id: '51' }, { id: '52' }, { id: '53' }, { id: 'GND.4' }, { id: 'GND.5' }, { id: 'IOREF' }, { id: 'RESET' }, { id: '3.3V' }, { id: '5V' }, { id: 'GND.2' }, { id: 'GND.3' }, { id: 'VIN' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: 'A8' }, { id: 'A9' }, { id: 'A10' }, { id: 'A11' }, { id: 'A12' }, { id: 'A13' }, { id: 'A14' }, { id: 'A15' }],
    'openhw-arduino-nano': [{ id: '12' }, { id: '11' }, { id: '10' }, { id: '9' }, { id: '8' }, { id: '7' }, { id: '6' }, { id: '5' }, { id: '4' }, { id: '3' }, { id: '2' }, { id: 'GND.2' }, { id: 'RST.2' }, { id: 'RX' }, { id: 'TX' }, { id: 'PE1' }, { id: '13' }, { id: '3V3' }, { id: 'AREF' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: '5V' }, { id: 'RST.1' }, { id: 'GND.1' }, { id: 'VIN' }, { id: 'PE0' }],
    'openhw-arduino-sensor-shield': [{ id: 'AREF_IN' }, { id: 'GND_TOP_IN' }, { id: 'D13_IN' }, { id: 'D12_IN' }, { id: 'D11_IN' }, { id: 'D10_IN' }, { id: 'D9_IN' }, { id: 'D8_IN' }, { id: 'D7_IN' }, { id: 'D6_IN' }, { id: 'D5_IN' }, { id: 'D4_IN' }, { id: 'D3_IN' }, { id: 'D2_IN' }, { id: 'D1_IN' }, { id: 'D0_IN' }, { id: 'RST_IN' }, { id: '3V3_IN' }, { id: '5V_IN' }, { id: 'GND1_IN' }, { id: 'GND2_IN' }, { id: 'VIN_IN' }, { id: 'A0_IN' }, { id: 'A1_IN' }, { id: 'A2_IN' }, { id: 'A3_IN' }, { id: 'A4_IN' }, { id: 'A5_IN' }, { id: 'S_AREF' }, { id: 'V_AREF' }, { id: 'G_AREF' }, { id: 'S_GND' }, { id: 'V_GND' }, { id: 'G_GND' }, { id: 'S_13' }, { id: 'V_13' }, { id: 'G_13' }, { id: 'S_12' }, { id: 'V_12' }, { id: 'G_12' }, { id: 'S_11' }, { id: 'V_11' }, { id: 'G_11' }, { id: 'S_10' }, { id: 'V_10' }, { id: 'G_10' }, { id: 'S_9' }, { id: 'V_9' }, { id: 'G_9' }, { id: 'S_8' }, { id: 'V_8' }, { id: 'G_8' }, { id: 'S_7' }, { id: 'V_7' }, { id: 'G_7' }, { id: 'S_6' }, { id: 'V_6' }, { id: 'G_6' }, { id: 'S_5' }, { id: 'V_5' }, { id: 'G_5' }, { id: 'S_4' }, { id: 'V_4' }, { id: 'G_4' }, { id: 'S_3' }, { id: 'V_3' }, { id: 'G_3' }, { id: 'S_2' }, { id: 'V_2' }, { id: 'G_2' }, { id: 'S_1' }, { id: 'V_1' }, { id: 'G_1' }, { id: 'S_0' }, { id: 'V_0' }, { id: 'G_0' }, { id: 'S_A0' }, { id: 'V_A0' }, { id: 'G_A0' }, { id: 'S_A1' }, { id: 'V_A1' }, { id: 'G_A1' }, { id: 'S_A2' }, { id: 'V_A2' }, { id: 'G_A2' }, { id: 'S_A3' }, { id: 'V_A3' }, { id: 'G_A3' }, { id: 'S_A4' }, { id: 'V_A4' }, { id: 'G_A4' }, { id: 'S_A5' }, { id: 'V_A5' }, { id: 'G_A5' }],
    'openhw-arduino-uno': [{ id: 'gnd_3' }, { id: '13' }, { id: '12' }, { id: '11' }, { id: '10' }, { id: '9' }, { id: '8' }, { id: '7' }, { id: '6' }, { id: '5' }, { id: '4' }, { id: '3' }, { id: '2' }, { id: '1' }, { id: '0' }, { id: 'vin' }, { id: 'gnd_1' }, { id: 'gnd_2' }, { id: '5V' }, { id: '3v3' }, { id: 'rst' }, { id: 'ioref' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }],
    'openhw-attiny85': [{ id: 'P5' }, { id: 'P4' }, { id: 'P3' }, { id: 'P2' }, { id: 'P1' }, { id: 'P0' }, { id: '5V' }, { id: 'GND' }, { id: 'VIN' }],
    'openhw-battery': [{ id: 'VCC' }, { id: 'GND' }],
    'openhw-biaxial-stepper': [{ id: 'A1-' }, { id: 'A1+' }, { id: 'B1+' }, { id: 'B1-' }, { id: 'A2-' }, { id: 'A2+' }, { id: 'B2+' }, { id: 'B2-' }],
    'openhw-bmp180-breakout': [{ id: 'VIN' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }],
    'openhw-breadboard': [{ id: 'top_gnd_1' }, { id: 'top_vcc_1' }, { id: 'top_gnd_2' }, { id: 'top_vcc_2' }, { id: 'top_gnd_3' }, { id: 'top_vcc_3' }, { id: 'top_gnd_4' }, { id: 'top_vcc_4' }, { id: 'top_gnd_5' }, { id: 'top_vcc_5' }, { id: 'top_gnd_6' }, { id: 'top_vcc_6' }, { id: 'top_gnd_7' }, { id: 'top_vcc_7' }, { id: 'top_gnd_8' }, { id: 'top_vcc_8' }, { id: 'top_gnd_9' }, { id: 'top_vcc_9' }, { id: 'top_gnd_10' }, { id: 'top_vcc_10' }, { id: 'top_gnd_11' }, { id: 'top_vcc_11' }, { id: 'top_gnd_12' }, { id: 'top_vcc_12' }, { id: 'top_gnd_13' }, { id: 'top_vcc_13' }, { id: 'top_gnd_14' }, { id: 'top_vcc_14' }, { id: 'top_gnd_15' }, { id: 'top_vcc_15' }, { id: 'top_gnd_16' }, { id: 'top_vcc_16' }, { id: 'top_gnd_17' }, { id: 'top_vcc_17' }, { id: 'top_gnd_18' }, { id: 'top_vcc_18' }, { id: 'top_gnd_19' }, { id: 'top_vcc_19' }, { id: 'top_gnd_20' }, { id: 'top_vcc_20' }, { id: 'top_gnd_21' }, { id: 'top_vcc_21' }, { id: 'top_gnd_22' }, { id: 'top_vcc_22' }, { id: 'top_gnd_23' }, { id: 'top_vcc_23' }, { id: 'top_gnd_24' }, { id: 'top_vcc_24' }, { id: 'top_gnd_25' }, { id: 'top_vcc_25' }, { id: 'top_gnd_26' }, { id: 'top_vcc_26' }, { id: 'top_gnd_27' }, { id: 'top_vcc_27' }, { id: 'top_gnd_28' }, { id: 'top_vcc_28' }, { id: 'top_gnd_29' }, { id: 'top_vcc_29' }, { id: 'top_gnd_30' }, { id: 'top_vcc_30' }, { id: 'top_gnd_31' }, { id: 'top_vcc_31' }, { id: 'top_gnd_32' }, { id: 'top_vcc_32' }, { id: 'top_gnd_33' }, { id: 'top_vcc_33' }, { id: 'top_gnd_34' }, { id: 'top_vcc_34' }, { id: 'top_gnd_35' }, { id: 'top_vcc_35' }, { id: 'top_gnd_36' }, { id: 'top_vcc_36' }, { id: 'top_gnd_37' }, { id: 'top_vcc_37' }, { id: 'top_gnd_38' }, { id: 'top_vcc_38' }, { id: 'top_gnd_39' }, { id: 'top_vcc_39' }, { id: 'top_gnd_40' }, { id: 'top_vcc_40' }, { id: 'top_gnd_41' }, { id: 'top_vcc_41' }, { id: 'top_gnd_42' }, { id: 'top_vcc_42' }, { id: 'top_gnd_43' }, { id: 'top_vcc_43' }, { id: 'top_gnd_44' }, { id: 'top_vcc_44' }, { id: 'top_gnd_45' }, { id: 'top_vcc_45' }, { id: 'top_gnd_46' }, { id: 'top_vcc_46' }, { id: 'top_gnd_47' }, { id: 'top_vcc_47' }, { id: 'top_gnd_48' }, { id: 'top_vcc_48' }, { id: 'top_gnd_49' }, { id: 'top_vcc_49' }, { id: 'top_gnd_50' }, { id: 'top_vcc_50' }, { id: '1e' }, { id: '1d' }, { id: '1c' }, { id: '1b' }, { id: '1a' }, { id: '1f' }, { id: '1g' }, { id: '1h' }, { id: '1i' }, { id: '1j' }, { id: '2e' }, { id: '2d' }, { id: '2c' }, { id: '2b' }, { id: '2a' }, { id: '2f' }, { id: '2g' }, { id: '2h' }, { id: '2i' }, { id: '2j' }, { id: '3e' }, { id: '3d' }, { id: '3c' }, { id: '3b' }, { id: '3a' }, { id: '3f' }, { id: '3g' }, { id: '3h' }, { id: '3i' }, { id: '3j' }, { id: '4e' }, { id: '4d' }, { id: '4c' }, { id: '4b' }, { id: '4a' }, { id: '4f' }, { id: '4g' }, { id: '4h' }, { id: '4i' }, { id: '4j' }, { id: '5e' }, { id: '5d' }, { id: '5c' }, { id: '5b' }, { id: '5a' }, { id: '5f' }, { id: '5g' }, { id: '5h' }, { id: '5i' }, { id: '5j' }, { id: '6e' }, { id: '6d' }, { id: '6c' }, { id: '6b' }, { id: '6a' }, { id: '6f' }, { id: '6g' }, { id: '6h' }, { id: '6i' }, { id: '6j' }, { id: '7e' }, { id: '7d' }, { id: '7c' }, { id: '7b' }, { id: '7a' }, { id: '7f' }, { id: '7g' }, { id: '7h' }, { id: '7i' }, { id: '7j' }, { id: '8e' }, { id: '8d' }, { id: '8c' }, { id: '8b' }, { id: '8a' }, { id: '8f' }, { id: '8g' }, { id: '8h' }, { id: '8i' }, { id: '8j' }, { id: '9e' }, { id: '9d' }, { id: '9c' }, { id: '9b' }, { id: '9a' }, { id: '9f' }, { id: '9g' }, { id: '9h' }, { id: '9i' }, { id: '9j' }, { id: '10e' }, { id: '10d' }, { id: '10c' }, { id: '10b' }, { id: '10a' }, { id: '10f' }, { id: '10g' }, { id: '10h' }, { id: '10i' }, { id: '10j' }, { id: '11e' }, { id: '11d' }, { id: '11c' }, { id: '11b' }, { id: '11a' }, { id: '11f' }, { id: '11g' }, { id: '11h' }, { id: '11i' }, { id: '11j' }, { id: '12e' }, { id: '12d' }, { id: '12c' }, { id: '12b' }, { id: '12a' }, { id: '12f' }, { id: '12g' }, { id: '12h' }, { id: '12i' }, { id: '12j' }, { id: '13e' }, { id: '13d' }, { id: '13c' }, { id: '13b' }, { id: '13a' }, { id: '13f' }, { id: '13g' }, { id: '13h' }, { id: '13i' }, { id: '13j' }, { id: '14e' }, { id: '14d' }, { id: '14c' }, { id: '14b' }, { id: '14a' }, { id: '14f' }, { id: '14g' }, { id: '14h' }, { id: '14i' }, { id: '14j' }, { id: '15e' }, { id: '15d' }, { id: '15c' }, { id: '15b' }, { id: '15a' }, { id: '15f' }, { id: '15g' }, { id: '15h' }, { id: '15i' }, { id: '15j' }, { id: '16e' }, { id: '16d' }, { id: '16c' }, { id: '16b' }, { id: '16a' }, { id: '16f' }, { id: '16g' }, { id: '16h' }, { id: '16i' }, { id: '16j' }, { id: '17e' }, { id: '17d' }, { id: '17c' }, { id: '17b' }, { id: '17a' }, { id: '17f' }, { id: '17g' }, { id: '17h' }, { id: '17i' }, { id: '17j' }, { id: '18e' }, { id: '18d' }, { id: '18c' }, { id: '18b' }, { id: '18a' }, { id: '18f' }, { id: '18g' }, { id: '18h' }, { id: '18i' }, { id: '18j' }, { id: '19e' }, { id: '19d' }, { id: '19c' }, { id: '19b' }, { id: '19a' }, { id: '19f' }, { id: '19g' }, { id: '19h' }, { id: '19i' }, { id: '19j' }, { id: '20e' }, { id: '20d' }, { id: '20c' }, { id: '20b' }, { id: '20a' }, { id: '20f' }, { id: '20g' }, { id: '20h' }, { id: '20i' }, { id: '20j' }, { id: '21e' }, { id: '21d' }, { id: '21c' }, { id: '21b' }, { id: '21a' }, { id: '21f' }, { id: '21g' }, { id: '21h' }, { id: '21i' }, { id: '21j' }, { id: '22e' }, { id: '22d' }, { id: '22c' }, { id: '22b' }, { id: '22a' }, { id: '22f' }, { id: '22g' }, { id: '22h' }, { id: '22i' }, { id: '22j' }, { id: '23e' }, { id: '23d' }, { id: '23c' }, { id: '23b' }, { id: '23a' }, { id: '23f' }, { id: '23g' }, { id: '23h' }, { id: '23i' }, { id: '23j' }, { id: '24e' }, { id: '24d' }, { id: '24c' }, { id: '24b' }, { id: '24a' }, { id: '24f' }, { id: '24g' }, { id: '24h' }, { id: '24i' }, { id: '24j' }, { id: '25e' }, { id: '25d' }, { id: '25c' }, { id: '25b' }, { id: '25a' }, { id: '25f' }, { id: '25g' }, { id: '25h' }, { id: '25i' }, { id: '25j' }, { id: '26e' }, { id: '26d' }, { id: '26c' }, { id: '26b' }, { id: '26a' }, { id: '26f' }, { id: '26g' }, { id: '26h' }, { id: '26i' }, { id: '26j' }, { id: '27e' }, { id: '27d' }, { id: '27c' }, { id: '27b' }, { id: '27a' }, { id: '27f' }, { id: '27g' }, { id: '27h' }, { id: '27i' }, { id: '27j' }, { id: '28e' }, { id: '28d' }, { id: '28c' }, { id: '28b' }, { id: '28a' }, { id: '28f' }, { id: '28g' }, { id: '28h' }, { id: '28i' }, { id: '28j' }, { id: '29e' }, { id: '29d' }, { id: '29c' }, { id: '29b' }, { id: '29a' }, { id: '29f' }, { id: '29g' }, { id: '29h' }, { id: '29i' }, { id: '29j' }, { id: '30e' }, { id: '30d' }, { id: '30c' }, { id: '30b' }, { id: '30a' }, { id: '30f' }, { id: '30g' }, { id: '30h' }, { id: '30i' }, { id: '30j' }, { id: '31e' }, { id: '31d' }, { id: '31c' }, { id: '31b' }, { id: '31a' }, { id: '31f' }, { id: '31g' }, { id: '31h' }, { id: '31i' }, { id: '31j' }, { id: '32e' }, { id: '32d' }, { id: '32c' }, { id: '32b' }, { id: '32a' }, { id: '32f' }, { id: '32g' }, { id: '32h' }, { id: '32i' }, { id: '32j' }, { id: '33e' }, { id: '33d' }, { id: '33c' }, { id: '33b' }, { id: '33a' }, { id: '33f' }, { id: '33g' }, { id: '33h' }, { id: '33i' }, { id: '33j' }, { id: '34e' }, { id: '34d' }, { id: '34c' }, { id: '34b' }, { id: '34a' }, { id: '34f' }, { id: '34g' }, { id: '34h' }, { id: '34i' }, { id: '34j' }, { id: '35e' }, { id: '35d' }, { id: '35c' }, { id: '35b' }, { id: '35a' }, { id: '35f' }, { id: '35g' }, { id: '35h' }, { id: '35i' }, { id: '35j' }, { id: '36e' }, { id: '36d' }, { id: '36c' }, { id: '36b' }, { id: '36a' }, { id: '36f' }, { id: '36g' }, { id: '36h' }, { id: '36i' }, { id: '36j' }, { id: '37e' }, { id: '37d' }, { id: '37c' }, { id: '37b' }, { id: '37a' }, { id: '37f' }, { id: '37g' }, { id: '37h' }, { id: '37i' }, { id: '37j' }, { id: '38e' }, { id: '38d' }, { id: '38c' }, { id: '38b' }, { id: '38a' }, { id: '38f' }, { id: '38g' }, { id: '38h' }, { id: '38i' }, { id: '38j' }, { id: '39e' }, { id: '39d' }, { id: '39c' }, { id: '39b' }, { id: '39a' }, { id: '39f' }, { id: '39g' }, { id: '39h' }, { id: '39i' }, { id: '39j' }, { id: '40e' }, { id: '40d' }, { id: '40c' }, { id: '40b' }, { id: '40a' }, { id: '40f' }, { id: '40g' }, { id: '40h' }, { id: '40i' }, { id: '40j' }, { id: '41e' }, { id: '41d' }, { id: '41c' }, { id: '41b' }, { id: '41a' }, { id: '41f' }, { id: '41g' }, { id: '41h' }, { id: '41i' }, { id: '41j' }, { id: '42e' }, { id: '42d' }, { id: '42c' }, { id: '42b' }, { id: '42a' }, { id: '42f' }, { id: '42g' }, { id: '42h' }, { id: '42i' }, { id: '42j' }, { id: '43e' }, { id: '43d' }, { id: '43c' }, { id: '43b' }, { id: '43a' }, { id: '43f' }, { id: '43g' }, { id: '43h' }, { id: '43i' }, { id: '43j' }, { id: '44e' }, { id: '44d' }, { id: '44c' }, { id: '44b' }, { id: '44a' }, { id: '44f' }, { id: '44g' }, { id: '44h' }, { id: '44i' }, { id: '44j' }, { id: '45e' }, { id: '45d' }, { id: '45c' }, { id: '45b' }, { id: '45a' }, { id: '45f' }, { id: '45g' }, { id: '45h' }, { id: '45i' }, { id: '45j' }, { id: '46e' }, { id: '46d' }, { id: '46c' }, { id: '46b' }, { id: '46a' }, { id: '46f' }, { id: '46g' }, { id: '46h' }, { id: '46i' }, { id: '46j' }, { id: '47e' }, { id: '47d' }, { id: '47c' }, { id: '47b' }, { id: '47a' }, { id: '47f' }, { id: '47g' }, { id: '47h' }, { id: '47i' }, { id: '47j' }, { id: '48e' }, { id: '48d' }, { id: '48c' }, { id: '48b' }, { id: '48a' }, { id: '48f' }, { id: '48g' }, { id: '48h' }, { id: '48i' }, { id: '48j' }, { id: '49e' }, { id: '49d' }, { id: '49c' }, { id: '49b' }, { id: '49a' }, { id: '49f' }, { id: '49g' }, { id: '49h' }, { id: '49i' }, { id: '49j' }, { id: '50e' }, { id: '50d' }, { id: '50c' }, { id: '50b' }, { id: '50a' }, { id: '50f' }, { id: '50g' }, { id: '50h' }, { id: '50i' }, { id: '50j' }, { id: '51e' }, { id: '51d' }, { id: '51c' }, { id: '51b' }, { id: '51a' }, { id: '51f' }, { id: '51g' }, { id: '51h' }, { id: '51i' }, { id: '51j' }, { id: '52e' }, { id: '52d' }, { id: '52c' }, { id: '52b' }, { id: '52a' }, { id: '52f' }, { id: '52g' }, { id: '52h' }, { id: '52i' }, { id: '52j' }, { id: '53e' }, { id: '53d' }, { id: '53c' }, { id: '53b' }, { id: '53a' }, { id: '53f' }, { id: '53g' }, { id: '53h' }, { id: '53i' }, { id: '53j' }, { id: '54e' }, { id: '54d' }, { id: '54c' }, { id: '54b' }, { id: '54a' }, { id: '54f' }, { id: '54g' }, { id: '54h' }, { id: '54i' }, { id: '54j' }, { id: '55e' }, { id: '55d' }, { id: '55c' }, { id: '55b' }, { id: '55a' }, { id: '55f' }, { id: '55g' }, { id: '55h' }, { id: '55i' }, { id: '55j' }, { id: '56e' }, { id: '56d' }, { id: '56c' }, { id: '56b' }, { id: '56a' }, { id: '56f' }, { id: '56g' }, { id: '56h' }, { id: '56i' }, { id: '56j' }, { id: '57e' }, { id: '57d' }, { id: '57c' }, { id: '57b' }, { id: '57a' }, { id: '57f' }, { id: '57g' }, { id: '57h' }, { id: '57i' }, { id: '57j' }, { id: '58e' }, { id: '58d' }, { id: '58c' }, { id: '58b' }, { id: '58a' }, { id: '58f' }, { id: '58g' }, { id: '58h' }, { id: '58i' }, { id: '58j' }, { id: '59e' }, { id: '59d' }, { id: '59c' }, { id: '59b' }, { id: '59a' }, { id: '59f' }, { id: '59g' }, { id: '59h' }, { id: '59i' }, { id: '59j' }, { id: '60e' }, { id: '60d' }, { id: '60c' }, { id: '60b' }, { id: '60a' }, { id: '60f' }, { id: '60g' }, { id: '60h' }, { id: '60i' }, { id: '60j' }, { id: '61e' }, { id: '61d' }, { id: '61c' }, { id: '61b' }, { id: '61a' }, { id: '61f' }, { id: '61g' }, { id: '61h' }, { id: '61i' }, { id: '61j' }, { id: '62e' }, { id: '62d' }, { id: '62c' }, { id: '62b' }, { id: '62a' }, { id: '62f' }, { id: '62g' }, { id: '62h' }, { id: '62i' }, { id: '62j' }, { id: '63e' }, { id: '63d' }, { id: '63c' }, { id: '63b' }, { id: '63a' }, { id: '63f' }, { id: '63g' }, { id: '63h' }, { id: '63i' }, { id: '63j' }, { id: 'bottom_vcc_1' }, { id: 'bottom_gnd_1' }, { id: 'bottom_vcc_2' }, { id: 'bottom_gnd_2' }, { id: 'bottom_vcc_3' }, { id: 'bottom_gnd_3' }, { id: 'bottom_vcc_4' }, { id: 'bottom_gnd_4' }, { id: 'bottom_vcc_5' }, { id: 'bottom_gnd_5' }, { id: 'bottom_vcc_6' }, { id: 'bottom_gnd_6' }, { id: 'bottom_vcc_7' }, { id: 'bottom_gnd_7' }, { id: 'bottom_vcc_8' }, { id: 'bottom_gnd_8' }, { id: 'bottom_vcc_9' }, { id: 'bottom_gnd_9' }, { id: 'bottom_vcc_10' }, { id: 'bottom_gnd_10' }, { id: 'bottom_vcc_11' }, { id: 'bottom_gnd_11' }, { id: 'bottom_vcc_12' }, { id: 'bottom_gnd_12' }, { id: 'bottom_vcc_13' }, { id: 'bottom_gnd_13' }, { id: 'bottom_vcc_14' }, { id: 'bottom_gnd_14' }, { id: 'bottom_vcc_15' }, { id: 'bottom_gnd_15' }, { id: 'bottom_vcc_16' }, { id: 'bottom_gnd_16' }, { id: 'bottom_vcc_17' }, { id: 'bottom_gnd_17' }, { id: 'bottom_vcc_18' }, { id: 'bottom_gnd_18' }, { id: 'bottom_vcc_19' }, { id: 'bottom_gnd_19' }, { id: 'bottom_vcc_20' }, { id: 'bottom_gnd_20' }, { id: 'bottom_vcc_21' }, { id: 'bottom_gnd_21' }, { id: 'bottom_vcc_22' }, { id: 'bottom_gnd_22' }, { id: 'bottom_vcc_23' }, { id: 'bottom_gnd_23' }, { id: 'bottom_vcc_24' }, { id: 'bottom_gnd_24' }, { id: 'bottom_vcc_25' }, { id: 'bottom_gnd_25' }, { id: 'bottom_vcc_26' }, { id: 'bottom_gnd_26' }, { id: 'bottom_vcc_27' }, { id: 'bottom_gnd_27' }, { id: 'bottom_vcc_28' }, { id: 'bottom_gnd_28' }, { id: 'bottom_vcc_29' }, { id: 'bottom_gnd_29' }, { id: 'bottom_vcc_30' }, { id: 'bottom_gnd_30' }, { id: 'bottom_vcc_31' }, { id: 'bottom_gnd_31' }, { id: 'bottom_vcc_32' }, { id: 'bottom_gnd_32' }, { id: 'bottom_vcc_33' }, { id: 'bottom_gnd_33' }, { id: 'bottom_vcc_34' }, { id: 'bottom_gnd_34' }, { id: 'bottom_vcc_35' }, { id: 'bottom_gnd_35' }, { id: 'bottom_vcc_36' }, { id: 'bottom_gnd_36' }, { id: 'bottom_vcc_37' }, { id: 'bottom_gnd_37' }, { id: 'bottom_vcc_38' }, { id: 'bottom_gnd_38' }, { id: 'bottom_vcc_39' }, { id: 'bottom_gnd_39' }, { id: 'bottom_vcc_40' }, { id: 'bottom_gnd_40' }, { id: 'bottom_vcc_41' }, { id: 'bottom_gnd_41' }, { id: 'bottom_vcc_42' }, { id: 'bottom_gnd_42' }, { id: 'bottom_vcc_43' }, { id: 'bottom_gnd_43' }, { id: 'bottom_vcc_44' }, { id: 'bottom_gnd_44' }, { id: 'bottom_vcc_45' }, { id: 'bottom_gnd_45' }, { id: 'bottom_vcc_46' }, { id: 'bottom_gnd_46' }, { id: 'bottom_vcc_47' }, { id: 'bottom_gnd_47' }, { id: 'bottom_vcc_48' }, { id: 'bottom_gnd_48' }, { id: 'bottom_vcc_49' }, { id: 'bottom_gnd_49' }, { id: 'bottom_vcc_50' }, { id: 'bottom_gnd_50' }],
    'openhw-breadboard-half': [{ id: 'top_gnd_1' }, { id: 'top_vcc_1' }, { id: 'top_gnd_2' }, { id: 'top_vcc_2' }, { id: 'top_gnd_3' }, { id: 'top_vcc_3' }, { id: 'top_gnd_4' }, { id: 'top_vcc_4' }, { id: 'top_gnd_5' }, { id: 'top_vcc_5' }, { id: 'top_gnd_6' }, { id: 'top_vcc_6' }, { id: 'top_gnd_7' }, { id: 'top_vcc_7' }, { id: 'top_gnd_8' }, { id: 'top_vcc_8' }, { id: 'top_gnd_9' }, { id: 'top_vcc_9' }, { id: 'top_gnd_10' }, { id: 'top_vcc_10' }, { id: 'top_gnd_11' }, { id: 'top_vcc_11' }, { id: 'top_gnd_12' }, { id: 'top_vcc_12' }, { id: 'top_gnd_13' }, { id: 'top_vcc_13' }, { id: 'top_gnd_14' }, { id: 'top_vcc_14' }, { id: 'top_gnd_15' }, { id: 'top_vcc_15' }, { id: 'top_gnd_16' }, { id: 'top_vcc_16' }, { id: 'top_gnd_17' }, { id: 'top_vcc_17' }, { id: 'top_gnd_18' }, { id: 'top_vcc_18' }, { id: 'top_gnd_19' }, { id: 'top_vcc_19' }, { id: 'top_gnd_20' }, { id: 'top_vcc_20' }, { id: 'top_gnd_21' }, { id: 'top_vcc_21' }, { id: 'top_gnd_22' }, { id: 'top_vcc_22' }, { id: 'top_gnd_23' }, { id: 'top_vcc_23' }, { id: 'top_gnd_24' }, { id: 'top_vcc_24' }, { id: 'top_gnd_25' }, { id: 'top_vcc_25' }, { id: '1e' }, { id: '1d' }, { id: '1c' }, { id: '1b' }, { id: '1a' }, { id: '1f' }, { id: '1g' }, { id: '1h' }, { id: '1i' }, { id: '1j' }, { id: '2e' }, { id: '2d' }, { id: '2c' }, { id: '2b' }, { id: '2a' }, { id: '2f' }, { id: '2g' }, { id: '2h' }, { id: '2i' }, { id: '2j' }, { id: '3e' }, { id: '3d' }, { id: '3c' }, { id: '3b' }, { id: '3a' }, { id: '3f' }, { id: '3g' }, { id: '3h' }, { id: '3i' }, { id: '3j' }, { id: '4e' }, { id: '4d' }, { id: '4c' }, { id: '4b' }, { id: '4a' }, { id: '4f' }, { id: '4g' }, { id: '4h' }, { id: '4i' }, { id: '4j' }, { id: '5e' }, { id: '5d' }, { id: '5c' }, { id: '5b' }, { id: '5a' }, { id: '5f' }, { id: '5g' }, { id: '5h' }, { id: '5i' }, { id: '5j' }, { id: '6e' }, { id: '6d' }, { id: '6c' }, { id: '6b' }, { id: '6a' }, { id: '6f' }, { id: '6g' }, { id: '6h' }, { id: '6i' }, { id: '6j' }, { id: '7e' }, { id: '7d' }, { id: '7c' }, { id: '7b' }, { id: '7a' }, { id: '7f' }, { id: '7g' }, { id: '7h' }, { id: '7i' }, { id: '7j' }, { id: '8e' }, { id: '8d' }, { id: '8c' }, { id: '8b' }, { id: '8a' }, { id: '8f' }, { id: '8g' }, { id: '8h' }, { id: '8i' }, { id: '8j' }, { id: '9e' }, { id: '9d' }, { id: '9c' }, { id: '9b' }, { id: '9a' }, { id: '9f' }, { id: '9g' }, { id: '9h' }, { id: '9i' }, { id: '9j' }, { id: '10e' }, { id: '10d' }, { id: '10c' }, { id: '10b' }, { id: '10a' }, { id: '10f' }, { id: '10g' }, { id: '10h' }, { id: '10i' }, { id: '10j' }, { id: '11e' }, { id: '11d' }, { id: '11c' }, { id: '11b' }, { id: '11a' }, { id: '11f' }, { id: '11g' }, { id: '11h' }, { id: '11i' }, { id: '11j' }, { id: '12e' }, { id: '12d' }, { id: '12c' }, { id: '12b' }, { id: '12a' }, { id: '12f' }, { id: '12g' }, { id: '12h' }, { id: '12i' }, { id: '12j' }, { id: '13e' }, { id: '13d' }, { id: '13c' }, { id: '13b' }, { id: '13a' }, { id: '13f' }, { id: '13g' }, { id: '13h' }, { id: '13i' }, { id: '13j' }, { id: '14e' }, { id: '14d' }, { id: '14c' }, { id: '14b' }, { id: '14a' }, { id: '14f' }, { id: '14g' }, { id: '14h' }, { id: '14i' }, { id: '14j' }, { id: '15e' }, { id: '15d' }, { id: '15c' }, { id: '15b' }, { id: '15a' }, { id: '15f' }, { id: '15g' }, { id: '15h' }, { id: '15i' }, { id: '15j' }, { id: '16e' }, { id: '16d' }, { id: '16c' }, { id: '16b' }, { id: '16a' }, { id: '16f' }, { id: '16g' }, { id: '16h' }, { id: '16i' }, { id: '16j' }, { id: '17e' }, { id: '17d' }, { id: '17c' }, { id: '17b' }, { id: '17a' }, { id: '17f' }, { id: '17g' }, { id: '17h' }, { id: '17i' }, { id: '17j' }, { id: '18e' }, { id: '18d' }, { id: '18c' }, { id: '18b' }, { id: '18a' }, { id: '18f' }, { id: '18g' }, { id: '18h' }, { id: '18i' }, { id: '18j' }, { id: '19e' }, { id: '19d' }, { id: '19c' }, { id: '19b' }, { id: '19a' }, { id: '19f' }, { id: '19g' }, { id: '19h' }, { id: '19i' }, { id: '19j' }, { id: '20e' }, { id: '20d' }, { id: '20c' }, { id: '20b' }, { id: '20a' }, { id: '20f' }, { id: '20g' }, { id: '20h' }, { id: '20i' }, { id: '20j' }, { id: '21e' }, { id: '21d' }, { id: '21c' }, { id: '21b' }, { id: '21a' }, { id: '21f' }, { id: '21g' }, { id: '21h' }, { id: '21i' }, { id: '21j' }, { id: '22e' }, { id: '22d' }, { id: '22c' }, { id: '22b' }, { id: '22a' }, { id: '22f' }, { id: '22g' }, { id: '22h' }, { id: '22i' }, { id: '22j' }, { id: '23e' }, { id: '23d' }, { id: '23c' }, { id: '23b' }, { id: '23a' }, { id: '23f' }, { id: '23g' }, { id: '23h' }, { id: '23i' }, { id: '23j' }, { id: '24e' }, { id: '24d' }, { id: '24c' }, { id: '24b' }, { id: '24a' }, { id: '24f' }, { id: '24g' }, { id: '24h' }, { id: '24i' }, { id: '24j' }, { id: '25e' }, { id: '25d' }, { id: '25c' }, { id: '25b' }, { id: '25a' }, { id: '25f' }, { id: '25g' }, { id: '25h' }, { id: '25i' }, { id: '25j' }, { id: '26e' }, { id: '26d' }, { id: '26c' }, { id: '26b' }, { id: '26a' }, { id: '26f' }, { id: '26g' }, { id: '26h' }, { id: '26i' }, { id: '26j' }, { id: '27e' }, { id: '27d' }, { id: '27c' }, { id: '27b' }, { id: '27a' }, { id: '27f' }, { id: '27g' }, { id: '27h' }, { id: '27i' }, { id: '27j' }, { id: '28e' }, { id: '28d' }, { id: '28c' }, { id: '28b' }, { id: '28a' }, { id: '28f' }, { id: '28g' }, { id: '28h' }, { id: '28i' }, { id: '28j' }, { id: '29e' }, { id: '29d' }, { id: '29c' }, { id: '29b' }, { id: '29a' }, { id: '29f' }, { id: '29g' }, { id: '29h' }, { id: '29i' }, { id: '29j' }, { id: '30e' }, { id: '30d' }, { id: '30c' }, { id: '30b' }, { id: '30a' }, { id: '30f' }, { id: '30g' }, { id: '30h' }, { id: '30i' }, { id: '30j' }, { id: 'bottom_vcc_1' }, { id: 'bottom_gnd_1' }, { id: 'bottom_vcc_2' }, { id: 'bottom_gnd_2' }, { id: 'bottom_vcc_3' }, { id: 'bottom_gnd_3' }, { id: 'bottom_vcc_4' }, { id: 'bottom_gnd_4' }, { id: 'bottom_vcc_5' }, { id: 'bottom_gnd_5' }, { id: 'bottom_vcc_6' }, { id: 'bottom_gnd_6' }, { id: 'bottom_vcc_7' }, { id: 'bottom_gnd_7' }, { id: 'bottom_vcc_8' }, { id: 'bottom_gnd_8' }, { id: 'bottom_vcc_9' }, { id: 'bottom_gnd_9' }, { id: 'bottom_vcc_10' }, { id: 'bottom_gnd_10' }, { id: 'bottom_vcc_11' }, { id: 'bottom_gnd_11' }, { id: 'bottom_vcc_12' }, { id: 'bottom_gnd_12' }, { id: 'bottom_vcc_13' }, { id: 'bottom_gnd_13' }, { id: 'bottom_vcc_14' }, { id: 'bottom_gnd_14' }, { id: 'bottom_vcc_15' }, { id: 'bottom_gnd_15' }, { id: 'bottom_vcc_16' }, { id: 'bottom_gnd_16' }, { id: 'bottom_vcc_17' }, { id: 'bottom_gnd_17' }, { id: 'bottom_vcc_18' }, { id: 'bottom_gnd_18' }, { id: 'bottom_vcc_19' }, { id: 'bottom_gnd_19' }, { id: 'bottom_vcc_20' }, { id: 'bottom_gnd_20' }, { id: 'bottom_vcc_21' }, { id: 'bottom_gnd_21' }, { id: 'bottom_vcc_22' }, { id: 'bottom_gnd_22' }, { id: 'bottom_vcc_23' }, { id: 'bottom_gnd_23' }, { id: 'bottom_vcc_24' }, { id: 'bottom_gnd_24' }, { id: 'bottom_vcc_25' }, { id: 'bottom_gnd_25' }],
    'openhw-breadboard-mini': [{ id: '1e' }, { id: '1d' }, { id: '1c' }, { id: '1b' }, { id: '1a' }, { id: '1f' }, { id: '1g' }, { id: '1h' }, { id: '1i' }, { id: '1j' }, { id: '2e' }, { id: '2d' }, { id: '2c' }, { id: '2b' }, { id: '2a' }, { id: '2f' }, { id: '2g' }, { id: '2h' }, { id: '2i' }, { id: '2j' }, { id: '3e' }, { id: '3d' }, { id: '3c' }, { id: '3b' }, { id: '3a' }, { id: '3f' }, { id: '3g' }, { id: '3h' }, { id: '3i' }, { id: '3j' }, { id: '4e' }, { id: '4d' }, { id: '4c' }, { id: '4b' }, { id: '4a' }, { id: '4f' }, { id: '4g' }, { id: '4h' }, { id: '4i' }, { id: '4j' }, { id: '5e' }, { id: '5d' }, { id: '5c' }, { id: '5b' }, { id: '5a' }, { id: '5f' }, { id: '5g' }, { id: '5h' }, { id: '5i' }, { id: '5j' }, { id: '6e' }, { id: '6d' }, { id: '6c' }, { id: '6b' }, { id: '6a' }, { id: '6f' }, { id: '6g' }, { id: '6h' }, { id: '6i' }, { id: '6j' }, { id: '7e' }, { id: '7d' }, { id: '7c' }, { id: '7b' }, { id: '7a' }, { id: '7f' }, { id: '7g' }, { id: '7h' }, { id: '7i' }, { id: '7j' }, { id: '8e' }, { id: '8d' }, { id: '8c' }, { id: '8b' }, { id: '8a' }, { id: '8f' }, { id: '8g' }, { id: '8h' }, { id: '8i' }, { id: '8j' }, { id: '9e' }, { id: '9d' }, { id: '9c' }, { id: '9b' }, { id: '9a' }, { id: '9f' }, { id: '9g' }, { id: '9h' }, { id: '9i' }, { id: '9j' }, { id: '10e' }, { id: '10d' }, { id: '10c' }, { id: '10b' }, { id: '10a' }, { id: '10f' }, { id: '10g' }, { id: '10h' }, { id: '10i' }, { id: '10j' }, { id: '11e' }, { id: '11d' }, { id: '11c' }, { id: '11b' }, { id: '11a' }, { id: '11f' }, { id: '11g' }, { id: '11h' }, { id: '11i' }, { id: '11j' }, { id: '12e' }, { id: '12d' }, { id: '12c' }, { id: '12b' }, { id: '12a' }, { id: '12f' }, { id: '12g' }, { id: '12h' }, { id: '12i' }, { id: '12j' }, { id: '13e' }, { id: '13d' }, { id: '13c' }, { id: '13b' }, { id: '13a' }, { id: '13f' }, { id: '13g' }, { id: '13h' }, { id: '13i' }, { id: '13j' }, { id: '14e' }, { id: '14d' }, { id: '14c' }, { id: '14b' }, { id: '14a' }, { id: '14f' }, { id: '14g' }, { id: '14h' }, { id: '14i' }, { id: '14j' }, { id: '15e' }, { id: '15d' }, { id: '15c' }, { id: '15b' }, { id: '15a' }, { id: '15f' }, { id: '15g' }, { id: '15h' }, { id: '15i' }, { id: '15j' }, { id: '16e' }, { id: '16d' }, { id: '16c' }, { id: '16b' }, { id: '16a' }, { id: '16f' }, { id: '16g' }, { id: '16h' }, { id: '16i' }, { id: '16j' }, { id: '17e' }, { id: '17d' }, { id: '17c' }, { id: '17b' }, { id: '17a' }, { id: '17f' }, { id: '17g' }, { id: '17h' }, { id: '17i' }, { id: '17j' }],
    'openhw-buzzer': [{ id: 'GND' }, { id: 'SIG' }],
    'openhw-cc1101': [{ id: 'VCC' }, { id: 'GND' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'MISO' }, { id: 'GDO2' }, { id: 'GDO0' }, { id: 'CSN' }],
    'openhw-charger': [{ id: 'IN+' }, { id: 'IN-' }, { id: 'BAT+' }, { id: 'BAT-' }],
    'openhw-dht22': [{ id: 'VCC' }, { id: 'DATA' }, { id: 'NC' }, { id: 'GND' }],
    'openhw-diode': [{ id: 'A' }, { id: 'C' }],
    'openhw-ds1307-rtc': [{ id: 'SQ_2' }, { id: 'DS_2' }, { id: 'SCL_2' }, { id: 'SDA_2' }, { id: 'VCC_2' }, { id: 'GND_2' }, { id: 'BAT_2' }, { id: 'DS' }, { id: 'SCL' }, { id: 'SDA' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-ds18b20': [{ id: 'GND' }, { id: 'DQ' }, { id: 'VCC' }],
    'openhw-ePaperDisplay': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DIN' }, { id: 'CLK' }, { id: 'CS' }, { id: 'DC' }, { id: 'RST' }, { id: 'BUSY' }],
    'openhw-esp32': [{ id: 'EN' }, { id: 'VP' }, { id: 'VN' }, { id: '34' }, { id: '35' }, { id: '32' }, { id: '33' }, { id: '25' }, { id: '26' }, { id: '27' }, { id: '14' }, { id: '12' }, { id: '13' }, { id: 'GND.2' }, { id: 'VIN' }, { id: '23' }, { id: '22' }, { id: '1' }, { id: '3' }, { id: '21' }, { id: '19' }, { id: '18' }, { id: '5' }, { id: '17' }, { id: '16' }, { id: '4' }, { id: '2' }, { id: '15' }, { id: 'GND.1' }, { id: '3V3' }],
    'openhw-esp32-cam': [{ id: '5V.1' }, { id: 'GND.1' }, { id: '12' }, { id: '13' }, { id: '15' }, { id: '14' }, { id: '2' }, { id: '4' }, { id: '3V3' }, { id: '16' }, { id: '0' }, { id: 'GND.2' }, { id: 'VCC' }, { id: '3' }, { id: '1' }, { id: 'GND.3' }],
    'openhw-hc-sr04': [{ id: 'VCC' }, { id: 'TRIG' }, { id: 'ECHO' }, { id: 'GND' }],
    'openhw-hp4067': [{ id: 'GND' }, { id: 'VCC' }, { id: 'EN' }, { id: 'S3' }, { id: 'S2' }, { id: 'S1' }, { id: 'S0' }, { id: 'SIG' }, { id: 'C15' }, { id: 'C14' }, { id: 'C13' }, { id: 'C12' }, { id: 'C11' }, { id: 'C10' }, { id: 'C9' }, { id: 'C8' }, { id: 'C7' }, { id: 'C6' }, { id: 'C5' }, { id: 'C4' }, { id: 'C3' }, { id: 'C2' }, { id: 'C1' }, { id: 'C0' }],
    'openhw-hx711_5': [{ id: 'GND' }, { id: 'DT' }, { id: 'SCK' }, { id: 'VCC' }],
    'openhw-hx711_50': [{ id: 'GND' }, { id: 'DT' }, { id: 'SCK' }, { id: 'VCC' }],
    'openhw-ili9341': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'RESET' }, { id: 'DC' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'LED' }, { id: 'MISO' }],
    'openhw-ili9341-touch': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'RESET' }, { id: 'DC' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'LED' }, { id: 'MISO' }, { id: 'SCL' }, { id: 'SDA' }],
    'openhw-image': [],
    'openhw-inmp441': [{ id: 'VDD' }, { id: 'GND' }, { id: 'L/R' }, { id: 'WS' }, { id: 'SCK' }, { id: 'SD' }],
    'openhw-ir-receiver': [{ id: 'GND' }, { id: 'VCC' }, { id: 'OUT' }],
    'openhw-ir-remote': [],
    'openhw-ks2e-m-dc5': [{ id: 'COIL1' }, { id: 'COIL2' }, { id: 'P1' }, { id: 'NC1' }, { id: 'NO1' }, { id: 'P2' }, { id: 'NC2' }, { id: 'NO2' }],
    'openhw-l293d': [{ id: 'EN1,2' }, { id: 'IN1' }, { id: 'OUT1' }, { id: 'GND1' }, { id: 'GND2' }, { id: 'OUT2' }, { id: 'IN2' }, { id: 'VCC2' }, { id: 'VCC1' }, { id: 'IN4' }, { id: 'OUT4' }, { id: 'GND4' }, { id: 'GND3' }, { id: 'OUT3' }, { id: 'IN3' }, { id: 'EN3,4' }],
    'openhw-lcd1602': [{ id: 'VSS' }, { id: 'VDD' }, { id: 'V0' }, { id: 'RS' }, { id: 'RW' }, { id: 'E' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'A' }, { id: 'K' }],
    'openhw-lcd1602-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'openhw-lcd2004': [{ id: 'VSS' }, { id: 'VDD' }, { id: 'V0' }, { id: 'RS' }, { id: 'RW' }, { id: 'E' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'A' }, { id: 'K' }],
    'openhw-lcd2004-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'openhw-ldr-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }],
    'openhw-led': [{ id: 'A' }, { id: 'K' }],
    'openhw-logic-analyzer': [{ id: 'GND' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }],
    'openhw-max7219': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DIN' }, { id: 'CS' }, { id: 'CLK' }, { id: 'VCC_OUT' }, { id: 'GND_OUT' }, { id: 'DOUT' }, { id: 'CS_OUT' }, { id: 'CLK_OUT' }],
    'openhw-max98357': [{ id: 'LRC' }, { id: 'BCLK' }, { id: 'DIN' }, { id: 'GAIN' }, { id: 'SD' }, { id: 'GND' }, { id: 'VIN' }, { id: 'OUT+' }, { id: 'OUT-' }],
    'openhw-membrane-keypad': [{ id: 'R1' }, { id: 'R2' }, { id: 'R3' }, { id: 'R4' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }],
    'openhw-mfrc522': [{ id: '3V3' }, { id: 'RST' }, { id: 'GND' }, { id: 'IRQ' }, { id: 'MISO' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'SDA' }],
    'openhw-motor': [{ id: '1' }, { id: '2' }],
    'openhw-motor-driver': [{ id: 'ENA' }, { id: 'IN1' }, { id: 'IN2' }, { id: 'IN3' }, { id: 'IN4' }, { id: 'ENB' }, { id: 'OUT1' }, { id: 'OUT2' }, { id: 'OUT3' }, { id: 'OUT4' }, { id: '12V' }, { id: 'GND' }, { id: '5V' }],
    'openhw-mpu6050': [{ id: 'INT' }, { id: 'AD0' }, { id: 'XCL' }, { id: 'XDA' }, { id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'VCC' }],
    'openhw-mq2-gas-sensor': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }],
    'openhw-neopixel-matrix': [{ id: 'VCC' }, { id: 'DIN' }, { id: 'GND' }, { id: 'DOUT' }],
    'openhw-neopixel-ring': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DIN' }, { id: 'DOUT' }],
    'openhw-nlsf595': [{ id: 'VCC' }, { id: 'GND' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'CS' }, { id: 'R1' }, { id: 'G1' }, { id: 'B1' }],
    'openhw-nokia-5110': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SCE' }, { id: 'RST' }, { id: 'DC' }, { id: 'DN' }, { id: 'SCLK' }, { id: 'LED' }],
    'openhw-npn-transistor': [{ id: 'E' }, { id: 'B' }, { id: 'C' }],
    'openhw-nrf24l01': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CE' }, { id: 'CSN' }, { id: 'SCK' }, { id: 'MOSI' }, { id: 'MISO' }, { id: 'IRQ' }],
    'openhw-ntc-temperature-sensor': [{ id: 'GND' }, { id: 'VCC' }, { id: 'OUT' }],
    'openhw-ntc-thermistor': [{ id: 'A0' }, { id: 'D0' }, { id: 'GND' }, { id: 'VCC' }],
    'openhw-pca9685': [{ id: 'SDA' }, { id: 'SCL' }, { id: 'TXD' }, { id: 'RXD' }, { id: '#4' }, { id: '#17' }, { id: '#18' }, { id: '#27' }, { id: '#22' }, { id: '#23' }, { id: '#24' }, { id: '#25' }, { id: 'MOSI' }, { id: 'MISO' }, { id: 'CLK' }, { id: 'CE0' }, { id: 'CE1' }, { id: '#5' }, { id: '#6' }, { id: '#12' }, { id: '#13' }, { id: '#16' }, { id: '#19' }, { id: '#20' }, { id: '#21' }, { id: 'GND_IN' }, { id: 'VCC_IN' }, { id: '5.0V' }, { id: '3.3V' }, { id: 'GND' }, { id: 'S0' }, { id: 'V+0' }, { id: 'G0' }, { id: 'S1' }, { id: 'V+1' }, { id: 'G1' }, { id: 'S2' }, { id: 'V+2' }, { id: 'G2' }, { id: 'S3' }, { id: 'V+3' }, { id: 'G3' }, { id: 'S4' }, { id: 'V+4' }, { id: 'G4' }, { id: 'S5' }, { id: 'V+5' }, { id: 'G5' }, { id: 'S6' }, { id: 'V+6' }, { id: 'G6' }, { id: 'S7' }, { id: 'V+7' }, { id: 'G7' }, { id: 'S8' }, { id: 'V+8' }, { id: 'G8' }, { id: 'S9' }, { id: 'V+9' }, { id: 'G9' }, { id: 'S10' }, { id: 'V+10' }, { id: 'G10' }, { id: 'S11' }, { id: 'V+11' }, { id: 'G11' }, { id: 'S12' }, { id: 'V+12' }, { id: 'G12' }, { id: 'S13' }, { id: 'V+13' }, { id: 'G13' }, { id: 'S14' }, { id: 'V+14' }, { id: 'G14' }, { id: 'S15' }, { id: 'V+15' }, { id: 'G15' }],
    'openhw-pca9865': [{ id: 'GND' }, { id: 'OE' }, { id: 'SCL' }, { id: 'SDA' }, { id: 'VCC' }, { id: 'V+' }, { id: 'GND_R' }, { id: 'OE_R' }, { id: 'SCL_R' }, { id: 'SDA_R' }, { id: 'VCC_R' }, { id: 'V+_R' }, { id: 'V+_IN' }, { id: 'GND_IN' }, { id: 'S0' }, { id: 'V+0' }, { id: 'G0' }, { id: 'S1' }, { id: 'V+1' }, { id: 'G1' }, { id: 'S2' }, { id: 'V+2' }, { id: 'G2' }, { id: 'S3' }, { id: 'V+3' }, { id: 'G3' }, { id: 'S4' }, { id: 'V+4' }, { id: 'G4' }, { id: 'S5' }, { id: 'V+5' }, { id: 'G5' }, { id: 'S6' }, { id: 'V+6' }, { id: 'G6' }, { id: 'S7' }, { id: 'V+7' }, { id: 'G7' }, { id: 'S8' }, { id: 'V+8' }, { id: 'G8' }, { id: 'S9' }, { id: 'V+9' }, { id: 'G9' }, { id: 'S10' }, { id: 'V+10' }, { id: 'G10' }, { id: 'S11' }, { id: 'V+11' }, { id: 'G11' }, { id: 'S12' }, { id: 'V+12' }, { id: 'G12' }, { id: 'S13' }, { id: 'V+13' }, { id: 'G13' }, { id: 'S14' }, { id: 'V+14' }, { id: 'G14' }, { id: 'S15' }, { id: 'V+15' }, { id: 'G15' }],
    'openhw-pcm5102': [{ id: 'VCC' }, { id: 'GND' }, { id: 'FLT' }, { id: 'DMP' }, { id: 'XMT' }, { id: 'FMT' }, { id: 'SCK' }, { id: 'BCK' }, { id: 'DIN' }, { id: 'LCK' }, { id: 'OUTL' }, { id: 'OUTR' }],
    'openhw-photodiode': [{ id: 'A' }, { id: 'C' }],
    'openhw-photoresistor': [{ id: 'p1' }, { id: 'p2' }],
    'openhw-pico': [{ id: 'GP0' }, { id: 'GP1' }, { id: 'GND' }, { id: 'GP2' }, { id: 'GP3' }, { id: 'GP4' }, { id: 'GP5' }, { id: 'GND_1' }, { id: 'GP6' }, { id: 'GP7' }, { id: 'GP8' }, { id: 'GP9' }, { id: 'GND_2' }, { id: 'GP10' }, { id: 'GP11' }, { id: 'GP12' }, { id: 'GP13' }, { id: 'GND_3' }, { id: 'GP14' }, { id: 'GP15' }, { id: 'VBUS' }, { id: 'VSYS' }, { id: 'GND_4' }, { id: '3V3_EN' }, { id: '3V3' }, { id: 'ADC_VREF' }, { id: 'GP28' }, { id: 'AGND' }, { id: 'GP27' }, { id: 'GP26' }, { id: 'RUN' }, { id: 'GP22' }, { id: 'GND_5' }, { id: 'GP21' }, { id: 'GP20' }, { id: 'GP19' }, { id: 'GP18' }, { id: 'GND_6' }, { id: 'GP17' }, { id: 'GP16' }, { id: '13' }, { id: '2' }, { id: '5V' }, { id: 'A4' }, { id: 'A5' }, { id: 'SCK' }, { id: 'MOSI' }, { id: 'MISO' }, { id: 'SS' }],
    'openhw-pico-w': [{ id: 'GP0' }, { id: 'GP1' }, { id: 'GND' }, { id: 'GP2' }, { id: 'GP3' }, { id: 'GP4' }, { id: 'GP5' }, { id: 'GND_1' }, { id: 'GP6' }, { id: 'GP7' }, { id: 'GP8' }, { id: 'GP9' }, { id: 'GND_2' }, { id: 'GP10' }, { id: 'GP11' }, { id: 'GP12' }, { id: 'GP13' }, { id: 'GND_3' }, { id: 'GP14' }, { id: 'GP15' }, { id: 'VBUS' }, { id: 'VSYS' }, { id: 'GND_4' }, { id: '3V3_EN' }, { id: '3V3' }, { id: 'ADC_VREF' }, { id: 'GP28' }, { id: 'AGND' }, { id: 'GP27' }, { id: 'GP26' }, { id: 'RUN' }, { id: 'GP22' }, { id: 'GND_5' }, { id: 'GP21' }, { id: 'GP20' }, { id: 'GP19' }, { id: 'GP18' }, { id: 'GND_6' }, { id: 'GP17' }, { id: 'GP16' }, { id: '13' }, { id: '2' }, { id: '5V' }, { id: 'A4' }, { id: 'A5' }],
    'openhw-potentiometer': [{ id: '1' }, { id: 'SIG' }, { id: '2' }],
    'openhw-power-supply': [{ id: '5V' }, { id: 'GND' }],
    'openhw-pushbutton': [{ id: '1l' }, { id: '2l' }, { id: '1r' }, { id: '2r' }],
    'openhw-pushbutton-6mm': [{ id: '1A' }, { id: '1B' }, { id: '2A' }, { id: '2B' }],
    'openhw-raindrop-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }, { id: 'PAD+' }, { id: 'PAD-' }],
    'openhw-raindrop-pad': [{ id: 'AOUT' }, { id: 'GND' }],
    'openhw-relay-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'IN' }, { id: 'NO' }, { id: 'COM' }, { id: 'NC' }],
    'openhw-resistor': [{ id: 'p1' }, { id: 'p2' }],
    'openhw-rgb-led': [{ id: 'R' }, { id: 'COM' }, { id: 'G' }, { id: 'B' }],
    'openhw-rotary-encoder': [{ id: 'CLK' }, { id: 'DT' }, { id: 'SW' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-sd-card': [{ id: 'CD' }, { id: 'MISO' }, { id: 'GND' }, { id: 'SCK' }, { id: 'VCC' }, { id: 'MOSI' }, { id: 'CS' }],
    'openhw-servo': [{ id: 'GND' }, { id: 'V+' }, { id: 'PWM' }],
    'openhw-simulation-monitor': [{ id: 'VCC' }, { id: 'GND' }, { id: 'TX' }, { id: 'RX' }],
    'openhw-slide-potentiometer': [{ id: 'GND' }, { id: 'SIG' }, { id: 'VCC' }],
    'openhw-slide-switch': [{ id: '1' }, { id: '2' }, { id: '3' }],
    'openhw-soil-moisture-sensor': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SIG' }],
    'openhw-sph0645': [{ id: '3V' }, { id: 'GND' }, { id: 'BCLK' }, { id: 'DOUT' }, { id: 'LRCL' }, { id: 'SEL' }],
    'openhw-ssd1306-oled': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SCL' }, { id: 'SDA' }],
    'openhw-stepper-motor': [{ id: 'A-' }, { id: 'A+' }, { id: 'B+' }, { id: 'B-' }],
    'openhw-stm32-blue-pill (frontend)': [{ id: 'PB12' }, { id: 'PB13' }, { id: 'PB14' }, { id: 'PB15' }, { id: 'PA8' }, { id: 'PA9' }, { id: 'PA10' }, { id: 'PA11' }, { id: 'PA12' }, { id: 'PA15' }, { id: 'PB3' }, { id: 'PB4' }, { id: 'PB5' }, { id: 'PB6' }, { id: 'PB7' }, { id: 'PB8' }, { id: 'PB9' }, { id: '5V' }, { id: 'GND' }, { id: '3V3' }, { id: 'GND.2' }, { id: 'GND.3' }, { id: '3V3.2' }, { id: 'RST' }, { id: 'PB11' }, { id: 'PB10' }, { id: 'PB1' }, { id: 'PB0' }, { id: 'PA7' }, { id: 'PA6' }, { id: 'PA5' }, { id: 'PA4' }, { id: 'PA3' }, { id: 'PA2' }, { id: 'PA1' }, { id: 'PA0' }, { id: 'PC15' }, { id: 'PC14' }, { id: 'PC13' }, { id: 'VBAT' }],
    'openhw-stm32-bluepill': [{ id: 'VBAT' }, { id: 'PC13' }, { id: 'PC14' }, { id: 'PC15' }, { id: 'PA0' }, { id: 'PA1' }, { id: 'PA2' }, { id: 'PA3' }, { id: 'PA4' }, { id: 'PA5' }, { id: 'PA6' }, { id: 'PA7' }, { id: 'PB0' }, { id: 'PB1' }, { id: 'PB10' }, { id: 'PB11' }, { id: 'RESET' }, { id: '3V3.1' }, { id: 'GND.1' }, { id: 'GND.2' }, { id: '3V3.2' }, { id: 'GND.3' }, { id: '5V' }, { id: 'PB9' }, { id: 'PB8' }, { id: 'PB7' }, { id: 'PB6' }, { id: 'PB5' }, { id: 'PB4' }, { id: 'PB3' }, { id: 'PA15' }, { id: 'PA12' }, { id: 'PA11' }, { id: 'PA10' }, { id: 'PA9' }, { id: 'PA8' }, { id: 'PB15' }, { id: 'PB14' }, { id: 'PB13' }, { id: 'PB12' }, { id: 'SWD_3V3' }, { id: 'SWDIO' }, { id: 'SWCLK' }, { id: 'SWD_GND' }],
    'openhw-text': [],
    'openhw-tm1637-7segment': [{ id: 'CLK' }, { id: 'DIO' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-wifi-ap': [],
    'wokwi-pir-motion-sensor': [{ id: 'VCC' }, { id: 'OUT' }, { id: 'GND' }],
}[]> = {
    'wokwi-led': [{ id: 'A' }, { id: 'K' }],
    'openhw-led': [{ id: 'A' }, { id: 'K' }],
    'wokwi-arduino-uno': UNO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-arduino-uno': UNO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-esp32': [{ id: 'EN' }, { id: 'VP' }, { id: 'VN' }, { id: '34' }, { id: '35' }, { id: '32' }, { id: '33' }, { id: '25' }, { id: '26' }, { id: '27' }, { id: '14' }, { id: '12' }, { id: '13' }, { id: 'GND.2' }, { id: 'VIN' }, { id: '23' }, { id: '22' }, { id: '1' }, { id: '3' }, { id: '21' }, { id: '19' }, { id: '18' }, { id: '5' }, { id: '17' }, { id: '16' }, { id: '4' }, { id: '2' }, { id: '15' }, { id: 'GND.1' }, { id: '3V3' }],
    'openhw-esp32-cam': [{ id: '5V.1' }, { id: 'GND.1' }, { id: '12' }, { id: '13' }, { id: '15' }, { id: '14' }, { id: '2' }, { id: '4' }, { id: '3V3' }, { id: '16' }, { id: '0' }, { id: 'GND.2' }, { id: 'VCC' }, { id: '3' }, { id: '1' }, { id: 'GND.3' }],
    'wokwi-esp32-cam': [{ id: '5V.1' }, { id: 'GND.1' }, { id: '12' }, { id: '13' }, { id: '15' }, { id: '14' }, { id: '2' }, { id: '4' }, { id: '3V3' }, { id: '16' }, { id: '0' }, { id: 'GND.2' }, { id: 'VCC' }, { id: '3' }, { id: '1' }, { id: 'GND.3' }],
    'esp32-cam': [{ id: '5V.1' }, { id: 'GND.1' }, { id: '12' }, { id: '13' }, { id: '15' }, { id: '14' }, { id: '2' }, { id: '4' }, { id: '3V3' }, { id: '16' }, { id: '0' }, { id: 'GND.2' }, { id: 'VCC' }, { id: '3' }, { id: '1' }, { id: 'GND.3' }],
    'wokwi-raspberry-pi-pico': PICO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-raspberry-pi-pico': PICO_BOARD_PINS.map((id: string) => ({ id })),
    'wokwi-raspberry-pi-pico-w': PICO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-raspberry-pi-pico-w': PICO_BOARD_PINS.map((id: string) => ({ id })),
    'wokwi-resistor': [{ id: 'p1' }, { id: 'p2' }],
    'openhw-resistor': [{ id: 'p1' }, { id: 'p2' }],
    'wokwi-slide-switch': [{ id: '1' }, { id: '2' }, { id: '3' }],
    'openhw-slide-switch': [{ id: '1' }, { id: '2' }, { id: '3' }],
    'wokwi-pushbutton': [{ id: '1l' }, { id: '2l' }, { id: '1r' }, { id: '2r' }, { id: '1' }, { id: '2' }],
    'openhw-pushbutton': [{ id: '1l' }, { id: '2l' }, { id: '1r' }, { id: '2r' }, { id: '1' }, { id: '2' }],
    'wokwi-buzzer': [{ id: '1' }, { id: '2' }],
    'openhw-buzzer': [{ id: 'GND' }, { id: 'SIG' }],
    'wokwi-neopixel-matrix': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-neopixel-matrix': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-ws2812b': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-ws2812b': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-ws2821b': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-ws2821b': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-servo': [{ id: 'GND' }, { id: 'V+' }, { id: 'PWM' }],
    'openhw-servo': [{ id: 'GND' }, { id: 'V+' }, { id: 'PWM' }],
    'wokwi-motor': [{ id: '1' }, { id: '2' }],
    'openhw-motor': [{ id: '1' }, { id: '2' }],
    'wokwi-motor-driver': [{ id: 'ENA' }, { id: 'ENB' }, { id: 'IN1' }, { id: 'IN2' }, { id: 'IN3' }, { id: 'IN4' }, { id: 'OUT1' }, { id: 'OUT2' }, { id: 'OUT3' }, { id: 'OUT4' }, { id: '12V' }, { id: '5V' }, { id: 'GND' }],
    'openhw-motor-driver': [{ id: 'ENA' }, { id: 'ENB' }, { id: 'IN1' }, { id: 'IN2' }, { id: 'IN3' }, { id: 'IN4' }, { id: 'OUT1' }, { id: 'OUT2' }, { id: 'OUT3' }, { id: 'OUT4' }, { id: '12V' }, { id: '5V' }, { id: 'GND' }],
    'wokwi-potentiometer': [{ id: '1' }, { id: '2' }, { id: 'SIG' }],
    'openhw-potentiometer': [{ id: '1' }, { id: '2' }, { id: 'SIG' }],
    'wokwi-slide-potentiometer': [{ id: 'GND' }, { id: 'SIG' }, { id: 'VCC' }],
    'openhw-slide-potentiometer': [{ id: 'GND' }, { id: 'SIG' }, { id: 'VCC' }],
    'wokwi-lcd2004-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'openhw-lcd2004-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'wokwi-lcd1602': [{ id: 'VSS' }, { id: 'VDD' }, { id: 'V0' }, { id: 'RS' }, { id: 'RW' }, { id: 'E' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'A' }, { id: 'K' }],
    'openhw-lcd1602': [{ id: 'VSS' }, { id: 'VDD' }, { id: 'V0' }, { id: 'RS' }, { id: 'RW' }, { id: 'E' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'A' }, { id: 'K' }],
    'wokwi-lcd1602-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'openhw-lcd1602-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'wokwi-ssd1306-oled': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SCL' }, { id: 'SDA' }],
    'openhw-ssd1306-oled': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SCL' }, { id: 'SDA' }],
    max30102: [{ id: 'VIN' }, { id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'INT' }, { id: 'IRD' }, { id: 'RD' }, { id: 'NC' }],
    'wokwi-max7219': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DIN' }, { id: 'CS' }, { id: 'CLK' }, { id: 'VCC_OUT' }, { id: 'GND_OUT' }, { id: 'DOUT' }, { id: 'CS_OUT' }, { id: 'CLK_OUT' }],
    'openhw-max7219': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DIN' }, { id: 'CS' }, { id: 'CLK' }, { id: 'VCC_OUT' }, { id: 'GND_OUT' }, { id: 'DOUT' }, { id: 'CS_OUT' }, { id: 'CLK_OUT' }],
    'wokwi-ldr-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }],
    'openhw-ldr-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }],
    'wokwi-7segment': [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }, { id: 'F' }, { id: 'G' }, { id: 'DP' }, { id: 'DIG1' }, { id: 'DIG2' }, { id: 'DIG3' }, { id: 'DIG4' }, { id: 'COLON' }],
    'openhw-7segment': [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }, { id: 'F' }, { id: 'G' }, { id: 'DP' }, { id: 'DIG1' }, { id: 'DIG2' }, { id: 'DIG3' }, { id: 'DIG4' }, { id: 'COLON' }],
    'wokwi-ili9341': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'RESET' }, { id: 'DC' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'LED' }, { id: 'MISO' }],
    'openhw-ili9341': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'RESET' }, { id: 'DC' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'LED' }, { id: 'MISO' }],
    'wokwi-sd-card': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'SCK' }, { id: 'MOSI' }, { id: 'MISO' }],
    'openhw-sd-card': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'SCK' }, { id: 'MOSI' }, { id: 'MISO' }],
    'wokwi-power-supply': [{ id: 'GND' }, { id: '5V' }, { id: 'VCC' }],
    'openhw-power-supply': [{ id: 'GND' }, { id: '5V' }, { id: 'VCC' }],
    'shift_register': [{ id: 'vcc' }, { id: 'gnd' }, { id: 'ser' }, { id: 'srclk' }, { id: 'rclk' }, { id: 'oe' }, { id: 'srclr' }, { id: 'q0' }, { id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }, { id: 'q6' }, { id: 'q7' }, { id: 'q7s' }],
    'wokwi-membrane-keypad': [{ id: 'R1' }, { id: 'R2' }, { id: 'R3' }, { id: 'R4' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }],
    'openhw-membrane-keypad': [{ id: 'R1' }, { id: 'R2' }, { id: 'R3' }, { id: 'R4' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }],
    'wokwi-analog-joystick': [{ id: 'GND' }, { id: 'VCC' }, { id: 'VRX' }, { id: 'VRY' }, { id: 'SW' }],
    'openhw-analog-joystick': [{ id: 'GND' }, { id: 'VCC' }, { id: 'VRX' }, { id: 'VRY' }, { id: 'SW' }],
    'openhw-rotary-encoder': [{ id: 'CLK' }, { id: 'DT' }, { id: 'SW' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-rotary-encoder': [{ id: 'CLK' }, { id: 'DT' }, { id: 'SW' }, { id: 'VCC' }, { id: 'GND' }],
    'logic-ic-74xx': [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }, { id: 'p5' }, { id: 'p6' }, { id: 'p7' }, { id: 'p8' }, { id: 'p9' }, { id: 'p10' }, { id: 'p11' }, { id: 'p12' }, { id: 'p13' }, { id: 'p14' }],
    'logic-mux-2to1': [{ id: 'D0' }, { id: 'D1' }, { id: 'SEL' }, { id: 'OUT' }],
    'logic-d-flipflop': [{ id: 'D' }, { id: 'CLK' }, { id: 'Q' }, { id: 'Qbar' }],
    'logic-d-flipflop-r': [{ id: 'D' }, { id: 'CLK' }, { id: 'R' }, { id: 'Q' }, { id: 'Qbar' }],
    'logic-d-flipflop-dsr': [{ id: 'D' }, { id: 'CLK' }, { id: 'S' }, { id: 'R' }, { id: 'Q' }, { id: 'Qbar' }],
    'logic-clock-generator': [{ id: 'OUT' }],
    'wokwi-tm1637-7segment': [{ id: 'CLK' }, { id: 'DIO' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-tm1637-7segment': [{ id: 'CLK' }, { id: 'DIO' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-neopixel-ring': [{ id: 'DIN' }, { id: 'VDD' }, { id: 'VSS' }, { id: 'DOUT' }],
    'wokwi-rgb-led': [{ id: 'R' }, { id: 'COM' }, { id: 'G' }, { id: 'B' }],
    'openhw-rgb-led': [{ id: 'R' }, { id: 'COM' }, { id: 'G' }, { id: 'B' }],
    'wokwi-nokia-5110': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SCE' }, { id: 'RST' }, { id: 'DC' }, { id: 'DN' }, { id: 'SCLK' }, { id: 'LED' }],
    'openhw-nokia-5110': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SCE' }, { id: 'RST' }, { id: 'DC' }, { id: 'DN' }, { id: 'SCLK' }, { id: 'LED' }],
    'wokwi-l293d': [{ id: 'EN1,2' }, { id: 'IN1' }, { id: 'OUT1' }, { id: 'GND1' }, { id: 'GND2' }, { id: 'OUT2' }, { id: 'IN2' }, { id: 'VCC2' }, { id: 'VCC1' }, { id: 'IN4' }, { id: 'OUT4' }, { id: 'GND4' }, { id: 'GND3' }, { id: 'OUT3' }, { id: 'IN3' }, { id: 'EN3,4' }],
    'openhw-l293d': [{ id: 'EN1,2' }, { id: 'IN1' }, { id: 'OUT1' }, { id: 'GND1' }, { id: 'GND2' }, { id: 'OUT2' }, { id: 'IN2' }, { id: 'VCC2' }, { id: 'VCC1' }, { id: 'IN4' }, { id: 'OUT4' }, { id: 'GND4' }, { id: 'GND3' }, { id: 'OUT3' }, { id: 'IN3' }, { id: 'EN3,4' }],
    'wokwi-arduino-nano': [{ id: 'D0' }, { id: 'RX' }, { id: 'D1' }, { id: 'TX' }, { id: 'D2' }, { id: '2' }, { id: 'D3' }, { id: '3' }, { id: 'D4' }, { id: '4' }, { id: 'D5' }, { id: '5' }, { id: 'D6' }, { id: '6' }, { id: 'D7' }, { id: '7' }, { id: 'D8' }, { id: '8' }, { id: 'D9' }, { id: '9' }, { id: 'D10' }, { id: '10' }, { id: 'D11' }, { id: '11' }, { id: 'D12' }, { id: '12' }, { id: 'D13' }, { id: '13' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: '5V' }, { id: 'VCC' }, { id: '3V3' }, { id: 'GND' }, { id: 'GND.1' }, { id: 'GND.2' }, { id: 'RST' }, { id: 'RST.1' }, { id: 'RST.2' }, { id: 'VIN' }, { id: 'AREF' }],
    'openhw-arduino-nano': [{ id: 'D0' }, { id: 'RX' }, { id: 'D1' }, { id: 'TX' }, { id: 'D2' }, { id: '2' }, { id: 'D3' }, { id: '3' }, { id: 'D4' }, { id: '4' }, { id: 'D5' }, { id: '5' }, { id: 'D6' }, { id: '6' }, { id: 'D7' }, { id: '7' }, { id: 'D8' }, { id: '8' }, { id: 'D9' }, { id: '9' }, { id: 'D10' }, { id: '10' }, { id: 'D11' }, { id: '11' }, { id: 'D12' }, { id: '12' }, { id: 'D13' }, { id: '13' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: '5V' }, { id: 'VCC' }, { id: '3V3' }, { id: 'GND' }, { id: 'GND.1' }, { id: 'GND.2' }, { id: 'RST' }, { id: 'RST.1' }, { id: 'RST.2' }, { id: 'VIN' }, { id: 'AREF' }],
    'openhw-dip-switch-8': [{ id: '1a' }, { id: '1b' }, { id: '2a' }, { id: '2b' }, { id: '3a' }, { id: '3b' }, { id: '4a' }, { id: '4b' }, { id: '5a' }, { id: '5b' }, { id: '6a' }, { id: '6b' }, { id: '7a' }, { id: '7b' }, { id: '8a' }, { id: '8b' }],
    'openhw-pcm5102': [{ id: 'VCC' }, { id: 'GND' }, { id: 'BCK' }, { id: 'LRCK' }, { id: 'DIN' }, { id: 'SCK' }, { id: 'FMT' }, { id: 'DEMP' }, { id: 'XSMT' }],
    'openhw-max98357': [{ id: 'VDD' }, { id: 'GND' }, { id: 'BCLK' }, { id: 'LRC' }, { id: 'DIN' }, { id: 'GAIN' }, { id: 'SD' }],
    'openhw-inmp441': [{ id: 'VDD' }, { id: 'GND' }, { id: 'WS' }, { id: 'SCK' }, { id: 'SD' }, { id: 'LR' }],
    'openhw-sph0645': [{ id: '3V' }, { id: 'GND' }, { id: 'BCLK' }, { id: 'LRCLK' }, { id: 'DOUT' }, { id: 'SEL' }],
    'wokwi-pca9685': [{ id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'VCC' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'S4' }, { id: 'S5' }, { id: 'S6' }, { id: 'S7' }, { id: 'S8' }, { id: 'S9' }, { id: 'S10' }, { id: 'S11' }, { id: 'S12' }, { id: 'S13' }, { id: 'S14' }, { id: 'S15' }],
    'openhw-pca9685': [{ id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'VCC' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'S4' }, { id: 'S5' }, { id: 'S6' }, { id: 'S7' }, { id: 'S8' }, { id: 'S9' }, { id: 'S10' }, { id: 'S11' }, { id: 'S12' }, { id: 'S13' }, { id: 'S14' }, { id: 'S15' }],
    'wokwi-pca9865': [{ id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'VCC' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'S4' }, { id: 'S5' }, { id: 'S6' }, { id: 'S7' }, { id: 'S8' }, { id: 'S9' }, { id: 'S10' }, { id: 'S11' }, { id: 'S12' }, { id: 'S13' }, { id: 'S14' }, { id: 'S15' }],
    'openhw-pca9865': [{ id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'VCC' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'S4' }, { id: 'S5' }, { id: 'S6' }, { id: 'S7' }, { id: 'S8' }, { id: 'S9' }, { id: 'S10' }, { id: 'S11' }, { id: 'S12' }, { id: 'S13' }, { id: 'S14' }, { id: 'S15' }],
    'wokwi-soil-moisture-sensor': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SIG' }],
    'openhw-soil-moisture-sensor': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SIG' }],
    'wokwi-cd74hc4067': [{ id: 'VCC' }, { id: 'GND' }, { id: 'EN' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'SIG' }, { id: 'C0' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }, { id: 'C5' }, { id: 'C6' }, { id: 'C7' }, { id: 'C8' }, { id: 'C9' }, { id: 'C10' }, { id: 'C11' }, { id: 'C12' }, { id: 'C13' }, { id: 'C14' }, { id: 'C15' }],
    'openhw-cd74hc4067': [{ id: 'VCC' }, { id: 'GND' }, { id: 'EN' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'SIG' }, { id: 'C0' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }, { id: 'C5' }, { id: 'C6' }, { id: 'C7' }, { id: 'C8' }, { id: 'C9' }, { id: 'C10' }, { id: 'C11' }, { id: 'C12' }, { id: 'C13' }, { id: 'C14' }, { id: 'C15' }],
    'wokwi-logic-analyzer': [{ id: 'GND' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }],
    'openhw-logic-analyzer': [{ id: 'GND' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }],
    'wokwi-photodiode': [{ id: 'A' }, { id: 'C' }],
    'openhw-photodiode': [{ id: 'A' }, { id: 'C' }],
    'wokwi-diode': [{ id: 'A' }, { id: 'C' }],
    'openhw-diode': [{ id: 'A' }, { id: 'C' }],
    'wokwi-npn-transistor': [{ id: 'E' }, { id: 'B' }, { id: 'C' }],
    'openhw-npn-transistor': [{ id: 'E' }, { id: 'B' }, { id: 'C' }],
    'wokwi-a4988': [{ id: 'ENABLE' }, { id: 'MS1' }, { id: 'MS2' }, { id: 'MS3' }, { id: 'RESET' }, { id: 'SLEEP' }, { id: 'STEP' }, { id: 'DIR' }, { id: 'VMOT' }, { id: 'GND_MOT' }, { id: '2B' }, { id: '2A' }, { id: '1A' }, { id: '1B' }, { id: 'VDD' }, { id: 'GND_LOGIC' }],
    'openhw-a4988': [{ id: 'ENABLE' }, { id: 'MS1' }, { id: 'MS2' }, { id: 'MS3' }, { id: 'RESET' }, { id: 'SLEEP' }, { id: 'STEP' }, { id: 'DIR' }, { id: 'VMOT' }, { id: 'GND_MOT' }, { id: '2B' }, { id: '2A' }, { id: '1A' }, { id: '1B' }, { id: 'VDD' }, { id: 'GND_LOGIC' }],
    'wokwi-bmp180': [{ id: 'VIN' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }],
    'openhw-bmp180': [{ id: 'VIN' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }],
    'wokwi-bmp180-breakout': [{ id: 'VIN' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }],
    'openhw-bmp180-breakout': [{ id: 'VIN' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }],
    'wokwi-ds1307-rtc': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'openhw-ds1307-rtc': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'wokwi-hc-sr04': [{ id: 'VCC' }, { id: 'TRIG' }, { id: 'ECHO' }, { id: 'GND' }],
    'openhw-hc-sr04': [{ id: 'VCC' }, { id: 'TRIG' }, { id: 'ECHO' }, { id: 'GND' }],
    'wokwi-mpu6050': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }, { id: 'XDA' }, { id: 'XCL' }, { id: 'ADO' }, { id: 'INT' }],
    'openhw-mpu6050': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }, { id: 'XDA' }, { id: 'XCL' }, { id: 'ADO' }, { id: 'INT' }],
    'wokwi-nlsf595': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SER' }, { id: 'SRCLK' }, { id: 'RCLK' }, { id: 'OE' }, { id: 'SRCLR' }, { id: 'Q0' }, { id: 'Q1' }, { id: 'Q2' }, { id: 'Q3' }, { id: 'Q4' }, { id: 'Q5' }, { id: 'Q6' }, { id: 'Q7' }, { id: 'Q7S' }],
    'openhw-nlsf595': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SER' }, { id: 'SRCLK' }, { id: 'RCLK' }, { id: 'OE' }, { id: 'SRCLR' }, { id: 'Q0' }, { id: 'Q1' }, { id: 'Q2' }, { id: 'Q3' }, { id: 'Q4' }, { id: 'Q5' }, { id: 'Q6' }, { id: 'Q7' }, { id: 'Q7S' }],
    'wokwi-relay-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'IN' }, { id: 'NO' }, { id: 'NC' }, { id: 'COM' }],
    'openhw-relay-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'IN' }, { id: 'NO' }, { id: 'NC' }, { id: 'COM' }],
    'wokwi-stepper-motor': [{ id: 'A+' }, { id: 'A-' }, { id: 'B+' }, { id: 'B-' }],
    'openhw-stepper-motor': [{ id: 'A+' }, { id: 'A-' }, { id: 'B+' }, { id: 'B-' }],
    'wokwi-arduino-mega': [{ id: 'D0' }, { id: 'RX0' }, { id: 'D1' }, { id: 'TX0' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'D8' }, { id: 'D9' }, { id: 'D10' }, { id: 'D11' }, { id: 'D12' }, { id: 'D13' }, { id: 'D14' }, { id: 'TX3' }, { id: 'D15' }, { id: 'RX3' }, { id: 'D16' }, { id: 'TX2' }, { id: 'D17' }, { id: 'RX2' }, { id: 'D18' }, { id: 'TX1' }, { id: 'D19' }, { id: 'RX1' }, { id: 'D20' }, { id: 'SDA' }, { id: 'D21' }, { id: 'SCL' }, { id: 'D22' }, { id: 'D23' }, { id: 'D24' }, { id: 'D25' }, { id: 'D26' }, { id: 'D27' }, { id: 'D28' }, { id: 'D29' }, { id: 'D30' }, { id: 'D31' }, { id: 'D32' }, { id: 'D33' }, { id: 'D34' }, { id: 'D35' }, { id: 'D36' }, { id: 'D37' }, { id: 'D38' }, { id: 'D39' }, { id: 'D40' }, { id: 'D41' }, { id: 'D42' }, { id: 'D43' }, { id: 'D44' }, { id: 'D45' }, { id: 'D46' }, { id: 'D47' }, { id: 'D48' }, { id: 'D49' }, { id: 'D50' }, { id: 'MISO' }, { id: 'D51' }, { id: 'MOSI' }, { id: 'D52' }, { id: 'SCK' }, { id: 'D53' }, { id: 'SS' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: 'A8' }, { id: 'A9' }, { id: 'A10' }, { id: 'A11' }, { id: 'A12' }, { id: 'A13' }, { id: 'A14' }, { id: 'A15' }, { id: '5V' }, { id: '3V3' }, { id: 'GND' }, { id: 'GND.1' }, { id: 'GND.2' }, { id: 'RST' }, { id: 'VIN' }, { id: 'AREF' }, { id: 'IORF' }],
    'openhw-arduino-mega': [{ id: 'D0' }, { id: 'RX0' }, { id: 'D1' }, { id: 'TX0' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'D8' }, { id: 'D9' }, { id: 'D10' }, { id: 'D11' }, { id: 'D12' }, { id: 'D13' }, { id: 'D14' }, { id: 'TX3' }, { id: 'D15' }, { id: 'RX3' }, { id: 'D16' }, { id: 'TX2' }, { id: 'D17' }, { id: 'RX2' }, { id: 'D18' }, { id: 'TX1' }, { id: 'D19' }, { id: 'RX1' }, { id: 'D20' }, { id: 'SDA' }, { id: 'D21' }, { id: 'SCL' }, { id: 'D22' }, { id: 'D23' }, { id: 'D24' }, { id: 'D25' }, { id: 'D26' }, { id: 'D27' }, { id: 'D28' }, { id: 'D29' }, { id: 'D30' }, { id: 'D31' }, { id: 'D32' }, { id: 'D33' }, { id: 'D34' }, { id: 'D35' }, { id: 'D36' }, { id: 'D37' }, { id: 'D38' }, { id: 'D39' }, { id: 'D40' }, { id: 'D41' }, { id: 'D42' }, { id: 'D43' }, { id: 'D44' }, { id: 'D45' }, { id: 'D46' }, { id: 'D47' }, { id: 'D48' }, { id: 'D49' }, { id: 'D50' }, { id: 'MISO' }, { id: 'D51' }, { id: 'MOSI' }, { id: 'D52' }, { id: 'SCK' }, { id: 'D53' }, { id: 'SS' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: 'A8' }, { id: 'A9' }, { id: 'A10' }, { id: 'A11' }, { id: 'A12' }, { id: 'A13' }, { id: 'A14' }, { id: 'A15' }, { id: '5V' }, { id: '3V3' }, { id: 'GND' }, { id: 'GND.1' }, { id: 'GND.2' }, { id: 'RST' }, { id: 'VIN' }, { id: 'AREF' }, { id: 'IORF' }],
    'wokwi-attiny85': [{ id: 'PB0' }, { id: 'PB1' }, { id: 'PB2' }, { id: 'PB3' }, { id: 'PB4' }, { id: 'PB5' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-attiny85': [{ id: 'PB0' }, { id: 'PB1' }, { id: 'PB2' }, { id: 'PB3' }, { id: 'PB4' }, { id: 'PB5' }, { id: 'VCC' }, { id: 'GND' }],
    'openhw-pico': PICO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-pico-w': PICO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-photoresistor': [{ id: '1' }, { id: '2' }],
    'openhw-ntc-thermistor': [{ id: '1' }, { id: '2' }],
    'openhw-ntc-temperature-sensor': [{ id: 'VCC' }, { id: 'GND' }, { id: 'OUT' }],
    'wokwi-battery': [{ id: 'VCC' }, { id: 'GND' }],
    'openhw-battery': [{ id: 'VCC' }, { id: 'GND' }],
    'openhw-charger': [{ id: 'VIN+' }, { id: 'VIN-' }, { id: 'BAT+' }, { id: 'BAT-' }],
    'openhw-breadboard-mini': [{ id: 'a1' }, { id: 'b1' }, { id: 'c1' }, { id: 'd1' }, { id: 'e1' }, { id: 'f1' }, { id: 'g1' }, { id: 'h1' }, { id: 'i1' }, { id: 'j1' }],
    'openhw-neopixel-ring': [{ id: 'DIN' }, { id: 'VDD' }, { id: 'VSS' }, { id: 'DOUT' }],
    'openhw-arduino-sensor-shield': [{ id: 'VCC' }, { id: 'GND' }, { id: 'S' }],
    'openhw-simulation-monitor': [{ id: 'VCC' }, { id: 'GND' }, { id: 'TX' }, { id: 'RX' }],
    'wokwi-ds18b20': [{ id: 'GND' }, { id: 'DQ' }, { id: 'VDD' }],
    'openhw-ds18b20': [{ id: 'GND' }, { id: 'DQ' }, { id: 'VDD' }],
    'wokwi-ir-receiver': [{ id: 'OUT' }, { id: 'GND' }, { id: 'VCC' }],
    'openhw-ir-receiver': [{ id: 'OUT' }, { id: 'GND' }, { id: 'VCC' }],
    'wokwi-mfrc522': [{ id: '3V3' }, { id: 'RST' }, { id: 'GND' }, { id: 'IRQ' }, { id: 'MISO' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'SDA' }],
    'openhw-ks2e-m-dc5': [
  { id: 'COIL1' }, { id: 'COIL2' },
  { id: 'P1' }, { id: 'NC1' }, { id: 'NO1' },
  { id: 'P2' }, { id: 'NC2' }, { id: 'NO2' }
],
    'openhw-mfrc522': [{ id: '3V3' }, { id: 'RST' }, { id: 'GND' }, { id: 'IRQ' }, { id: 'MISO' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'SDA' }],

    // Custom sensors
    'DHT-22':                [{ id: 'VCC' }, { id: 'DATA' }, { id: 'NC' }, { id: 'GND' }],
    'openhw-dht22':          [{ id: 'VCC' }, { id: 'DATA' }, { id: 'NC' }, { id: 'GND' }],
    'MQ-2 Gas Sensor':       [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }],
    'openhw-mq2-gas-sensor': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }],
    'wokwi-pir-motion-sensor':  [{ id: 'VCC' }, { id: 'OUT' }, { id: 'GND' }],
    'openhw-pir-motion-sensor': [{ id: 'VCC' }, { id: 'OUT' }, { id: 'GND' }],
    'wokwi-raindrop-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }, { id: 'PAD+' }, { id: 'PAD-' }],
    'wokwi-raindrop-pad':    [{ id: 'AOUT' }, { id: 'GND' }],
};

export type RP2040ExecutableRangeInput =
    | [number | string, number | string]
    | { start: number | string; end: number | string }
    | { start: number | string; size: number | string };

export type RP2040FlashPartitionInput = {
    offset: number | string;
    data: string | Uint8Array | ArrayBuffer | ArrayLike<number>;
    encoding?: 'base64' | 'hex' | 'utf8';
};

export type RP2040ExecutableRange = {
    start: number;
    end: number;
    description?: string;
};

export type RP2040FlashPartition = {
    offset: number;
    bytes: Uint8Array;
};

export type RP2040FirmwareLoadOptions = {
    logicalFlashBytes?: number;
    partitions?: RP2040FlashPartition[];
};

export type AVRRunnerOptions = {
    boardId?: string;
    onByteTransmit?: (payload: { boardId: string; value: number; char: string; source?: string }) => void;
    serialBaudRate?: number;
    debugEnabled?: boolean;
    debugIntervalMs?: number;
    speed?: number;
    rp2040ExecutableRanges?: RP2040ExecutableRangeInput[];
    rp2040LogicalFlashBytes?: number | string;
    rp2040FlashPartitions?: RP2040FlashPartitionInput[];
    solverMode?: 'logic';
    sab?: SharedArrayBuffer;
    sabOffsets?: Record<string, number>; // componentId → slot index (sab/layout.ts)
    cmdBuffer?: SharedArrayBuffer; // main→worker command ring (sab/layout.ts)
    evtBuffer?: SharedArrayBuffer; // worker→main event ring (sab/layout.ts)
};

/**
 * BoardDriver (§10.9 step 2): the clean tick contract AVR / RP2040 / proxy
 * runners implement. One shared loop shape: drain commands → CPU budget →
 * hooks → update → physics → publish. Debug + SAB writers ride the same
 * hooks on every driver (no per-runner special cases on the control plane).
 */
export type BoardRunner = {
    cpu: any;
    boardId: string;
    instances: Map<string, BaseComponent>;
    stop: () => void;
    reset?: () => void;
    pause?: () => void;
    resume?: () => void;
    stepCycles?: (n: number) => number;
    getDebugSnapshot?: () => any;
    readMem?: (addr: number, len: number) => Uint8Array | null;
    addPinWatch?: (pin: string, expectHigh?: boolean) => void;
    removePinWatch?: (pin: string) => void;
    serialRx: (data: string) => void;
    serialRxByte: (value: number) => void;
    serialRxByteFromSource?: (value: number, source?: string) => void;
    softSerialRxByte?: (value: number) => void;
    setSerialBaudRate: (baud: number) => void;
    getSerialBaudRate: () => number;
    setSpeed: (speed: number) => void;
    solverMode: 'logic';
    setSolverMode: (mode: 'logic') => void;
    setTelemetryEnabled: (enabled: boolean) => void;
    getRichTelemetrySnapshot: (options?: { mode?: 'standard' | 'deep' | 'delta' }) => any;
    getSimulatedTimeMs: () => number;
    forceEmitState?: () => void;
    writeDirectMemory?: (address: number, data: Uint8Array) => void;
    readDirectMemory?: (address: number, length: number) => Uint8Array | null;
    running?: boolean;
};

export type ConnectedComponentPin = {
    inst: BaseComponent;
    pinId: string;
};

/**
 * ComponentSignalAPI
 *
 * Formal TypeScript interface for every signal callback a component can implement.
 * Runners cast component instances against
 * this interface before dispatching signals, e.g.:
 *
 *   const api = inst as unknown as ComponentSignalAPI;
 *   if (typeof api.onCanFrame === 'function') api.onCanFrame(id, dlc, data);
 *
 * All methods are optional — implement only what your component handles.
 * Unimplemented callbacks are silently ignored by the runners.
 */
export interface ComponentSignalAPI {
    // ── GPIO ────────────────────────────────────────────────────────────────
    /** Called when a digital GPIO pin driven by firmware changes state */
    setState?(state: { voltage?: number; digital?: boolean; value?: number }): void;
    /** Called per-pin when a voltage level changes (driven by wire physics) */
    onVoltageChange?(pinId: string, voltage: number): void;

    // ── Analog / DAC ────────────────────────────────────────────────────────
    /** Called when the firmware sets an analog voltage on a pin (DAC / analogWrite via physics) */
    onAnalogVoltage?(pinId: string, voltage: number): void;

    // ── PWM / LEDC ──────────────────────────────────────────────────────────
    /** Called when a PWM duty cycle is applied to a connected pin (0.0 – 1.0) */
    onPwmDuty?(pinId: string, duty_pct: number): void;

    // ── TONE (buzzer, speaker, piezo) ────────────────────────────────────────
    /** Called when tone(pin, freq, dur) is invoked. frequency=0 means noTone(). */
    onTone?(pin: string, frequency: number, duration: number): void;

    // ── I2C ─────────────────────────────────────────────────────────────────
    /** Called for an I2C write transaction. Return response bytes if any. */
    onI2CWrite?(addr: number, data: number[]): number[] | void;
    /** Called for an I2C read request. Return the requested number of bytes. */
    onI2CRead?(addr: number, qty: number): number[];

    // ── SPI ─────────────────────────────────────────────────────────────────
    /** Called for each SPI byte transfer. Return the MISO byte (or 0xFF). */
    onSPIByte?(byte: number): number;
    /** Called for an SPI buffer transfer (SPIBUF frame). Return response bytes. */
    onSPIBuffer?(data: number[]): number[] | void;

    // ── Serial / UART ────────────────────────────────────────────────────────
    /** Called when a connected serial source sends data to the firmware's UART RX */
    onSerialData?(data: string): void;

    // ── WS2812 / NeoPixel ───────────────────────────────────────────────────
    /** Called when a NeoPixel strip pixel array is updated */
    updatePixels?(pixels: Array<{ r: number; g: number; b: number; w?: number }>): void;
    /** Called for each individual WS2812B bit (used by raw-protocol components) */
    onWS2812BByte?(byte: number): void;

    // ── TWAI / CAN Bus ───────────────────────────────────────────────────────
    /** Called when the firmware transmits a CAN frame on the TWAI bus */
    onCanFrame?(id: number, dlc: number, data: number[]): void;

    // ── RMT / IR ────────────────────────────────────────────────────────────
    /** Called when the firmware transmits an RMT pulse train */
    onRmtPulse?(pulses: Array<{ level: number; duration: number }>): void;
    /** Alias used by IR-specific components (IR receiver, IR blaster) */
    onInfraredSignal?(pulses: Array<{ level: number; duration: number }>): void;

    // ── PCNT (Pulse Counter) ─────────────────────────────────────────────────
    /** Called when the firmware reads or resets a pulse counter unit */
    onPulseCount?(unit: number, count: number): void;

    // ── 1-Wire ──────────────────────────────────────────────────────────────
    /** Called during a 1-Wire read. Return the data bytes (e.g. temperature). */
    onOneWireRead?(): number[];

    // ── Deep Sleep / Wake ────────────────────────────────────────────────────
    /** Called when the firmware enters deep or light sleep */
    onDeviceSleep?(duration_us: number): void;
    /** Called when the simulated sleep period expires and the device wakes */
    onDeviceWake?(): void;

    // ── I2S Audio (PCM5102, MAX98357, INMP441, SPH0645) ───────────────────────
    /**
     * Called when firmware writes PCM samples via i2s_write() / sim_i2s_write().
     * @param samples  Float32 PCM samples, already normalised to [-1, 1]
     * @param sampleRate  Sample rate in Hz (e.g. 44100, 22050)
     * @param port  I2S port number (0 or 1)
     *
     * Implement on a DAC/amplifier component (PCM5102, MAX98357) to receive audio
     * frames and play them via Web Audio API.
     * For microphone components (INMP441, SPH0645) implement onMicrophoneRequest
     * instead and return PCM bytes for the firmware to receive via i2s_read().
     */
    onI2SData?(samples: Float32Array, sampleRate: number, port: number): void;

    /**
     * Called when the firmware requests microphone data (sim_i2s_read / i2s_read).
     * Return Int16 PCM bytes that will be injected back to the firmware.
     * Leave unimplemented to return silence.
     */
    onMicrophoneRequest?(sampleCount: number, sampleRate: number): Int16Array | null;

    // ── Camera ───────────────────────────────────────────────────────────────
    /**
     * Called when a JPEG camera frame is available (e.g. from device webcam).
     * Implement on an ESP32-CAM component to display the frame.
     * Note: currently the webcam stream is pushed directly via useEsp32Engine.js;
     * this callback is reserved for future wire-routed camera simulation.
     */
    onCameraFrame?(jpeg: Uint8Array, width: number, height: number): void;
}

export type FallbackTelemetryRuntime = {
    createdAtMs: number;
    sampleCount: number;
    stateMutationCount: number;
    lastStateFingerprint: string;
    lastReportedFingerprint?: string;
    lastStateChangeAtMs: number;
    pinLevelMap: Record<string, boolean>;
    pinToggleCount: number;
};

export const SOFT_SERIAL_SOURCE_LABELS = new Set(['softserial', 'soft-serial', 'soft_uart', 'soft-uart', 'softuart']);
export const NEOPIXEL_COMPONENT_TYPE_PATTERN = /(neopixel|ws2812|ws2821)/i;

export function parseAddressValue(raw: unknown): number | null {
    if (typeof raw === 'number') {
        if (!Number.isFinite(raw)) return null;
        const clamped = Math.max(0, Math.min(0xffffffff, Math.floor(raw)));
        return clamped >>> 0;
    }

    if (typeof raw === 'string') {
        const value = raw.trim();
        if (!value) return null;
        const parsed = /^0x[0-9a-f]+$/i.test(value)
            ? parseInt(value, 16)
            : Number(value);
        if (!Number.isFinite(parsed)) return null;
        const clamped = Math.max(0, Math.min(0xffffffff, Math.floor(parsed)));
        return clamped >>> 0;
    }

    return null;
}

export function normalizeRp2040ExecutableRanges(value: unknown): RP2040ExecutableRange[] {
    if (!Array.isArray(value)) return [];
    const ranges: RP2040ExecutableRange[] = [];

    for (const raw of value) {
        let start: number | null = null;
        let end: number | null = null;

        if (Array.isArray(raw) && raw.length >= 2) {
            start = parseAddressValue(raw[0]);
            end = parseAddressValue(raw[1]);
        } else if (raw && typeof raw === 'object') {
            const obj = raw as Record<string, unknown>;
            start = parseAddressValue(obj.start);

            if (Object.prototype.hasOwnProperty.call(obj, 'end')) {
                end = parseAddressValue(obj.end);
            } else if (Object.prototype.hasOwnProperty.call(obj, 'size')) {
                const size = parseAddressValue(obj.size);
                if (start !== null && size !== null && size > 0) {
                    const rawEnd = Number(start) + Number(size) - 1;
                    end = Math.max(0, Math.min(0xffffffff, Math.floor(rawEnd))) >>> 0;
                }
            }
        }

        if (start === null || end === null || end < start) {
            continue;
        }

        ranges.push({ start: start >>> 0, end: end >>> 0 });
    }

    return ranges;
}

export function decodeHexToBytes(hex: string): Uint8Array {
    const normalized = String(hex || '')
        .trim()
        .replace(/^0x/i, '')
        .replace(/\s+/g, '');

    if (!normalized || (normalized.length % 2) !== 0) {
        return new Uint8Array();
    }

    const out = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < out.length; i++) {
        const byte = Number.parseInt(normalized.slice(i * 2, (i * 2) + 2), 16);
        if (Number.isNaN(byte)) {
            return new Uint8Array();
        }
        out[i] = byte & 0xff;
    }

    return out;
}

export function decodeBase64ToBytes(base64: string): Uint8Array {
    const normalized = String(base64 || '').replace(/\s+/g, '');
    const binary = atob(normalized);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) & 0xff;
    return out;
}

export function decodeRp2040FlashPartitionBytes(data: unknown, encoding: unknown): Uint8Array | null {
    if (data == null) return null;

    if (data instanceof Uint8Array) {
        return data.length > 0 ? data : null;
    }

    if (data instanceof ArrayBuffer) {
        const out = new Uint8Array(data);
        return out.length > 0 ? out : null;
    }

    if (ArrayBuffer.isView(data)) {
        const view = data as ArrayBufferView;
        const out = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        return out.length > 0 ? out : null;
    }

    if (Array.isArray(data)) {
        if (data.length === 0) return null;
        return new Uint8Array(data.map((value) => Number(value) & 0xff));
    }

    if (typeof data === 'string') {
        const raw = data.trim();
        if (!raw) return null;

        const normalizedEncoding = String(encoding || '').trim().toLowerCase();
        if (normalizedEncoding === 'hex') {
            const decoded = decodeHexToBytes(raw);
            return decoded.length > 0 ? decoded : null;
        }

        if (normalizedEncoding === 'utf8') {
            const decoded = new TextEncoder().encode(data);
            return decoded.length > 0 ? decoded : null;
        }

        try {
            const decoded = decodeBase64ToBytes(raw);
            return decoded.length > 0 ? decoded : null;
        } catch (e) {
            // If string is not valid base64, preserve raw text bytes for robustness.
            const fallback = new TextEncoder().encode(data);
            return fallback.length > 0 ? fallback : null;
        }
    }

    return null;
}

export function normalizeRp2040FlashPartitions(value: unknown): RP2040FlashPartition[] {
    if (!Array.isArray(value)) return [];

    const partitions: RP2040FlashPartition[] = [];
    for (const raw of value) {
        if (!raw || typeof raw !== 'object') continue;
        const obj = raw as Record<string, unknown>;
        const offset = parseAddressValue(obj.offset);
        if (offset === null) continue;

        const bytes = decodeRp2040FlashPartitionBytes(obj.data, obj.encoding);
        if (!bytes || bytes.length === 0) continue;

        partitions.push({ offset: offset >>> 0, bytes });
    }

    partitions.sort((a, b) => a.offset - b.offset);
    return partitions;
}

export function getInternalBridgesForComponent(compId: string, type: string): string[][] {
    const bridges: string[][] = [];
    if (type === 'openhw-resistor' || type === 'wokwi-resistor' || type === 'via' || type === 'openhw-via' || type === 'wokwi-via' || type === 'openhw-wire' || type === 'wokwi-wire') {
        bridges.push([`${compId}:p1`, `${compId}:p2`]);
    } else if (type === 'openhw-breadboard' || type === 'openhw-breadboard-half' || type === 'openhw-breadboard-mini' || type === 'wokwi-breadboard' || type === 'wokwi-breadboard-half' || type === 'wokwi-breadboard-mini') {
        const isHalf = type.includes('half');
        const isMini = type.includes('mini');
        const maxRow = isMini ? 17 : (isHalf ? 30 : 63);
        const maxRail = isMini ? 0 : (isHalf ? 25 : 50);

        // Rows connections (a-e and f-j are separate blocks)
        for (let r = 1; r <= maxRow; r++) {
            const left = ['a', 'b', 'c', 'd', 'e'];
            for (let i = 0; i < left.length - 1; i++) {
                bridges.push([`${compId}:${r}${left[i]}`, `${compId}:${r}${left[i + 1]}`]);
            }
            const right = ['f', 'g', 'h', 'i', 'j'];
            for (let i = 0; i < right.length - 1; i++) {
                bridges.push([`${compId}:${r}${right[i]}`, `${compId}:${r}${right[i + 1]}`]);
            }
        }

        // Power rail connections (top and bottom, vcc and gnd)
        const rails = ['top_vcc', 'top_gnd', 'bottom_vcc', 'bottom_gnd'];
        for (const rail of rails) {
            for (let i = 1; i < maxRail; i++) {
                bridges.push([`${compId}:${rail}_${i}`, `${compId}:${rail}_${i + 1}`]);
            }
        }
    }
    return bridges;
}

export function parsePositiveInt(value: any): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function collectNeopixelShutdownStates(instances: Map<string, BaseComponent>): Array<{ id: string; state: any }> {
    const updates: Array<{ id: string; state: any }> = [];

    for (const inst of instances.values()) {
        if (!NEOPIXEL_COMPONENT_TYPE_PATTERN.test(String(inst.type || ''))) continue;

        const currentState = (inst.state && typeof inst.state === 'object') ? inst.state : {};
        const rows = parsePositiveInt(currentState.rows);
        const cols = parsePositiveInt(currentState.cols);
        const configuredCount = rows > 0 && cols > 0 ? rows * cols : 0;
        const existingPixels = Array.isArray(currentState.pixels) ? currentState.pixels : [];
        const pixelCount = Math.max(configuredCount, existingPixels.length);
        const nextState = {
            ...currentState,
            pixels: pixelCount > 0 ? new Array(pixelCount).fill(0) : [],
        };

        inst.state = nextState;
        inst.stateChanged = false;
        updates.push({ id: inst.id, state: nextState });
    }

    return updates;
}

export function isSoftSerialSourceLabel(source: string): boolean {
    const key = String(source || '').trim().toLowerCase();
    return SOFT_SERIAL_SOURCE_LABELS.has(key);
}

export function collectConnectedComponentPins(
    boardId: string,
    boardPinAliases: string[],
    wires: any[],
    instances: Map<string, BaseComponent>
): ConnectedComponentPin[] {
    const aliasSet = new Set(boardPinAliases.map((v) => String(v || '').toUpperCase()));
    const adjacency = new Map<string, Set<string>>();

    const connect = (a: string, b: string) => {
        if (!adjacency.has(a)) adjacency.set(a, new Set());
        if (!adjacency.has(b)) adjacency.set(b, new Set());
        adjacency.get(a)!.add(b);
        adjacency.get(b)!.add(a);
    };

    for (const wire of wires || []) {
        if (!wire?.from || !wire?.to) continue;
        connect(String(wire.from), String(wire.to));
    }

    for (const [id, inst] of instances.entries()) {
        if (inst.type === 'openhw-resistor' || inst.type === 'wokwi-resistor') {
            connect(`${id}:p1`, `${id}:p2`);
        }
    }

    const startNodes: string[] = [];
    for (const node of adjacency.keys()) {
        const [compId, pinId] = String(node).split(':');
        if (compId !== boardId) continue;
        if (aliasSet.has(String(pinId || '').toUpperCase())) {
            startNodes.push(node);
        }
    }

    if (!startNodes.length) return [];

    const visited = new Set<string>();
    const queue = [...startNodes];
    startNodes.forEach((n) => visited.add(n));

    while (queue.length > 0) {
        const node = queue.shift()!;
        for (const n of adjacency.get(node) || []) {
            if (visited.has(n)) continue;
            visited.add(n);
            queue.push(n);
        }
    }

    const out = new Map<string, ConnectedComponentPin>();
    for (const node of visited) {
        const [compId, pinId] = String(node).split(':');
        if (!compId || compId === boardId) continue;
        const inst = instances.get(compId);
        if (!inst) continue;
        if (inst.type === 'openhw-resistor' || inst.type === 'wokwi-resistor') continue;
        out.set(`${compId}:${pinId}`, { inst, pinId });
    }

    return Array.from(out.values());
}

export function invokeOptional(inst: any, names: string[], args: any[]): any {
    for (const name of names) {
        const fn = inst?.[name];
        if (typeof fn === 'function') {
            return fn.apply(inst, args);
        }
    }
    return undefined;
}

export function resolveLogicClass(type: string): any {
    if (LOGIC_REGISTRY[type]) return LOGIC_REGISTRY[type];

    const pins = (COMPONENT_PINS[type] || []).map((p: any) => String(p.id).toUpperCase());

    // I2S: BCLK + WS/LRCK + data pin
    const hasI2S = pins.some((p: string) => ['BCK', 'BCLK'].includes(p))
        && pins.some((p: string) => ['LRCK', 'WS', 'LRC', 'LRCLK'].includes(p));
    if (hasI2S) return I2SProtocol;

    if (pins.includes('SDA') && pins.includes('SCL')) return I2CProtocol;
    if (pins.some((p: string) => ['MOSI', 'DIN', 'SDI', 'MISO'].includes(p))) return SPIProtocol;
    if (pins.some((p: string) => ['PWM', 'SIG'].includes(p))) return PWMProtocol;
    if (pins.some((p: string) => ['TX', 'TXD', 'RX', 'RXD'].includes(p))) return UARTProtocol;
    if (pins.some((p: string) => ['DQ', 'DATA'].includes(p))) return OneWireProtocol;
    if (pins.some((p: string) => ['AO', 'AOUT'].includes(p))) return AnalogProtocol;

    return BaseComponent;
}

export const MEDIUM_COMPONENT_STATE_WEIGHT = 2_048;
export const HEAVY_COMPONENT_STATE_WEIGHT = 8_192;
export const MEDIUM_COMPONENT_MIN_SYNC_MS = 55;
export const HEAVY_COMPONENT_MIN_SYNC_MS = 95;

export function estimateStatePayloadWeight(value: any, depth = 0): number {
    if (value == null) return 0;

    if (typeof value === 'string') return value.length;
    if (typeof value === 'number' || typeof value === 'boolean') return 8;

    if (ArrayBuffer.isView(value)) {
        return Number((value as any)?.byteLength || (value as any)?.length || 0);
    }

    if (value instanceof ArrayBuffer) {
        return Number(value.byteLength || 0);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return 0;
        if (depth >= 2) return value.length;

        const sampleCount = Math.min(value.length, 16);
        let sampleWeight = 0;
        for (let i = 0; i < sampleCount; i++) {
            sampleWeight += estimateStatePayloadWeight(value[i], depth + 1);
        }
        const avg = sampleCount > 0 ? (sampleWeight / sampleCount) : 0;
        return Math.round(avg * value.length);
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.length === 0) return 0;
        if (depth >= 2) return entries.length * 12;

        let weight = 0;
        for (const [k, v] of entries) {
            weight += String(k || '').length;
            weight += estimateStatePayloadWeight(v, depth + 1);
        }
        return weight;
    }

    return 0;
}

export function getComponentStateSyncPolicy(state: any): { weight: number; minIntervalMs: number } {
    const weight = estimateStatePayloadWeight(state);
    if (weight >= HEAVY_COMPONENT_STATE_WEIGHT) {
        return { weight, minIntervalMs: HEAVY_COMPONENT_MIN_SYNC_MS };
    }
    if (weight >= MEDIUM_COMPONENT_STATE_WEIGHT) {
        return { weight, minIntervalMs: MEDIUM_COMPONENT_MIN_SYNC_MS };
    }
    return { weight, minIntervalMs: 0 };
}

export const fallbackTelemetryByInstance = new WeakMap<object, FallbackTelemetryRuntime>();

export function readComponentStateForTelemetry(inst: any): Record<string, unknown> {
    const state = inst?.state;
    if (state && typeof state === 'object' && !Array.isArray(state)) {
        return state as Record<string, unknown>;
    }
    if (state === undefined) return {};
    return { value: state as unknown };
}

export function safeJsonStringify(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch (e) {
        return '{}';
    }
}

export function readPinLevelMap(inst: any): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    const pins = inst?.pins && typeof inst.pins === 'object'
        ? (inst.pins as Record<string, unknown>)
        : null;
    if (!pins) return out;

    for (const [pinId, pinState] of Object.entries(pins)) {
        if (!pinState || typeof pinState !== 'object') continue;
        const maybeVoltage = Number((pinState as any).voltage);
        if (Number.isFinite(maybeVoltage)) {
            out[String(pinId)] = maybeVoltage > 0.5;
        }
    }

    return out;
}

export function isLikelyActiveSignal(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
    if (typeof value === 'string') {
        const key = value.trim().toLowerCase();
        if (!key) return false;
        return key !== '0' && key !== 'false' && key !== 'off' && key !== 'none' && key !== 'ok';
    }
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return false;
}

export function buildFallbackTelemetry(inst: any): { telemetrySummary: string; telemetryData: Record<string, unknown> } {
    const now = Date.now();
    const key = (inst && typeof inst === 'object') ? inst : { fallback: true };
    let runtime = fallbackTelemetryByInstance.get(key);
    if (!runtime) {
        runtime = {
            createdAtMs: now,
            sampleCount: 0,
            stateMutationCount: 0,
            lastStateFingerprint: '',
            lastReportedFingerprint: '',
            lastStateChangeAtMs: now,
            pinLevelMap: {},
            pinToggleCount: 0,
        };
        fallbackTelemetryByInstance.set(key, runtime);
    }

    runtime.sampleCount += 1;

    const state = readComponentStateForTelemetry(inst);
    const stateFingerprint = safeJsonStringify(state);
    if (runtime.lastStateFingerprint && runtime.lastStateFingerprint !== stateFingerprint) {
        runtime.stateMutationCount += 1;
        runtime.lastStateChangeAtMs = now;
    }
    if (!runtime.lastStateFingerprint) {
        runtime.lastStateChangeAtMs = now;
    }
    runtime.lastStateFingerprint = stateFingerprint;

    const nextPinLevels = readPinLevelMap(inst);
    let pinToggles = 0;
    const pinIds = new Set<string>([
        ...Object.keys(runtime.pinLevelMap),
        ...Object.keys(nextPinLevels),
    ]);
    for (const pinId of pinIds) {
        const prevLevel = runtime.pinLevelMap[pinId];
        const nextLevel = nextPinLevels[pinId];
        if (prevLevel === undefined || nextLevel === undefined) continue;
        if (prevLevel !== nextLevel) pinToggles += 1;
    }
    runtime.pinToggleCount += pinToggles;
    runtime.pinLevelMap = nextPinLevels;

    let status: 'ok' | 'warn' | 'error' = 'ok';
    const findings: string[] = [];
    for (const [stateKey, stateValue] of Object.entries(state)) {
        const lower = String(stateKey || '').toLowerCase();
        if (/(error|fault|burned|panic|critical|failed)/.test(lower) && isLikelyActiveSignal(stateValue)) {
            status = 'error';
            findings.push(`State flag ${stateKey} indicates an error condition.`);
            continue;
        }
        if (status !== 'error' && /(warn|degraded|timeout|retry|unstable)/.test(lower) && isLikelyActiveSignal(stateValue)) {
            status = 'warn';
            findings.push(`State flag ${stateKey} indicates a warning condition.`);
        }
    }

    const elapsedSec = Math.max(0.001, (now - runtime.createdAtMs) / 1000);
    const updateFreqHz = Number((runtime.sampleCount / elapsedSec).toFixed(2));
    const idleMs = Math.max(0, now - runtime.lastStateChangeAtMs);
    const summary = findings.length > 0
        ? `${status.toUpperCase()}: ${findings[0]}`
        : `OK: stateKeys=${Object.keys(state).slice(0, 8).join(', ') || 'none'}`;

    const isDelta = runtime.lastReportedFingerprint !== stateFingerprint;
    runtime.lastReportedFingerprint = stateFingerprint;

    const telemetryData: Record<string, unknown> = {
        ...state,
        delta: isDelta,
        _metrics: {
            sampleCount: runtime.sampleCount,
            updateFreqHz,
            stateSizeBytes: stateFingerprint.length,
            stateMutationCount: runtime.stateMutationCount,
            idleMs,
            pinToggleCount: runtime.pinToggleCount,
            pinCount: Object.keys(nextPinLevels).length,
        },
        _heuristics: {
            status,
            summary,
            findings,
        },
        _capturedAt: new Date(now).toISOString(),
        _fallbackGenerated: true,
    };

    return {
        telemetrySummary: summary,
        telemetryData,
    };
}

let realCanvasFps = 60;
let realUiBlockedMs = 0;

export function setRealMetrics(fps: number, blockedMs: number) {
    realCanvasFps = fps;
    realUiBlockedMs = blockedMs;
}

export function getUnifiedComponentSyncState(inst: BaseComponent): any {
    const subclassSyncState = inst.getSyncState() || {};
    const baseSyncState = BaseComponent.prototype.getSyncState.call(inst) || {};
    return {
        ...baseSyncState,
        ...subclassSyncState
    };
}

export function collectComponentTelemetry(inst: any, optionsMode?: string, cpu?: any): any {
    if (inst?.type === 'openhw-simulation-monitor' && typeof inst.updateMetrics === 'function') {
        const targetFreq = (cpu as any)?.clock?.frequency || (cpu as any)?.freq || 16_000_000;
        inst.updateMetrics(cpu?.cycles || 0, targetFreq, inst.telemetryEnabled, inst.telemetryWatchedParams || ['all'], realCanvasFps, realUiBlockedMs);
    }

    if (!inst.telemetryEnabled) {
        return {};
    }

    const effectiveMode = optionsMode || inst.telemetryMode || 'detail';

    let cachedDeltaData: any = null;

    // 👑 YOUR OPTIMIZATION: If Delta mode is active and nothing changed, 
    // instantly return delta: false without building or sending ANY metric payloads!
    if (effectiveMode === 'delta' && typeof inst?.getDeltaMetrics === 'function') {
        cachedDeltaData = inst.getDeltaMetrics(inst.telemetryWatchedParams);
        if (cachedDeltaData && !cachedDeltaData.delta) {
            return { delta: false }; // Ultra-fast early return! Strips out massive telemetryData tree.
        }
    }

    const out: any = {};
    const state = inst.state || {};

    // Map electrical states for Nodal Analysis Telemetry
    if (state.vHistory) out.vHistory = state.vHistory;
    if (state.voltageDrop !== undefined) out.voltageDrop = state.voltageDrop;
    if (state.current !== undefined) out.current = state.current;
    if (state.power !== undefined) out.power = state.power;
    if (state.glow !== undefined) out.glow = state.glow;

    try {
        if (effectiveMode === 'delta' && cachedDeltaData && typeof cachedDeltaData === 'object') {
            out.telemetryData = cachedDeltaData as Record<string, unknown>;
            out.delta = !!cachedDeltaData.delta;
        } else if (effectiveMode === 'simple' && typeof inst?.getTelemetrySummary === 'function') {
            const summaryData = inst.getTelemetrySummary();
            if (typeof summaryData === 'string' && summaryData.trim()) {
                out.telemetrySummary = summaryData.trim();
                out.telemetryData = { state: inst.state || {} };
            }
        } else if (typeof inst?.getRawMetrics === 'function') {
            const rawData = inst.getRawMetrics();
            if (rawData && typeof rawData === 'object') {
                out.telemetryData = rawData as Record<string, unknown>;
            }
        } else if (typeof inst?.getTelemetryData === 'function') {
            const data = inst.getTelemetryData();
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                out.telemetryData = data as Record<string, unknown>;
            }
        }
    } catch (e) {
        // Telemetry failures should never break simulation state delivery.
    }

    // T4 (§12.3): single telemetry build — primary OR fallback, never both.
    // getRawMetrics/getDeltaMetrics/getTelemetryData already embed
    // metrics+heuristics+capturedAt, so a complete primary skips the fallback
    // entirely (saves 1 JSON fingerprint + 1 state scan per component/flush).
    // Exception by design: simple-mode light primary ({state} only) is NOT
    // complete and still takes the fallback supplement below.
    const tdAny = out.telemetryData as any;
    const primaryComplete = !!tdAny && typeof tdAny === 'object'
        && !!(tdAny.metrics || tdAny._metrics);
    const primaryHeuristicSummary: string | null =
        (tdAny && typeof tdAny === 'object')
            ? (tdAny?.heuristics?.summary || tdAny?._heuristics?.summary || null)
            : null;

    if (!out.telemetrySummary) {
        if (primaryHeuristicSummary) {
            // Reuse the heuristics summary the primary already computed —
            // avoids a second getTelemetrySummary() → applyHeuristics() pass.
            out.telemetrySummary = primaryHeuristicSummary;
        } else {
            try {
                if (typeof inst?.getTelemetrySummary === 'function') {
                    const summary = inst.getTelemetrySummary();
                    if (typeof summary === 'string' && summary.trim()) {
                        out.telemetrySummary = summary.trim();
                    }
                }
            } catch (e) {
                // Telemetry failures should never break simulation state delivery.
            }
        }
    }

    if (!primaryComplete) {
        const fallback = buildFallbackTelemetry(inst);

        if (effectiveMode === 'delta' && out.delta === undefined) {
            if (!fallback.telemetryData.delta) {
                return { delta: false }; // Ultra-fast early return for fallback components!
            }
            out.delta = true;
        }

        if (!out.telemetrySummary) {
            out.telemetrySummary = fallback.telemetrySummary;
        }

        if (!out.telemetryData || typeof out.telemetryData !== 'object') {
            out.telemetryData = fallback.telemetryData;
        } else {
            const merged = { ...out.telemetryData };
            if (!merged._metrics) {
                merged._metrics = fallback.telemetryData._metrics;
            }
            if (!merged._heuristics) {
                merged._heuristics = fallback.telemetryData._heuristics;
            }
            if (!merged._capturedAt) {
                merged._capturedAt = fallback.telemetryData._capturedAt;
            }
            if (!merged._fallbackGenerated) {
                merged._fallbackGenerated = true;
            }
            out.telemetryData = merged;
        }
    }

    if (inst.deepSiliconEnabled && cpu && (inst.type.includes('arduino') || inst.type.includes('pico') || inst.type.includes('attiny'))) {
        const watched = inst.telemetryWatchedParams || ['all'];
        const watchAll = watched.includes('all');
        const watchReg = watchAll || watched.includes('deepSiliconRegisters');
        const watchSram = watchAll || watched.includes('deepSiliconSRAM');
        const watchTimers = watchAll || watched.includes('deepSiliconTimers');
        const watchPower = watchAll || watched.includes('deepSiliconPower');
        const watchIrq = watchAll || watched.includes('deepSiliconInterrupts');

        if (watchReg || watchSram || watchTimers || watchPower || watchIrq) {
            try {
                const deepObj: any = {};

                if (watchReg) {
                    const registers: any = {};
                    if (cpu.pc !== undefined) registers.pc = cpu.pc;
                    if (cpu.sp !== undefined) registers.sp = cpu.sp;
                    if (cpu.sreg !== undefined) registers.sreg = cpu.sreg;
                    if (cpu.cycles !== undefined) registers.cycles = cpu.cycles;

                    if (cpu.core) {
                        if (cpu.core.pc !== undefined) registers.pc = cpu.core.pc;
                        if (cpu.core.sp !== undefined) registers.sp = cpu.core.sp;
                        if (cpu.core.cycles !== undefined) registers.cycles = cpu.core.cycles;
                    }
                    deepObj.registers = registers;
                }

                if (watchSram) {
                    if (cpu.data && typeof cpu.data.slice === 'function') {
                        deepObj.sramMap = Array.from(cpu.data.slice(0, 2048));
                    } else if (cpu.memory && typeof cpu.memory.slice === 'function') {
                        deepObj.sramMap = Array.from(cpu.memory.slice(0, 2048));
                    }
                }

                if (watchTimers) {
                    const timers: any = {};
                    if (cpu.timer0) timers.timer0 = { tcnt: cpu.timer0.tcnt, tccra: cpu.timer0.tccra, tccrb: cpu.timer0.tccrb };
                    if (cpu.timer1) timers.timer1 = { tcnt: cpu.timer1.tcnt, tccra: cpu.timer1.tccra, tccrb: cpu.timer1.tccrb };
                    if (cpu.timer2) timers.timer2 = { tcnt: cpu.timer2.tcnt, tccra: cpu.timer2.tccra, tccrb: cpu.timer2.tccrb };
                    if (cpu.timer && typeof cpu.timer.getTime === 'function') timers.time = cpu.timer.getTime();
                    else if (cpu.timer && cpu.timer.time !== undefined) timers.time = Number(cpu.timer.time);
                    deepObj.timers = timers;
                }

                if (watchPower) {
                    const power: any = {};
                    if (cpu.wdt) power.wdt = { enabled: !!cpu.wdt.enabled, timeout: cpu.wdt.timeout };
                    if (cpu.sleepMode !== undefined) power.sleepMode = cpu.sleepMode;
                    deepObj.power = power;
                }

                if (watchIrq) {
                    const interrupts: any = {};
                    if (cpu.sreg !== undefined) interrupts.globalEnabled = (cpu.sreg & 0x80) !== 0;
                    if (cpu.interrupts) interrupts.pending = cpu.interrupts.pending;
                    deepObj.interrupts = interrupts;
                }

                out.deepSilicon = deepObj;
            } catch (err) {
                console.warn('[Telemetry] Failed to extract deep silicon state:', err);
            }
        }
    }

    return out;
}
