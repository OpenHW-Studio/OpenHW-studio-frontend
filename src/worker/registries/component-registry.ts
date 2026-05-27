import { BaseComponent } from '@openhw/emulator';
import { LEDLogic } from '@openhw/emulator/src/components/openhw-led/logic';
import { UnoLogic } from '@openhw/emulator/src/components/openhw-arduino-uno/logic';
import { Esp32Logic } from '@openhw/emulator/src/components/ESP32/logic';
import { Esp32CamLogic } from '@openhw/emulator/src/components/openhw-esp32-cam/logic';
import { PicoLogic } from '../pico-logic';
import { ResistorLogic } from '@openhw/emulator/src/components/openhw-resistor/logic';
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
import { Wokwi7SegmentLogic } from '@openhw/emulator/src/components/openhw-7segment/logic';
import { ILI9341Logic } from '@openhw/emulator/src/components/openhw-ili9341/logic';
import { CD74HC4067Logic } from '@openhw/emulator/src/components/openhw-cd74hc4067/logic';
import { LogicAnalyzerLogic } from '@openhw/emulator/src/components/openhw-logic-analyzer/logic';
import { MegaLogic } from '@openhw/emulator/src/components/openhw-arduino-mega/logic';
import { DS18B20Logic } from '@openhw/emulator/src/components/openhw-ds18b20/logic';
import { IRReceiverLogic } from '@openhw/emulator/src/components/openhw-ir-receiver/logic';
import { MFRC522Logic } from '@openhw/emulator/src/components/openhw-mfrc522/logic';

import { PICO_BOARD_PINS, UNO_ANALOG_PINS, UNO_BOARD_PINS, UNO_DIGITAL_PINS } from '../board-profiles';

import {
    NotGateLogic, TwoInputGateLogic, AndGateLogic, NandGateLogic, NorGateLogic, XorGateLogic
} from '../protocol-handlers/gates';
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
    'wokwi-raspberry-pi-pico-w': PicoLogic,
    'openhw-raspberry-pi-pico-w': PicoLogic,
    'wokwi-resistor': ResistorLogic,
    'openhw-resistor': ResistorLogic,
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
    'wokwi-ldr-module': BaseComponent,
    'openhw-ldr-module': BaseComponent,
    'wokwi-7segment': BaseComponent,
    'openhw-7segment': BaseComponent,
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
    'wokwi-cd74hc4067': CD74HC4067Logic,
    'openhw-cd74hc4067': CD74HC4067Logic,
    'wokwi-logic-analyzer': SimulationMonitorLogic,
    'openhw-logic-analyzer': SimulationMonitorLogic,

    // I2S Audio Components
    'openhw-pcm5102': I2SProtocol,
    'openhw-max98357': I2SProtocol,
    'openhw-inmp441': I2SProtocol,
    'openhw-sph0645': I2SProtocol,

    // Sensors — custom components
    'DHT-22': DHT22Logic,
    'MQ-2 Gas Sensor': GasSensorLogic,
    'wokwi-pir-motion-sensor': PIRLogic,
    'wokwi-raindrop-module': RaindropModuleLogic,
    'wokwi-raindrop-pad': RaindropPadLogic,

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
    'wokwi-hc-sr04': BaseComponent,
    'openhw-hc-sr04': BaseComponent,
    'wokwi-mpu6050': BaseComponent,
    'openhw-mpu6050': BaseComponent,
    'wokwi-nlsf595': BaseComponent,
    'openhw-nlsf595': BaseComponent,
    'wokwi-relay-module': BaseComponent,
    'openhw-relay-module': BaseComponent,
    'wokwi-stepper-motor': BaseComponent,
    'openhw-stepper-motor': BaseComponent,
    'wokwi-arduino-mega': MegaLogic,
    'openhw-arduino-mega': MegaLogic,
    'wokwi-attiny85': BaseComponent,
    'openhw-attiny85': BaseComponent,
    'openhw-pico': PicoLogic,
    'openhw-pico-w': PicoLogic,
    'openhw-photoresistor': BaseComponent,
    'openhw-ntc-thermistor': BaseComponent,
    'openhw-ntc-temperature-sensor': BaseComponent,
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

// Per-type pin lists so every component's pins are registered correctly
export const COMPONENT_PINS: Record<string, { id: string }[]> = {
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
    'wokwi-analog-joystick': [{ id: 'GND' }, { id: '5V' }, { id: 'VRX' }, { id: 'VRY' }, { id: 'SW' }],
    'openhw-analog-joystick': [{ id: 'GND' }, { id: '5V' }, { id: 'VRX' }, { id: 'VRY' }, { id: 'SW' }],
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
    'openhw-mfrc522': [{ id: '3V3' }, { id: 'RST' }, { id: 'GND' }, { id: 'IRQ' }, { id: 'MISO' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'SDA' }],

    // Custom sensors
    'DHT-22':                [{ id: 'VCC' }, { id: 'SDA' }, { id: 'NC' }, { id: 'GND' }],
    'MQ-2 Gas Sensor':       [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }],
    'wokwi-pir-motion-sensor': [{ id: 'VCC' }, { id: 'GND' }, { id: 'OUT' }],
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
};

export type BoardRunner = {
    cpu: any;
    boardId: string;
    instances: Map<string, BaseComponent>;
    stop: () => void;
    reset?: () => void;
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
        inst.updateMetrics(cpu?.cycles || 0, cpu?.freq || 16000000, inst.telemetryEnabled, inst.telemetryWatchedParams || ['all'], realCanvasFps, realUiBlockedMs);
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

    try {
        if (!out.telemetrySummary && typeof inst?.getTelemetrySummary === 'function') {
            const summary = inst.getTelemetrySummary();
            if (typeof summary === 'string' && summary.trim()) {
                out.telemetrySummary = summary.trim();
            }
        }
    } catch (e) {
        // Telemetry failures should never break simulation state delivery.
    }

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
