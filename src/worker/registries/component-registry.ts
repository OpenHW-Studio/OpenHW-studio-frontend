import { BaseComponent, HD44780Controller } from '@openhw/emulator';
// Micro:bit v2 board shell: edge-connector pins only (the nRF52833 core
// is driven by MicrobitRunner; this shell carries pin state for wiring
// + board telemetry like matrixLit). No package changes needed.
export class MicrobitBoardLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { matrixLit: 0, ...this.state };
    }
}

// Parallel HD44780 LCD 20x4 logic (no backpack)
export class Lcd2004ParallelLogic extends BaseComponent {
    private hd44780: HD44780Controller;
    private pinStates: Record<string, boolean> = {
        rs: false, rw: false, e: false,
        d0: false, d1: false, d2: false, d3: false,
        d4: false, d5: false, d6: false, d7: false,
        a: true, k: false
    };

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.hd44780 = new HD44780Controller(4, 20);
        this.state = { ...this.hd44780.getState() };
    }

    onPinStateChange(pinId: string, isHigh: boolean, _cpuCycles: number): void {
        const pin = pinId.toLowerCase();
        const wasHigh = this.pinStates[pin];
        this.pinStates[pin] = isHigh;

        if (pin === 'a') {
            if (this.hd44780.backlight !== isHigh) {
                this.hd44780.backlight = isHigh;
                this.hd44780.stateChanged = true;
            }
        }

        if (pin === 'e' && wasHigh && !isHigh) {
            this.hd44780.feedParallelNibble(
                this.pinStates.rs,
                this.pinStates.d4,
                this.pinStates.d5,
                this.pinStates.d6,
                this.pinStates.d7,
            );
        }

        if (this.hd44780.stateChanged) {
            this.setState({ ...this.hd44780.getState() });
            this.hd44780.clearChanged();
        }
    }

    update(cpuCycles: number, wires: any, allComponents: any) {}

    onCustomTelemetry() {
        const textContent = this.hd44780.getLines().map(l => l.trimEnd()).join('\n').trimEnd();
        this.setCustomTelemetry({
            textContent: textContent || '<empty>',
            backlight: this.hd44780.getBacklight(),
            lineCount: 4,
            charsPerLine: 20,
        });
    }

    getSyncState() {
        return { ...this.state };
    }
}

export class LtdcDisplayLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { fbW: 0, fbH: 0, litPixels: 0, ...this.state };
    }
    onRgbFrame(w: number, h: number, px: number[]) {
        let lit = 0;
        for (let i = 0; i < px.length; i++) {
            if ((px[i] & 0x00ffffff) !== 0) lit++;
        }
        this.setState({ fbW: w, fbH: h, litPixels: lit });
    }
    getSyncState() {
        return { ...this.state };
    }
}

export class UsbDeviceLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { enumState: 'disconnected', rxCount: 0, lastEcho: '', ...this.state };
    }
    onUsbState(link: string, rx: number, echo: string) {
        this.setState({ enumState: link, rxCount: rx, lastEcho: echo });
    }
    getSyncState() {
        return { ...this.state };
    }
}
import { LEDLogic } from '@openhw/emulator/src/components/openhw-led/logic';
import { UnoLogic } from '@openhw/emulator/src/components/openhw-arduino-uno/logic';
import { HCSR04Logic } from '@openhw/emulator/src/components/openhw-hc-sr04/logic';
import { ResistorLogic } from '@openhw/emulator/src/components/openhw-resistor/logic';
import { PhotoresistorLogic } from '@openhw/emulator/src/components/openhw-photoresistor/logic';
import { PushbuttonLogic } from '@openhw/emulator/src/components/openhw-pushbutton/logic';
import { PowerSupplyLogic } from '@openhw/emulator/src/components/openhw-power-supply/logic';
import { BatteryLogic } from '@openhw/emulator/src/components/openhw-battery/logic';
import { NeopixelLogic } from '@openhw/emulator/src/components/openhw-neopixel-matrix/logic';
import { BuzzerLogic } from '@openhw/emulator/src/components/openhw-buzzer/logic';
import { Logic as SpeakerLogic } from '@openhw/emulator/src/components/openhw-5w-speaker/logic';
import { MotorLogic } from '@openhw/emulator/src/components/openhw-motor/logic';
import { ServoLogic } from '@openhw/emulator/src/components/openhw-servo/logic';
import { MotorDriverLogic } from '@openhw/emulator/src/components/openhw-motor-driver/logic';
import { SlidePotLogic } from '@openhw/emulator/src/components/openhw-slide-potentiometer/logic';
import { PotentiometerLogic } from '@openhw/emulator/src/components/openhw-potentiometer/logic';
import { HC595Logic as ShiftRegisterLogic } from '@openhw/emulator/src/components/openhw-74hc595/logic';
import { HC165Logic } from '@openhw/emulator/src/components/openhw-74hc165/logic';
import { BiaxialStepperLogic } from '@openhw/emulator/src/components/openhw-biaxial-stepper/logic';
import { Pushbutton6mmLogic } from '@openhw/emulator/src/components/openhw-6mm-pushbutton/logic';
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
import { Lcd1602Logic } from '@openhw/emulator/src/components/openhw-lcd1602/logic';
import { Lcd1602I2CLogic } from '@openhw/emulator/src/components/openhw-lcd1602-i2c/logic';
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
import { ILI9341TouchLogic } from '@openhw/emulator/src/components/openhw-ili9341-touch/logic';
import { EPaperLogic } from '@openhw/emulator/src/components/openhw-ePaperDisplay/logic';
import { Ks2eLogic } from '@openhw/emulator/src/components/openhw-ks2e-m-dc5/logic';
import { RelayModuleLogic } from '@openhw/emulator/src/components/openhw-relay-module/logic';

import { LogicAnalyzerLogic } from '@openhw/emulator/src/components/openhw-logic-analyzer/logic';
import { MegaLogic } from '@openhw/emulator/src/components/openhw-arduino-mega/logic';
import { DS18B20Logic } from '@openhw/emulator/src/components/openhw-ds18b20/logic';
import { Logic as Inmp441Logic } from '@openhw/emulator/src/components/openhw-inmp441/logic';
import { Logic as Sph0645Logic } from '@openhw/emulator/src/components/openhw-sph0645/logic';
import { Logic as Max98357Logic } from '@openhw/emulator/src/components/openhw-max98357/logic';
import { Logic as Pcm5102Logic } from '@openhw/emulator/src/components/openhw-pcm5102/logic';
import { IRReceiverLogic } from '@openhw/emulator/src/components/openhw-ir-receiver/logic';
import { IRRemoteLogic } from '@openhw/emulator/src/components/openhw-ir-remote/logic';
import { MFRC522Logic } from '@openhw/emulator/src/components/openhw-mfrc522/logic';
import { SlideSwitchLogic } from '@openhw/emulator/src/components/openhw-slide-switch/logic';
import { PhotoresistorLogic } from '@openhw/emulator/src/components/openhw-photoresistor/logic';
import { NtcLogic } from '@openhw/emulator/src/components/openhw-ntc-temperature-sensor/logic';
import { MPU6050Logic } from '@openhw/emulator/src/components/openhw-mpu6050/logic';
import { BMP180Logic } from '@openhw/emulator/src/components/openhw-bmp180/logic';
import { DS1307RTCLogic } from '@openhw/emulator/src/components/openhw-ds1307-rtc/logic';
import { NLSF595Logic } from '@openhw/emulator/src/components/openhw-nlsf595/logic';
import { ChargerLogic } from '@openhw/emulator/src/components/openhw-charger/logic';
import { NTCThermistorLogic } from '@openhw/emulator/src/components/openhw-ntc-thermistor/logic';
import { HX711Logic } from '@openhw/emulator/src/components/openhw-hx711_5/logic';
import { HP4067Logic } from '@openhw/emulator/src/components/openhw-hp4067/logic';
import { ADXL345Logic } from '@openhw/emulator/src/components/openhw-adxl345/logic';
import { CC1101Logic } from '@openhw/emulator/src/components/openhw-cc1101/logic';
import { NRF24L01Logic } from '@openhw/emulator/src/components/openhw-nrf24l01/logic';

import { UNO_ANALOG_PINS, UNO_BOARD_PINS, UNO_DIGITAL_PINS } from '../board-profiles';
import { MICROBIT_EDGE_PINS } from '../board-profiles';


import { KeypadLogic } from '../protocol-handlers/keypad';
import { SDCardLogic } from '../protocol-handlers/sd-card';
import { SimulationMonitorLogic } from '../protocol-handlers/simulation-monitor';
import { Mcp2518fdLogic } from '../components/mcp2518fd';

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
    'openhw-microbit-v2': MicrobitBoardLogic,

    'wokwi-resistor': ResistorLogic,
    'openhw-resistor': ResistorLogic,
    'wokwi-slide-switch': SlideSwitchLogic,
    'openhw-slide-switch': SlideSwitchLogic,
    'wokwi-pushbutton': PushbuttonLogic,
    'openhw-pushbutton': PushbuttonLogic,
    'openhw-pushbutton-6mm': Pushbutton6mmLogic,
    'openhw-6mm-pushbutton': Pushbutton6mmLogic,
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
    'openhw-5w-speaker': SpeakerLogic,
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
    'wokwi-lcd1602': Lcd1602Logic,
    'openhw-lcd1602': Lcd1602Logic,
    'wokwi-lcd2004': Lcd2004ParallelLogic,
    'openhw-lcd2004': Lcd2004ParallelLogic,
    // A 16x2 part must not be simulated by the 20x4 controller: the DDRAM
    // row map and the reported line/char counts both differ (2004 rows sit
    // at 0x00/0x40/0x14/0x54, 1602 at 0x00/0x40 with 16 columns), so a
    // sketch that writes line 2 at 0x40 wraps at the wrong column.
    'wokwi-lcd1602-i2c': Lcd1602I2CLogic,
    'openhw-lcd1602-i2c': Lcd1602I2CLogic,
    'wokwi-ssd1306-oled': SSD1306Logic,
    'openhw-ssd1306-oled': SSD1306Logic,
    max30102: MAX30102Logic,
    'wokwi-max7219': MAX7219Logic,
    'openhw-max7219': MAX7219Logic,
    'wokwi-ldr-module': LdrModuleLogic,
    'openhw-ldr-module': LdrModuleLogic,
    'wokwi-7segment': Wokwi7SegmentLogic,
    'openhw-7segment': Wokwi7SegmentLogic,
    'wokwi-ili9341': ILI9341Logic,
    'openhw-ili9341': ILI9341Logic,
    'openhw-ltdc-display': LtdcDisplayLogic,
    'openhw-usb-device': UsbDeviceLogic,
    'openhw-ili9341-touch': ILI9341TouchLogic,
    'openhw-ePaperDisplay': EPaperLogic,
    'wokwi-sd-card': SDCardLogic,
    'openhw-sd-card': SDCardLogic,
    'shift_register': ShiftRegisterLogic,
    'openhw-74hc595': ShiftRegisterLogic,
    'openhw-74hc165': HC165Logic,
    'openhw-hp4067': HP4067Logic,
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

    // I2S Audio Components: real logic classes so frames decode to pins
    // (mics) and pins decode to analog (DAC/amp).
    'openhw-pcm5102': Pcm5102Logic,
    'openhw-max98357': Max98357Logic,
    'openhw-inmp441': Inmp441Logic,
    'openhw-sph0645': Sph0645Logic,

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
    'wokwi-bmp180': BMP180Logic,
    'openhw-bmp180': BMP180Logic,
    'wokwi-bmp180-breakout': BMP180Logic,
    'openhw-bmp180-breakout': BMP180Logic,
    'wokwi-ds1307-rtc': DS1307RTCLogic,
    'openhw-ds1307-rtc': DS1307RTCLogic,
    'openhw-hx711_5': HX711Logic,
    'openhw-hx711_50': HX711Logic,
    'openhw-adxl345': ADXL345Logic,
    'openhw-cc1101': CC1101Logic,
    'openhw-nrf24l01': NRF24L01Logic,
    'wokwi-hc-sr04': HCSR04Logic,
    'openhw-hc-sr04': HCSR04Logic,
    'wokwi-mpu6050': MPU6050Logic,
    'openhw-mpu6050': MPU6050Logic,
    'wokwi-nlsf595': NLSF595Logic,
    'openhw-nlsf595': NLSF595Logic,
    'wokwi-relay-module': RelayModuleLogic,
    'openhw-relay-module': RelayModuleLogic,
    'wokwi-stepper-motor': StepperMotorLogic,
    'openhw-stepper-motor': StepperMotorLogic,
    'openhw-biaxial-stepper': BiaxialStepperLogic,
    'wokwi-arduino-mega': MegaLogic,
    'openhw-arduino-mega': MegaLogic,
    'wokwi-attiny85': BaseComponent,
    'openhw-attiny85': BaseComponent,

    'wokwi-photoresistor': PhotoresistorLogic,
    'openhw-photoresistor': PhotoresistorLogic,
    'openhw-ntc-thermistor': NTCThermistorLogic,
    'openhw-ntc-temperature-sensor': NtcLogic,
    'openhw-charger': ChargerLogic,
    'openhw-breadboard-mini': BaseComponent,
    'openhw-neopixel-ring': NeopixelLogic,
    'openhw-arduino-sensor-shield': BaseComponent,
    'openhw-simulation-monitor': SimulationMonitorLogic,
    'wokwi-ds18b20': DS18B20Logic,
    'openhw-ds18b20': DS18B20Logic,
    'wokwi-ir-receiver': IRReceiverLogic,
    'openhw-ir-receiver': IRReceiverLogic,
    'openhw-ir-remote': IRRemoteLogic,
    'wokwi-mfrc522': MFRC522Logic,
    'openhw-mfrc522': MFRC522Logic,
    'openhw-mcp2518fd': Mcp2518fdLogic,
};

// Per-type pin lists so every component's pins are registered correctly.
// §6: manifests are the source of truth. This table is GENERATED from
// emulator manifests (see scripts/gen-component-pins.mjs — run it after any
// manifest pin change and paste the output below). Entries below the
// "generated" marker are build output; hand edits will be overwritten.
// Covered ids: every openhw-*/wokwi-* type with manifest pins; the 3 pin-less
// types (openhw-image/ir-remote/text) resolve to [] (not undefined)
// so callers can distinguish "no pins" from "unknown type".
export const COMPONENT_PINS: Record<string, Array<{ id: string; type?: string }>> = {
    'wokwi-arduino-uno': UNO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-arduino-uno': UNO_BOARD_PINS.map((id: string) => ({ id })),
    'openhw-microbit-v2': MICROBIT_EDGE_PINS.map((id: string) => ({ id })),
    'logic-and-gate': [{ id: 'IN1', type: 'digital' }, { id: 'IN2', type: 'digital' }, { id: 'OUT', type: 'digital' }],
    'logic-buffer-gate': [{ id: 'IN', type: 'digital' }, { id: 'OUT', type: 'digital' }],
    'logic-clock-generator': [{ id: 'OUT', type: 'digital' }],
    'logic-d-flipflop': [{ id: 'D', type: 'digital' }, { id: 'CLK', type: 'digital' }, { id: 'Q', type: 'digital' }, { id: 'Qbar', type: 'digital' }],
    'logic-d-flipflop-dsr': [{ id: 'D', type: 'digital' }, { id: 'CLK', type: 'digital' }, { id: 'S', type: 'digital' }, { id: 'R', type: 'digital' }, { id: 'Q', type: 'digital' }, { id: 'Qbar', type: 'digital' }],
    'logic-d-flipflop-r': [{ id: 'D', type: 'digital' }, { id: 'CLK', type: 'digital' }, { id: 'R', type: 'digital' }, { id: 'Q', type: 'digital' }, { id: 'Qbar', type: 'digital' }],
    'logic-ic-74xx': [{ id: 'p1', type: 'digital' }, { id: 'p2', type: 'digital' }, { id: 'p3', type: 'digital' }, { id: 'p4', type: 'digital' }, { id: 'p5', type: 'digital' }, { id: 'p6', type: 'digital' }, { id: 'p7', type: 'digital' }, { id: 'p8', type: 'digital' }, { id: 'p9', type: 'digital' }, { id: 'p10', type: 'digital' }, { id: 'p11', type: 'digital' }, { id: 'p12', type: 'digital' }, { id: 'p13', type: 'digital' }, { id: 'p14', type: 'digital' }],
    'logic-mux-2to1': [{ id: 'D0', type: 'digital' }, { id: 'D1', type: 'digital' }, { id: 'SEL', type: 'digital' }, { id: 'OUT', type: 'digital' }],
    'logic-nand-gate': [{ id: 'IN1', type: 'digital' }, { id: 'IN2', type: 'digital' }, { id: 'OUT', type: 'digital' }],
    'logic-nor-gate': [{ id: 'IN1', type: 'digital' }, { id: 'IN2', type: 'digital' }, { id: 'OUT', type: 'digital' }],
    'logic-not-gate': [{ id: 'IN', type: 'digital' }, { id: 'OUT', type: 'digital' }],
    'logic-or-gate': [{ id: 'IN1', type: 'digital' }, { id: 'IN2', type: 'digital' }, { id: 'OUT', type: 'digital' }],
    'logic-xnor-gate': [{ id: 'IN1', type: 'digital' }, { id: 'IN2', type: 'digital' }, { id: 'OUT', type: 'digital' }],
    'logic-xor-gate': [{ id: 'IN1', type: 'digital' }, { id: 'IN2', type: 'digital' }, { id: 'OUT', type: 'digital' }],
    'max30102': [{ id: 'VIN', type: 'power' }, { id: 'SDA', type: 'digital' }, { id: 'SCL', type: 'digital' }, { id: 'GND', type: 'power' }, { id: 'INT', type: 'digital' }, { id: 'IRD', type: 'digital' }, { id: 'RD', type: 'digital' }, { id: 'NC', type: 'nc' }],
    'openhw-5w-speaker': [{ id: 'IN+' }, { id: 'IN-' }],
    'openhw-6502': [{ id: 'L0', type: 'digital_inout' }, { id: 'L1', type: 'digital_inout' }, { id: 'L2', type: 'digital_inout' }, { id: 'L3', type: 'digital_inout' }, { id: 'L4', type: 'digital_inout' }, { id: 'L5', type: 'digital_inout' }, { id: 'L6', type: 'digital_inout' }, { id: 'L7', type: 'digital_inout' }, { id: 'L8', type: 'digital_inout' }, { id: 'L9', type: 'digital_inout' }, { id: 'L10', type: 'digital_inout' }, { id: 'L11', type: 'digital_inout' }, { id: 'L12', type: 'digital_inout' }, { id: 'L13', type: 'digital_inout' }, { id: 'L14', type: 'digital_inout' }, { id: 'L15', type: 'digital_inout' }, { id: 'L16', type: 'digital_inout' }, { id: 'L17', type: 'digital_inout' }, { id: 'L18', type: 'digital_inout' }, { id: 'L19', type: 'digital_inout' }, { id: 'R0', type: 'digital_inout' }, { id: 'R1', type: 'digital_inout' }, { id: 'R2', type: 'digital_inout' }, { id: 'R3', type: 'digital_inout' }, { id: 'R4', type: 'digital_inout' }, { id: 'R5', type: 'digital_inout' }, { id: 'R6', type: 'digital_inout' }, { id: 'R7', type: 'digital_inout' }, { id: 'R8', type: 'digital_inout' }, { id: 'R9', type: 'digital_inout' }, { id: 'R10', type: 'digital_inout' }, { id: 'R11', type: 'digital_inout' }, { id: 'R12', type: 'digital_inout' }, { id: 'R13', type: 'digital_inout' }, { id: 'R14', type: 'digital_inout' }, { id: 'R15', type: 'digital_inout' }, { id: 'R16', type: 'digital_inout' }, { id: 'R17', type: 'digital_inout' }, { id: 'R18', type: 'digital_inout' }, { id: 'R19', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-74hc165': [{ id: 'vcc', type: 'power' }, { id: 'ce', type: 'digital' }, { id: 'd3', type: 'digital' }, { id: 'd2', type: 'digital' }, { id: 'd1', type: 'digital' }, { id: 'd0', type: 'digital' }, { id: 'ds', type: 'digital' }, { id: 'q7', type: 'digital' }, { id: 'pl', type: 'digital' }, { id: 'cp', type: 'digital' }, { id: 'd4', type: 'digital' }, { id: 'd5', type: 'digital' }, { id: 'd6', type: 'digital' }, { id: 'd7', type: 'digital' }, { id: 'q7n', type: 'digital' }, { id: 'gnd', type: 'power' }],
    'openhw-74hc595': [{ id: 'vcc', type: 'power' }, { id: 'q0', type: 'digital' }, { id: 'ser', type: 'digital' }, { id: 'oe', type: 'digital' }, { id: 'rclk', type: 'digital' }, { id: 'srclk', type: 'digital' }, { id: 'srclr', type: 'digital' }, { id: 'q7s', type: 'digital' }, { id: 'q1', type: 'digital' }, { id: 'q2', type: 'digital' }, { id: 'q3', type: 'digital' }, { id: 'q4', type: 'digital' }, { id: 'q5', type: 'digital' }, { id: 'q6', type: 'digital' }, { id: 'q7', type: 'digital' }, { id: 'gnd', type: 'power' }],
    'openhw-7segment': [{ id: 'G', type: 'digital' }, { id: 'F', type: 'digital' }, { id: 'COM.2', type: 'digital' }, { id: 'A', type: 'digital' }, { id: 'B', type: 'digital' }, { id: 'E', type: 'digital' }, { id: 'D', type: 'digital' }, { id: 'COM.1', type: 'digital' }, { id: 'C', type: 'digital' }, { id: 'DP', type: 'digital' }],
    'openhw-8051': [{ id: 'L0', type: 'digital_inout' }, { id: 'L1', type: 'digital_inout' }, { id: 'L2', type: 'digital_inout' }, { id: 'L3', type: 'digital_inout' }, { id: 'L4', type: 'digital_inout' }, { id: 'L5', type: 'digital_inout' }, { id: 'L6', type: 'digital_inout' }, { id: 'L7', type: 'digital_inout' }, { id: 'L8', type: 'digital_inout' }, { id: 'L9', type: 'digital_inout' }, { id: 'L10', type: 'digital_inout' }, { id: 'L11', type: 'digital_inout' }, { id: 'L12', type: 'digital_inout' }, { id: 'L13', type: 'digital_inout' }, { id: 'L14', type: 'digital_inout' }, { id: 'L15', type: 'digital_inout' }, { id: 'L16', type: 'digital_inout' }, { id: 'L17', type: 'digital_inout' }, { id: 'L18', type: 'digital_inout' }, { id: 'L19', type: 'digital_inout' }, { id: 'R0', type: 'digital_inout' }, { id: 'R1', type: 'digital_inout' }, { id: 'R2', type: 'digital_inout' }, { id: 'R3', type: 'digital_inout' }, { id: 'R4', type: 'digital_inout' }, { id: 'R5', type: 'digital_inout' }, { id: 'R6', type: 'digital_inout' }, { id: 'R7', type: 'digital_inout' }, { id: 'R8', type: 'digital_inout' }, { id: 'R9', type: 'digital_inout' }, { id: 'R10', type: 'digital_inout' }, { id: 'R11', type: 'digital_inout' }, { id: 'R12', type: 'digital_inout' }, { id: 'R13', type: 'digital_inout' }, { id: 'R14', type: 'digital_inout' }, { id: 'R15', type: 'digital_inout' }, { id: 'R16', type: 'digital_inout' }, { id: 'R17', type: 'digital_inout' }, { id: 'R18', type: 'digital_inout' }, { id: 'R19', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-8085': [{ id: 'L0', type: 'digital_inout' }, { id: 'L1', type: 'digital_inout' }, { id: 'L2', type: 'digital_inout' }, { id: 'L3', type: 'digital_inout' }, { id: 'L4', type: 'digital_inout' }, { id: 'L5', type: 'digital_inout' }, { id: 'L6', type: 'digital_inout' }, { id: 'L7', type: 'digital_inout' }, { id: 'L8', type: 'digital_inout' }, { id: 'L9', type: 'digital_inout' }, { id: 'L10', type: 'digital_inout' }, { id: 'L11', type: 'digital_inout' }, { id: 'L12', type: 'digital_inout' }, { id: 'L13', type: 'digital_inout' }, { id: 'L14', type: 'digital_inout' }, { id: 'L15', type: 'digital_inout' }, { id: 'L16', type: 'digital_inout' }, { id: 'L17', type: 'digital_inout' }, { id: 'L18', type: 'digital_inout' }, { id: 'L19', type: 'digital_inout' }, { id: 'R0', type: 'digital_inout' }, { id: 'R1', type: 'digital_inout' }, { id: 'R2', type: 'digital_inout' }, { id: 'R3', type: 'digital_inout' }, { id: 'R4', type: 'digital_inout' }, { id: 'R5', type: 'digital_inout' }, { id: 'R6', type: 'digital_inout' }, { id: 'R7', type: 'digital_inout' }, { id: 'R8', type: 'digital_inout' }, { id: 'R9', type: 'digital_inout' }, { id: 'R10', type: 'digital_inout' }, { id: 'R11', type: 'digital_inout' }, { id: 'R12', type: 'digital_inout' }, { id: 'R13', type: 'digital_inout' }, { id: 'R14', type: 'digital_inout' }, { id: 'R15', type: 'digital_inout' }, { id: 'R16', type: 'digital_inout' }, { id: 'R17', type: 'digital_inout' }, { id: 'R18', type: 'digital_inout' }, { id: 'R19', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-8086': [{ id: 'L0', type: 'digital_inout' }, { id: 'L1', type: 'digital_inout' }, { id: 'L2', type: 'digital_inout' }, { id: 'L3', type: 'digital_inout' }, { id: 'L4', type: 'digital_inout' }, { id: 'L5', type: 'digital_inout' }, { id: 'L6', type: 'digital_inout' }, { id: 'L7', type: 'digital_inout' }, { id: 'L8', type: 'digital_inout' }, { id: 'L9', type: 'digital_inout' }, { id: 'L10', type: 'digital_inout' }, { id: 'L11', type: 'digital_inout' }, { id: 'L12', type: 'digital_inout' }, { id: 'L13', type: 'digital_inout' }, { id: 'L14', type: 'digital_inout' }, { id: 'L15', type: 'digital_inout' }, { id: 'L16', type: 'digital_inout' }, { id: 'L17', type: 'digital_inout' }, { id: 'L18', type: 'digital_inout' }, { id: 'L19', type: 'digital_inout' }, { id: 'R0', type: 'digital_inout' }, { id: 'R1', type: 'digital_inout' }, { id: 'R2', type: 'digital_inout' }, { id: 'R3', type: 'digital_inout' }, { id: 'R4', type: 'digital_inout' }, { id: 'R5', type: 'digital_inout' }, { id: 'R6', type: 'digital_inout' }, { id: 'R7', type: 'digital_inout' }, { id: 'R8', type: 'digital_inout' }, { id: 'R9', type: 'digital_inout' }, { id: 'R10', type: 'digital_inout' }, { id: 'R11', type: 'digital_inout' }, { id: 'R12', type: 'digital_inout' }, { id: 'R13', type: 'digital_inout' }, { id: 'R14', type: 'digital_inout' }, { id: 'R15', type: 'digital_inout' }, { id: 'R16', type: 'digital_inout' }, { id: 'R17', type: 'digital_inout' }, { id: 'R18', type: 'digital_inout' }, { id: 'R19', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-8088': [{ id: 'L0', type: 'digital_inout' }, { id: 'L1', type: 'digital_inout' }, { id: 'L2', type: 'digital_inout' }, { id: 'L3', type: 'digital_inout' }, { id: 'L4', type: 'digital_inout' }, { id: 'L5', type: 'digital_inout' }, { id: 'L6', type: 'digital_inout' }, { id: 'L7', type: 'digital_inout' }, { id: 'L8', type: 'digital_inout' }, { id: 'L9', type: 'digital_inout' }, { id: 'L10', type: 'digital_inout' }, { id: 'L11', type: 'digital_inout' }, { id: 'L12', type: 'digital_inout' }, { id: 'L13', type: 'digital_inout' }, { id: 'L14', type: 'digital_inout' }, { id: 'L15', type: 'digital_inout' }, { id: 'L16', type: 'digital_inout' }, { id: 'L17', type: 'digital_inout' }, { id: 'L18', type: 'digital_inout' }, { id: 'L19', type: 'digital_inout' }, { id: 'R0', type: 'digital_inout' }, { id: 'R1', type: 'digital_inout' }, { id: 'R2', type: 'digital_inout' }, { id: 'R3', type: 'digital_inout' }, { id: 'R4', type: 'digital_inout' }, { id: 'R5', type: 'digital_inout' }, { id: 'R6', type: 'digital_inout' }, { id: 'R7', type: 'digital_inout' }, { id: 'R8', type: 'digital_inout' }, { id: 'R9', type: 'digital_inout' }, { id: 'R10', type: 'digital_inout' }, { id: 'R11', type: 'digital_inout' }, { id: 'R12', type: 'digital_inout' }, { id: 'R13', type: 'digital_inout' }, { id: 'R14', type: 'digital_inout' }, { id: 'R15', type: 'digital_inout' }, { id: 'R16', type: 'digital_inout' }, { id: 'R17', type: 'digital_inout' }, { id: 'R18', type: 'digital_inout' }, { id: 'R19', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-a4988': [{ id: 'ENABLE', type: 'digital' }, { id: 'MS1', type: 'digital' }, { id: 'MS2', type: 'digital' }, { id: 'MS3', type: 'digital' }, { id: 'RESET', type: 'digital' }, { id: 'SLEEP', type: 'digital' }, { id: 'STEP', type: 'digital' }, { id: 'DIR', type: 'digital' }, { id: 'VMOT', type: 'power' }, { id: 'GND_MOT', type: 'power' }, { id: '2B', type: 'digital' }, { id: '2A', type: 'digital' }, { id: '1A', type: 'digital' }, { id: '1B', type: 'digital' }, { id: 'VDD', type: 'power' }, { id: 'GND_LOGIC', type: 'power' }],
    'openhw-adxl345': [{ id: 'GND', type: 'input' }, { id: 'VCC', type: 'input' }, { id: 'CS', type: 'input' }, { id: 'INT1', type: 'output' }, { id: 'INT2', type: 'output' }, { id: 'SDO', type: 'bidirectional' }, { id: 'SDA', type: 'bidirectional' }, { id: 'SCL', type: 'input' }],
    'openhw-analog-joystick': [{ id: 'VCC', type: 'power' }, { id: 'VERT', type: 'analog' }, { id: 'HORZ', type: 'analog' }, { id: 'SEL', type: 'digital' }, { id: 'GND', type: 'power' }],
    'openhw-arduino-mega': [{ id: 'SCL', type: 'digital' }, { id: 'SDA', type: 'digital' }, { id: 'AREF', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: '13', type: 'digital' }, { id: '12', type: 'digital' }, { id: '11', type: 'digital' }, { id: '10', type: 'digital' }, { id: '9', type: 'digital' }, { id: '8', type: 'digital' }, { id: '7', type: 'digital' }, { id: '6', type: 'digital' }, { id: '5', type: 'digital' }, { id: '4', type: 'digital' }, { id: '3', type: 'digital' }, { id: '2', type: 'digital' }, { id: '1', type: 'digital' }, { id: '0', type: 'digital' }, { id: '14', type: 'digital' }, { id: '15', type: 'digital' }, { id: '16', type: 'digital' }, { id: '17', type: 'digital' }, { id: '18', type: 'digital' }, { id: '19', type: 'digital' }, { id: '20', type: 'digital' }, { id: '21', type: 'digital' }, { id: '5V.1', type: 'power' }, { id: '5V.2', type: 'power' }, { id: '22', type: 'digital' }, { id: '23', type: 'digital' }, { id: '24', type: 'digital' }, { id: '25', type: 'digital' }, { id: '26', type: 'digital' }, { id: '27', type: 'digital' }, { id: '28', type: 'digital' }, { id: '29', type: 'digital' }, { id: '30', type: 'digital' }, { id: '31', type: 'digital' }, { id: '32', type: 'digital' }, { id: '33', type: 'digital' }, { id: '34', type: 'digital' }, { id: '35', type: 'digital' }, { id: '36', type: 'digital' }, { id: '37', type: 'digital' }, { id: '38', type: 'digital' }, { id: '39', type: 'digital' }, { id: '40', type: 'digital' }, { id: '41', type: 'digital' }, { id: '42', type: 'digital' }, { id: '43', type: 'digital' }, { id: '44', type: 'digital' }, { id: '45', type: 'digital' }, { id: '46', type: 'digital' }, { id: '47', type: 'digital' }, { id: '48', type: 'digital' }, { id: '49', type: 'digital' }, { id: '50', type: 'digital' }, { id: '51', type: 'digital' }, { id: '52', type: 'digital' }, { id: '53', type: 'digital' }, { id: 'GND.4', type: 'power' }, { id: 'GND.5', type: 'power' }, { id: 'IOREF', type: 'power' }, { id: 'RESET', type: 'power' }, { id: '3.3V', type: 'power' }, { id: '5V', type: 'power' }, { id: 'GND.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: 'VIN', type: 'power' }, { id: 'A0', type: 'analog' }, { id: 'A1', type: 'analog' }, { id: 'A2', type: 'analog' }, { id: 'A3', type: 'analog' }, { id: 'A4', type: 'analog' }, { id: 'A5', type: 'analog' }, { id: 'A6', type: 'analog' }, { id: 'A7', type: 'analog' }, { id: 'A8', type: 'analog' }, { id: 'A9', type: 'analog' }, { id: 'A10', type: 'analog' }, { id: 'A11', type: 'analog' }, { id: 'A12', type: 'analog' }, { id: 'A13', type: 'analog' }, { id: 'A14', type: 'analog' }, { id: 'A15', type: 'analog' }],
    'openhw-arduino-nano': [{ id: '12', type: 'digital' }, { id: '11', type: 'digital' }, { id: '10', type: 'digital' }, { id: '9', type: 'digital' }, { id: '8', type: 'digital' }, { id: '7', type: 'digital' }, { id: '6', type: 'digital' }, { id: '5', type: 'digital' }, { id: '4', type: 'digital' }, { id: '3', type: 'digital' }, { id: '2', type: 'digital' }, { id: 'GND.2', type: 'power' }, { id: 'RST.2', type: 'digital' }, { id: 'RX', type: 'digital' }, { id: 'TX', type: 'digital' }, { id: 'PE1', type: 'digital' }, { id: '13', type: 'digital' }, { id: '3V3', type: 'power' }, { id: 'AREF', type: 'power' }, { id: 'A0', type: 'digital' }, { id: 'A1', type: 'digital' }, { id: 'A2', type: 'digital' }, { id: 'A3', type: 'digital' }, { id: 'A4', type: 'digital' }, { id: 'A5', type: 'digital' }, { id: 'A6', type: 'digital' }, { id: 'A7', type: 'digital' }, { id: '5V', type: 'power' }, { id: 'RST.1', type: 'digital' }, { id: 'GND.1', type: 'power' }, { id: 'VIN', type: 'power' }, { id: 'PE0', type: 'digital' }],
    'openhw-arduino-sensor-shield': [{ id: 'AREF_IN', type: 'digital' }, { id: 'GND_TOP_IN', type: 'power' }, { id: 'D13_IN', type: 'digital' }, { id: 'D12_IN', type: 'digital' }, { id: 'D11_IN', type: 'digital' }, { id: 'D10_IN', type: 'digital' }, { id: 'D9_IN', type: 'digital' }, { id: 'D8_IN', type: 'digital' }, { id: 'D7_IN', type: 'digital' }, { id: 'D6_IN', type: 'digital' }, { id: 'D5_IN', type: 'digital' }, { id: 'D4_IN', type: 'digital' }, { id: 'D3_IN', type: 'digital' }, { id: 'D2_IN', type: 'digital' }, { id: 'D1_IN', type: 'digital' }, { id: 'D0_IN', type: 'digital' }, { id: 'RST_IN', type: 'digital' }, { id: '3V3_IN', type: 'power' }, { id: '5V_IN', type: 'power' }, { id: 'GND1_IN', type: 'power' }, { id: 'GND2_IN', type: 'power' }, { id: 'VIN_IN', type: 'power' }, { id: 'A0_IN', type: 'digital' }, { id: 'A1_IN', type: 'digital' }, { id: 'A2_IN', type: 'digital' }, { id: 'A3_IN', type: 'digital' }, { id: 'A4_IN', type: 'digital' }, { id: 'A5_IN', type: 'digital' }, { id: 'S_AREF', type: 'digital' }, { id: 'V_AREF', type: 'power' }, { id: 'G_AREF', type: 'power' }, { id: 'S_GND', type: 'digital' }, { id: 'V_GND', type: 'power' }, { id: 'G_GND', type: 'power' }, { id: 'S_13', type: 'digital' }, { id: 'V_13', type: 'power' }, { id: 'G_13', type: 'power' }, { id: 'S_12', type: 'digital' }, { id: 'V_12', type: 'power' }, { id: 'G_12', type: 'power' }, { id: 'S_11', type: 'digital' }, { id: 'V_11', type: 'power' }, { id: 'G_11', type: 'power' }, { id: 'S_10', type: 'digital' }, { id: 'V_10', type: 'power' }, { id: 'G_10', type: 'power' }, { id: 'S_9', type: 'digital' }, { id: 'V_9', type: 'power' }, { id: 'G_9', type: 'power' }, { id: 'S_8', type: 'digital' }, { id: 'V_8', type: 'power' }, { id: 'G_8', type: 'power' }, { id: 'S_7', type: 'digital' }, { id: 'V_7', type: 'power' }, { id: 'G_7', type: 'power' }, { id: 'S_6', type: 'digital' }, { id: 'V_6', type: 'power' }, { id: 'G_6', type: 'power' }, { id: 'S_5', type: 'digital' }, { id: 'V_5', type: 'power' }, { id: 'G_5', type: 'power' }, { id: 'S_4', type: 'digital' }, { id: 'V_4', type: 'power' }, { id: 'G_4', type: 'power' }, { id: 'S_3', type: 'digital' }, { id: 'V_3', type: 'power' }, { id: 'G_3', type: 'power' }, { id: 'S_2', type: 'digital' }, { id: 'V_2', type: 'power' }, { id: 'G_2', type: 'power' }, { id: 'S_1', type: 'digital' }, { id: 'V_1', type: 'power' }, { id: 'G_1', type: 'power' }, { id: 'S_0', type: 'digital' }, { id: 'V_0', type: 'power' }, { id: 'G_0', type: 'power' }, { id: 'S_A0', type: 'digital' }, { id: 'V_A0', type: 'power' }, { id: 'G_A0', type: 'power' }, { id: 'S_A1', type: 'digital' }, { id: 'V_A1', type: 'power' }, { id: 'G_A1', type: 'power' }, { id: 'S_A2', type: 'digital' }, { id: 'V_A2', type: 'power' }, { id: 'G_A2', type: 'power' }, { id: 'S_A3', type: 'digital' }, { id: 'V_A3', type: 'power' }, { id: 'G_A3', type: 'power' }, { id: 'S_A4', type: 'digital' }, { id: 'V_A4', type: 'power' }, { id: 'G_A4', type: 'power' }, { id: 'S_A5', type: 'digital' }, { id: 'V_A5', type: 'power' }, { id: 'G_A5', type: 'power' }],
    'openhw-attiny85': [{ id: 'P5', type: 'digital' }, { id: 'P4', type: 'digital' }, { id: 'P3', type: 'digital' }, { id: 'P2', type: 'digital' }, { id: 'P1', type: 'digital' }, { id: 'P0', type: 'digital' }, { id: '5V', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'VIN', type: 'power' }],
    'openhw-battery': [{ id: 'VCC' }, { id: 'GND' }],
    'openhw-biaxial-stepper': [{ id: 'A1-', type: 'digital' }, { id: 'A1+', type: 'digital' }, { id: 'B1+', type: 'digital' }, { id: 'B1-', type: 'digital' }, { id: 'A2-', type: 'digital' }, { id: 'A2+', type: 'digital' }, { id: 'B2+', type: 'digital' }, { id: 'B2-', type: 'digital' }],
    'openhw-bmp180-breakout': [{ id: 'VIN', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'SCL', type: 'input' }, { id: 'SDA', type: 'bidirectional' }],
    'openhw-breadboard': [{ id: 'top_gnd_1', type: 'power' }, { id: 'top_vcc_1', type: 'power' }, { id: 'top_gnd_2', type: 'power' }, { id: 'top_vcc_2', type: 'power' }, { id: 'top_gnd_3', type: 'power' }, { id: 'top_vcc_3', type: 'power' }, { id: 'top_gnd_4', type: 'power' }, { id: 'top_vcc_4', type: 'power' }, { id: 'top_gnd_5', type: 'power' }, { id: 'top_vcc_5', type: 'power' }, { id: 'top_gnd_6', type: 'power' }, { id: 'top_vcc_6', type: 'power' }, { id: 'top_gnd_7', type: 'power' }, { id: 'top_vcc_7', type: 'power' }, { id: 'top_gnd_8', type: 'power' }, { id: 'top_vcc_8', type: 'power' }, { id: 'top_gnd_9', type: 'power' }, { id: 'top_vcc_9', type: 'power' }, { id: 'top_gnd_10', type: 'power' }, { id: 'top_vcc_10', type: 'power' }, { id: 'top_gnd_11', type: 'power' }, { id: 'top_vcc_11', type: 'power' }, { id: 'top_gnd_12', type: 'power' }, { id: 'top_vcc_12', type: 'power' }, { id: 'top_gnd_13', type: 'power' }, { id: 'top_vcc_13', type: 'power' }, { id: 'top_gnd_14', type: 'power' }, { id: 'top_vcc_14', type: 'power' }, { id: 'top_gnd_15', type: 'power' }, { id: 'top_vcc_15', type: 'power' }, { id: 'top_gnd_16', type: 'power' }, { id: 'top_vcc_16', type: 'power' }, { id: 'top_gnd_17', type: 'power' }, { id: 'top_vcc_17', type: 'power' }, { id: 'top_gnd_18', type: 'power' }, { id: 'top_vcc_18', type: 'power' }, { id: 'top_gnd_19', type: 'power' }, { id: 'top_vcc_19', type: 'power' }, { id: 'top_gnd_20', type: 'power' }, { id: 'top_vcc_20', type: 'power' }, { id: 'top_gnd_21', type: 'power' }, { id: 'top_vcc_21', type: 'power' }, { id: 'top_gnd_22', type: 'power' }, { id: 'top_vcc_22', type: 'power' }, { id: 'top_gnd_23', type: 'power' }, { id: 'top_vcc_23', type: 'power' }, { id: 'top_gnd_24', type: 'power' }, { id: 'top_vcc_24', type: 'power' }, { id: 'top_gnd_25', type: 'power' }, { id: 'top_vcc_25', type: 'power' }, { id: 'top_gnd_26', type: 'power' }, { id: 'top_vcc_26', type: 'power' }, { id: 'top_gnd_27', type: 'power' }, { id: 'top_vcc_27', type: 'power' }, { id: 'top_gnd_28', type: 'power' }, { id: 'top_vcc_28', type: 'power' }, { id: 'top_gnd_29', type: 'power' }, { id: 'top_vcc_29', type: 'power' }, { id: 'top_gnd_30', type: 'power' }, { id: 'top_vcc_30', type: 'power' }, { id: 'top_gnd_31', type: 'power' }, { id: 'top_vcc_31', type: 'power' }, { id: 'top_gnd_32', type: 'power' }, { id: 'top_vcc_32', type: 'power' }, { id: 'top_gnd_33', type: 'power' }, { id: 'top_vcc_33', type: 'power' }, { id: 'top_gnd_34', type: 'power' }, { id: 'top_vcc_34', type: 'power' }, { id: 'top_gnd_35', type: 'power' }, { id: 'top_vcc_35', type: 'power' }, { id: 'top_gnd_36', type: 'power' }, { id: 'top_vcc_36', type: 'power' }, { id: 'top_gnd_37', type: 'power' }, { id: 'top_vcc_37', type: 'power' }, { id: 'top_gnd_38', type: 'power' }, { id: 'top_vcc_38', type: 'power' }, { id: 'top_gnd_39', type: 'power' }, { id: 'top_vcc_39', type: 'power' }, { id: 'top_gnd_40', type: 'power' }, { id: 'top_vcc_40', type: 'power' }, { id: 'top_gnd_41', type: 'power' }, { id: 'top_vcc_41', type: 'power' }, { id: 'top_gnd_42', type: 'power' }, { id: 'top_vcc_42', type: 'power' }, { id: 'top_gnd_43', type: 'power' }, { id: 'top_vcc_43', type: 'power' }, { id: 'top_gnd_44', type: 'power' }, { id: 'top_vcc_44', type: 'power' }, { id: 'top_gnd_45', type: 'power' }, { id: 'top_vcc_45', type: 'power' }, { id: 'top_gnd_46', type: 'power' }, { id: 'top_vcc_46', type: 'power' }, { id: 'top_gnd_47', type: 'power' }, { id: 'top_vcc_47', type: 'power' }, { id: 'top_gnd_48', type: 'power' }, { id: 'top_vcc_48', type: 'power' }, { id: 'top_gnd_49', type: 'power' }, { id: 'top_vcc_49', type: 'power' }, { id: 'top_gnd_50', type: 'power' }, { id: 'top_vcc_50', type: 'power' }, { id: '1e', type: 'digital' }, { id: '1d', type: 'digital' }, { id: '1c', type: 'digital' }, { id: '1b', type: 'digital' }, { id: '1a', type: 'digital' }, { id: '1f', type: 'digital' }, { id: '1g', type: 'digital' }, { id: '1h', type: 'digital' }, { id: '1i', type: 'digital' }, { id: '1j', type: 'digital' }, { id: '2e', type: 'digital' }, { id: '2d', type: 'digital' }, { id: '2c', type: 'digital' }, { id: '2b', type: 'digital' }, { id: '2a', type: 'digital' }, { id: '2f', type: 'digital' }, { id: '2g', type: 'digital' }, { id: '2h', type: 'digital' }, { id: '2i', type: 'digital' }, { id: '2j', type: 'digital' }, { id: '3e', type: 'digital' }, { id: '3d', type: 'digital' }, { id: '3c', type: 'digital' }, { id: '3b', type: 'digital' }, { id: '3a', type: 'digital' }, { id: '3f', type: 'digital' }, { id: '3g', type: 'digital' }, { id: '3h', type: 'digital' }, { id: '3i', type: 'digital' }, { id: '3j', type: 'digital' }, { id: '4e', type: 'digital' }, { id: '4d', type: 'digital' }, { id: '4c', type: 'digital' }, { id: '4b', type: 'digital' }, { id: '4a', type: 'digital' }, { id: '4f', type: 'digital' }, { id: '4g', type: 'digital' }, { id: '4h', type: 'digital' }, { id: '4i', type: 'digital' }, { id: '4j', type: 'digital' }, { id: '5e', type: 'digital' }, { id: '5d', type: 'digital' }, { id: '5c', type: 'digital' }, { id: '5b', type: 'digital' }, { id: '5a', type: 'digital' }, { id: '5f', type: 'digital' }, { id: '5g', type: 'digital' }, { id: '5h', type: 'digital' }, { id: '5i', type: 'digital' }, { id: '5j', type: 'digital' }, { id: '6e', type: 'digital' }, { id: '6d', type: 'digital' }, { id: '6c', type: 'digital' }, { id: '6b', type: 'digital' }, { id: '6a', type: 'digital' }, { id: '6f', type: 'digital' }, { id: '6g', type: 'digital' }, { id: '6h', type: 'digital' }, { id: '6i', type: 'digital' }, { id: '6j', type: 'digital' }, { id: '7e', type: 'digital' }, { id: '7d', type: 'digital' }, { id: '7c', type: 'digital' }, { id: '7b', type: 'digital' }, { id: '7a', type: 'digital' }, { id: '7f', type: 'digital' }, { id: '7g', type: 'digital' }, { id: '7h', type: 'digital' }, { id: '7i', type: 'digital' }, { id: '7j', type: 'digital' }, { id: '8e', type: 'digital' }, { id: '8d', type: 'digital' }, { id: '8c', type: 'digital' }, { id: '8b', type: 'digital' }, { id: '8a', type: 'digital' }, { id: '8f', type: 'digital' }, { id: '8g', type: 'digital' }, { id: '8h', type: 'digital' }, { id: '8i', type: 'digital' }, { id: '8j', type: 'digital' }, { id: '9e', type: 'digital' }, { id: '9d', type: 'digital' }, { id: '9c', type: 'digital' }, { id: '9b', type: 'digital' }, { id: '9a', type: 'digital' }, { id: '9f', type: 'digital' }, { id: '9g', type: 'digital' }, { id: '9h', type: 'digital' }, { id: '9i', type: 'digital' }, { id: '9j', type: 'digital' }, { id: '10e', type: 'digital' }, { id: '10d', type: 'digital' }, { id: '10c', type: 'digital' }, { id: '10b', type: 'digital' }, { id: '10a', type: 'digital' }, { id: '10f', type: 'digital' }, { id: '10g', type: 'digital' }, { id: '10h', type: 'digital' }, { id: '10i', type: 'digital' }, { id: '10j', type: 'digital' }, { id: '11e', type: 'digital' }, { id: '11d', type: 'digital' }, { id: '11c', type: 'digital' }, { id: '11b', type: 'digital' }, { id: '11a', type: 'digital' }, { id: '11f', type: 'digital' }, { id: '11g', type: 'digital' }, { id: '11h', type: 'digital' }, { id: '11i', type: 'digital' }, { id: '11j', type: 'digital' }, { id: '12e', type: 'digital' }, { id: '12d', type: 'digital' }, { id: '12c', type: 'digital' }, { id: '12b', type: 'digital' }, { id: '12a', type: 'digital' }, { id: '12f', type: 'digital' }, { id: '12g', type: 'digital' }, { id: '12h', type: 'digital' }, { id: '12i', type: 'digital' }, { id: '12j', type: 'digital' }, { id: '13e', type: 'digital' }, { id: '13d', type: 'digital' }, { id: '13c', type: 'digital' }, { id: '13b', type: 'digital' }, { id: '13a', type: 'digital' }, { id: '13f', type: 'digital' }, { id: '13g', type: 'digital' }, { id: '13h', type: 'digital' }, { id: '13i', type: 'digital' }, { id: '13j', type: 'digital' }, { id: '14e', type: 'digital' }, { id: '14d', type: 'digital' }, { id: '14c', type: 'digital' }, { id: '14b', type: 'digital' }, { id: '14a', type: 'digital' }, { id: '14f', type: 'digital' }, { id: '14g', type: 'digital' }, { id: '14h', type: 'digital' }, { id: '14i', type: 'digital' }, { id: '14j', type: 'digital' }, { id: '15e', type: 'digital' }, { id: '15d', type: 'digital' }, { id: '15c', type: 'digital' }, { id: '15b', type: 'digital' }, { id: '15a', type: 'digital' }, { id: '15f', type: 'digital' }, { id: '15g', type: 'digital' }, { id: '15h', type: 'digital' }, { id: '15i', type: 'digital' }, { id: '15j', type: 'digital' }, { id: '16e', type: 'digital' }, { id: '16d', type: 'digital' }, { id: '16c', type: 'digital' }, { id: '16b', type: 'digital' }, { id: '16a', type: 'digital' }, { id: '16f', type: 'digital' }, { id: '16g', type: 'digital' }, { id: '16h', type: 'digital' }, { id: '16i', type: 'digital' }, { id: '16j', type: 'digital' }, { id: '17e', type: 'digital' }, { id: '17d', type: 'digital' }, { id: '17c', type: 'digital' }, { id: '17b', type: 'digital' }, { id: '17a', type: 'digital' }, { id: '17f', type: 'digital' }, { id: '17g', type: 'digital' }, { id: '17h', type: 'digital' }, { id: '17i', type: 'digital' }, { id: '17j', type: 'digital' }, { id: '18e', type: 'digital' }, { id: '18d', type: 'digital' }, { id: '18c', type: 'digital' }, { id: '18b', type: 'digital' }, { id: '18a', type: 'digital' }, { id: '18f', type: 'digital' }, { id: '18g', type: 'digital' }, { id: '18h', type: 'digital' }, { id: '18i', type: 'digital' }, { id: '18j', type: 'digital' }, { id: '19e', type: 'digital' }, { id: '19d', type: 'digital' }, { id: '19c', type: 'digital' }, { id: '19b', type: 'digital' }, { id: '19a', type: 'digital' }, { id: '19f', type: 'digital' }, { id: '19g', type: 'digital' }, { id: '19h', type: 'digital' }, { id: '19i', type: 'digital' }, { id: '19j', type: 'digital' }, { id: '20e', type: 'digital' }, { id: '20d', type: 'digital' }, { id: '20c', type: 'digital' }, { id: '20b', type: 'digital' }, { id: '20a', type: 'digital' }, { id: '20f', type: 'digital' }, { id: '20g', type: 'digital' }, { id: '20h', type: 'digital' }, { id: '20i', type: 'digital' }, { id: '20j', type: 'digital' }, { id: '21e', type: 'digital' }, { id: '21d', type: 'digital' }, { id: '21c', type: 'digital' }, { id: '21b', type: 'digital' }, { id: '21a', type: 'digital' }, { id: '21f', type: 'digital' }, { id: '21g', type: 'digital' }, { id: '21h', type: 'digital' }, { id: '21i', type: 'digital' }, { id: '21j', type: 'digital' }, { id: '22e', type: 'digital' }, { id: '22d', type: 'digital' }, { id: '22c', type: 'digital' }, { id: '22b', type: 'digital' }, { id: '22a', type: 'digital' }, { id: '22f', type: 'digital' }, { id: '22g', type: 'digital' }, { id: '22h', type: 'digital' }, { id: '22i', type: 'digital' }, { id: '22j', type: 'digital' }, { id: '23e', type: 'digital' }, { id: '23d', type: 'digital' }, { id: '23c', type: 'digital' }, { id: '23b', type: 'digital' }, { id: '23a', type: 'digital' }, { id: '23f', type: 'digital' }, { id: '23g', type: 'digital' }, { id: '23h', type: 'digital' }, { id: '23i', type: 'digital' }, { id: '23j', type: 'digital' }, { id: '24e', type: 'digital' }, { id: '24d', type: 'digital' }, { id: '24c', type: 'digital' }, { id: '24b', type: 'digital' }, { id: '24a', type: 'digital' }, { id: '24f', type: 'digital' }, { id: '24g', type: 'digital' }, { id: '24h', type: 'digital' }, { id: '24i', type: 'digital' }, { id: '24j', type: 'digital' }, { id: '25e', type: 'digital' }, { id: '25d', type: 'digital' }, { id: '25c', type: 'digital' }, { id: '25b', type: 'digital' }, { id: '25a', type: 'digital' }, { id: '25f', type: 'digital' }, { id: '25g', type: 'digital' }, { id: '25h', type: 'digital' }, { id: '25i', type: 'digital' }, { id: '25j', type: 'digital' }, { id: '26e', type: 'digital' }, { id: '26d', type: 'digital' }, { id: '26c', type: 'digital' }, { id: '26b', type: 'digital' }, { id: '26a', type: 'digital' }, { id: '26f', type: 'digital' }, { id: '26g', type: 'digital' }, { id: '26h', type: 'digital' }, { id: '26i', type: 'digital' }, { id: '26j', type: 'digital' }, { id: '27e', type: 'digital' }, { id: '27d', type: 'digital' }, { id: '27c', type: 'digital' }, { id: '27b', type: 'digital' }, { id: '27a', type: 'digital' }, { id: '27f', type: 'digital' }, { id: '27g', type: 'digital' }, { id: '27h', type: 'digital' }, { id: '27i', type: 'digital' }, { id: '27j', type: 'digital' }, { id: '28e', type: 'digital' }, { id: '28d', type: 'digital' }, { id: '28c', type: 'digital' }, { id: '28b', type: 'digital' }, { id: '28a', type: 'digital' }, { id: '28f', type: 'digital' }, { id: '28g', type: 'digital' }, { id: '28h', type: 'digital' }, { id: '28i', type: 'digital' }, { id: '28j', type: 'digital' }, { id: '29e', type: 'digital' }, { id: '29d', type: 'digital' }, { id: '29c', type: 'digital' }, { id: '29b', type: 'digital' }, { id: '29a', type: 'digital' }, { id: '29f', type: 'digital' }, { id: '29g', type: 'digital' }, { id: '29h', type: 'digital' }, { id: '29i', type: 'digital' }, { id: '29j', type: 'digital' }, { id: '30e', type: 'digital' }, { id: '30d', type: 'digital' }, { id: '30c', type: 'digital' }, { id: '30b', type: 'digital' }, { id: '30a', type: 'digital' }, { id: '30f', type: 'digital' }, { id: '30g', type: 'digital' }, { id: '30h', type: 'digital' }, { id: '30i', type: 'digital' }, { id: '30j', type: 'digital' }, { id: '31e', type: 'digital' }, { id: '31d', type: 'digital' }, { id: '31c', type: 'digital' }, { id: '31b', type: 'digital' }, { id: '31a', type: 'digital' }, { id: '31f', type: 'digital' }, { id: '31g', type: 'digital' }, { id: '31h', type: 'digital' }, { id: '31i', type: 'digital' }, { id: '31j', type: 'digital' }, { id: '32e', type: 'digital' }, { id: '32d', type: 'digital' }, { id: '32c', type: 'digital' }, { id: '32b', type: 'digital' }, { id: '32a', type: 'digital' }, { id: '32f', type: 'digital' }, { id: '32g', type: 'digital' }, { id: '32h', type: 'digital' }, { id: '32i', type: 'digital' }, { id: '32j', type: 'digital' }, { id: '33e', type: 'digital' }, { id: '33d', type: 'digital' }, { id: '33c', type: 'digital' }, { id: '33b', type: 'digital' }, { id: '33a', type: 'digital' }, { id: '33f', type: 'digital' }, { id: '33g', type: 'digital' }, { id: '33h', type: 'digital' }, { id: '33i', type: 'digital' }, { id: '33j', type: 'digital' }, { id: '34e', type: 'digital' }, { id: '34d', type: 'digital' }, { id: '34c', type: 'digital' }, { id: '34b', type: 'digital' }, { id: '34a', type: 'digital' }, { id: '34f', type: 'digital' }, { id: '34g', type: 'digital' }, { id: '34h', type: 'digital' }, { id: '34i', type: 'digital' }, { id: '34j', type: 'digital' }, { id: '35e', type: 'digital' }, { id: '35d', type: 'digital' }, { id: '35c', type: 'digital' }, { id: '35b', type: 'digital' }, { id: '35a', type: 'digital' }, { id: '35f', type: 'digital' }, { id: '35g', type: 'digital' }, { id: '35h', type: 'digital' }, { id: '35i', type: 'digital' }, { id: '35j', type: 'digital' }, { id: '36e', type: 'digital' }, { id: '36d', type: 'digital' }, { id: '36c', type: 'digital' }, { id: '36b', type: 'digital' }, { id: '36a', type: 'digital' }, { id: '36f', type: 'digital' }, { id: '36g', type: 'digital' }, { id: '36h', type: 'digital' }, { id: '36i', type: 'digital' }, { id: '36j', type: 'digital' }, { id: '37e', type: 'digital' }, { id: '37d', type: 'digital' }, { id: '37c', type: 'digital' }, { id: '37b', type: 'digital' }, { id: '37a', type: 'digital' }, { id: '37f', type: 'digital' }, { id: '37g', type: 'digital' }, { id: '37h', type: 'digital' }, { id: '37i', type: 'digital' }, { id: '37j', type: 'digital' }, { id: '38e', type: 'digital' }, { id: '38d', type: 'digital' }, { id: '38c', type: 'digital' }, { id: '38b', type: 'digital' }, { id: '38a', type: 'digital' }, { id: '38f', type: 'digital' }, { id: '38g', type: 'digital' }, { id: '38h', type: 'digital' }, { id: '38i', type: 'digital' }, { id: '38j', type: 'digital' }, { id: '39e', type: 'digital' }, { id: '39d', type: 'digital' }, { id: '39c', type: 'digital' }, { id: '39b', type: 'digital' }, { id: '39a', type: 'digital' }, { id: '39f', type: 'digital' }, { id: '39g', type: 'digital' }, { id: '39h', type: 'digital' }, { id: '39i', type: 'digital' }, { id: '39j', type: 'digital' }, { id: '40e', type: 'digital' }, { id: '40d', type: 'digital' }, { id: '40c', type: 'digital' }, { id: '40b', type: 'digital' }, { id: '40a', type: 'digital' }, { id: '40f', type: 'digital' }, { id: '40g', type: 'digital' }, { id: '40h', type: 'digital' }, { id: '40i', type: 'digital' }, { id: '40j', type: 'digital' }, { id: '41e', type: 'digital' }, { id: '41d', type: 'digital' }, { id: '41c', type: 'digital' }, { id: '41b', type: 'digital' }, { id: '41a', type: 'digital' }, { id: '41f', type: 'digital' }, { id: '41g', type: 'digital' }, { id: '41h', type: 'digital' }, { id: '41i', type: 'digital' }, { id: '41j', type: 'digital' }, { id: '42e', type: 'digital' }, { id: '42d', type: 'digital' }, { id: '42c', type: 'digital' }, { id: '42b', type: 'digital' }, { id: '42a', type: 'digital' }, { id: '42f', type: 'digital' }, { id: '42g', type: 'digital' }, { id: '42h', type: 'digital' }, { id: '42i', type: 'digital' }, { id: '42j', type: 'digital' }, { id: '43e', type: 'digital' }, { id: '43d', type: 'digital' }, { id: '43c', type: 'digital' }, { id: '43b', type: 'digital' }, { id: '43a', type: 'digital' }, { id: '43f', type: 'digital' }, { id: '43g', type: 'digital' }, { id: '43h', type: 'digital' }, { id: '43i', type: 'digital' }, { id: '43j', type: 'digital' }, { id: '44e', type: 'digital' }, { id: '44d', type: 'digital' }, { id: '44c', type: 'digital' }, { id: '44b', type: 'digital' }, { id: '44a', type: 'digital' }, { id: '44f', type: 'digital' }, { id: '44g', type: 'digital' }, { id: '44h', type: 'digital' }, { id: '44i', type: 'digital' }, { id: '44j', type: 'digital' }, { id: '45e', type: 'digital' }, { id: '45d', type: 'digital' }, { id: '45c', type: 'digital' }, { id: '45b', type: 'digital' }, { id: '45a', type: 'digital' }, { id: '45f', type: 'digital' }, { id: '45g', type: 'digital' }, { id: '45h', type: 'digital' }, { id: '45i', type: 'digital' }, { id: '45j', type: 'digital' }, { id: '46e', type: 'digital' }, { id: '46d', type: 'digital' }, { id: '46c', type: 'digital' }, { id: '46b', type: 'digital' }, { id: '46a', type: 'digital' }, { id: '46f', type: 'digital' }, { id: '46g', type: 'digital' }, { id: '46h', type: 'digital' }, { id: '46i', type: 'digital' }, { id: '46j', type: 'digital' }, { id: '47e', type: 'digital' }, { id: '47d', type: 'digital' }, { id: '47c', type: 'digital' }, { id: '47b', type: 'digital' }, { id: '47a', type: 'digital' }, { id: '47f', type: 'digital' }, { id: '47g', type: 'digital' }, { id: '47h', type: 'digital' }, { id: '47i', type: 'digital' }, { id: '47j', type: 'digital' }, { id: '48e', type: 'digital' }, { id: '48d', type: 'digital' }, { id: '48c', type: 'digital' }, { id: '48b', type: 'digital' }, { id: '48a', type: 'digital' }, { id: '48f', type: 'digital' }, { id: '48g', type: 'digital' }, { id: '48h', type: 'digital' }, { id: '48i', type: 'digital' }, { id: '48j', type: 'digital' }, { id: '49e', type: 'digital' }, { id: '49d', type: 'digital' }, { id: '49c', type: 'digital' }, { id: '49b', type: 'digital' }, { id: '49a', type: 'digital' }, { id: '49f', type: 'digital' }, { id: '49g', type: 'digital' }, { id: '49h', type: 'digital' }, { id: '49i', type: 'digital' }, { id: '49j', type: 'digital' }, { id: '50e', type: 'digital' }, { id: '50d', type: 'digital' }, { id: '50c', type: 'digital' }, { id: '50b', type: 'digital' }, { id: '50a', type: 'digital' }, { id: '50f', type: 'digital' }, { id: '50g', type: 'digital' }, { id: '50h', type: 'digital' }, { id: '50i', type: 'digital' }, { id: '50j', type: 'digital' }, { id: '51e', type: 'digital' }, { id: '51d', type: 'digital' }, { id: '51c', type: 'digital' }, { id: '51b', type: 'digital' }, { id: '51a', type: 'digital' }, { id: '51f', type: 'digital' }, { id: '51g', type: 'digital' }, { id: '51h', type: 'digital' }, { id: '51i', type: 'digital' }, { id: '51j', type: 'digital' }, { id: '52e', type: 'digital' }, { id: '52d', type: 'digital' }, { id: '52c', type: 'digital' }, { id: '52b', type: 'digital' }, { id: '52a', type: 'digital' }, { id: '52f', type: 'digital' }, { id: '52g', type: 'digital' }, { id: '52h', type: 'digital' }, { id: '52i', type: 'digital' }, { id: '52j', type: 'digital' }, { id: '53e', type: 'digital' }, { id: '53d', type: 'digital' }, { id: '53c', type: 'digital' }, { id: '53b', type: 'digital' }, { id: '53a', type: 'digital' }, { id: '53f', type: 'digital' }, { id: '53g', type: 'digital' }, { id: '53h', type: 'digital' }, { id: '53i', type: 'digital' }, { id: '53j', type: 'digital' }, { id: '54e', type: 'digital' }, { id: '54d', type: 'digital' }, { id: '54c', type: 'digital' }, { id: '54b', type: 'digital' }, { id: '54a', type: 'digital' }, { id: '54f', type: 'digital' }, { id: '54g', type: 'digital' }, { id: '54h', type: 'digital' }, { id: '54i', type: 'digital' }, { id: '54j', type: 'digital' }, { id: '55e', type: 'digital' }, { id: '55d', type: 'digital' }, { id: '55c', type: 'digital' }, { id: '55b', type: 'digital' }, { id: '55a', type: 'digital' }, { id: '55f', type: 'digital' }, { id: '55g', type: 'digital' }, { id: '55h', type: 'digital' }, { id: '55i', type: 'digital' }, { id: '55j', type: 'digital' }, { id: '56e', type: 'digital' }, { id: '56d', type: 'digital' }, { id: '56c', type: 'digital' }, { id: '56b', type: 'digital' }, { id: '56a', type: 'digital' }, { id: '56f', type: 'digital' }, { id: '56g', type: 'digital' }, { id: '56h', type: 'digital' }, { id: '56i', type: 'digital' }, { id: '56j', type: 'digital' }, { id: '57e', type: 'digital' }, { id: '57d', type: 'digital' }, { id: '57c', type: 'digital' }, { id: '57b', type: 'digital' }, { id: '57a', type: 'digital' }, { id: '57f', type: 'digital' }, { id: '57g', type: 'digital' }, { id: '57h', type: 'digital' }, { id: '57i', type: 'digital' }, { id: '57j', type: 'digital' }, { id: '58e', type: 'digital' }, { id: '58d', type: 'digital' }, { id: '58c', type: 'digital' }, { id: '58b', type: 'digital' }, { id: '58a', type: 'digital' }, { id: '58f', type: 'digital' }, { id: '58g', type: 'digital' }, { id: '58h', type: 'digital' }, { id: '58i', type: 'digital' }, { id: '58j', type: 'digital' }, { id: '59e', type: 'digital' }, { id: '59d', type: 'digital' }, { id: '59c', type: 'digital' }, { id: '59b', type: 'digital' }, { id: '59a', type: 'digital' }, { id: '59f', type: 'digital' }, { id: '59g', type: 'digital' }, { id: '59h', type: 'digital' }, { id: '59i', type: 'digital' }, { id: '59j', type: 'digital' }, { id: '60e', type: 'digital' }, { id: '60d', type: 'digital' }, { id: '60c', type: 'digital' }, { id: '60b', type: 'digital' }, { id: '60a', type: 'digital' }, { id: '60f', type: 'digital' }, { id: '60g', type: 'digital' }, { id: '60h', type: 'digital' }, { id: '60i', type: 'digital' }, { id: '60j', type: 'digital' }, { id: '61e', type: 'digital' }, { id: '61d', type: 'digital' }, { id: '61c', type: 'digital' }, { id: '61b', type: 'digital' }, { id: '61a', type: 'digital' }, { id: '61f', type: 'digital' }, { id: '61g', type: 'digital' }, { id: '61h', type: 'digital' }, { id: '61i', type: 'digital' }, { id: '61j', type: 'digital' }, { id: '62e', type: 'digital' }, { id: '62d', type: 'digital' }, { id: '62c', type: 'digital' }, { id: '62b', type: 'digital' }, { id: '62a', type: 'digital' }, { id: '62f', type: 'digital' }, { id: '62g', type: 'digital' }, { id: '62h', type: 'digital' }, { id: '62i', type: 'digital' }, { id: '62j', type: 'digital' }, { id: '63e', type: 'digital' }, { id: '63d', type: 'digital' }, { id: '63c', type: 'digital' }, { id: '63b', type: 'digital' }, { id: '63a', type: 'digital' }, { id: '63f', type: 'digital' }, { id: '63g', type: 'digital' }, { id: '63h', type: 'digital' }, { id: '63i', type: 'digital' }, { id: '63j', type: 'digital' }, { id: 'bottom_vcc_1', type: 'power' }, { id: 'bottom_gnd_1', type: 'power' }, { id: 'bottom_vcc_2', type: 'power' }, { id: 'bottom_gnd_2', type: 'power' }, { id: 'bottom_vcc_3', type: 'power' }, { id: 'bottom_gnd_3', type: 'power' }, { id: 'bottom_vcc_4', type: 'power' }, { id: 'bottom_gnd_4', type: 'power' }, { id: 'bottom_vcc_5', type: 'power' }, { id: 'bottom_gnd_5', type: 'power' }, { id: 'bottom_vcc_6', type: 'power' }, { id: 'bottom_gnd_6', type: 'power' }, { id: 'bottom_vcc_7', type: 'power' }, { id: 'bottom_gnd_7', type: 'power' }, { id: 'bottom_vcc_8', type: 'power' }, { id: 'bottom_gnd_8', type: 'power' }, { id: 'bottom_vcc_9', type: 'power' }, { id: 'bottom_gnd_9', type: 'power' }, { id: 'bottom_vcc_10', type: 'power' }, { id: 'bottom_gnd_10', type: 'power' }, { id: 'bottom_vcc_11', type: 'power' }, { id: 'bottom_gnd_11', type: 'power' }, { id: 'bottom_vcc_12', type: 'power' }, { id: 'bottom_gnd_12', type: 'power' }, { id: 'bottom_vcc_13', type: 'power' }, { id: 'bottom_gnd_13', type: 'power' }, { id: 'bottom_vcc_14', type: 'power' }, { id: 'bottom_gnd_14', type: 'power' }, { id: 'bottom_vcc_15', type: 'power' }, { id: 'bottom_gnd_15', type: 'power' }, { id: 'bottom_vcc_16', type: 'power' }, { id: 'bottom_gnd_16', type: 'power' }, { id: 'bottom_vcc_17', type: 'power' }, { id: 'bottom_gnd_17', type: 'power' }, { id: 'bottom_vcc_18', type: 'power' }, { id: 'bottom_gnd_18', type: 'power' }, { id: 'bottom_vcc_19', type: 'power' }, { id: 'bottom_gnd_19', type: 'power' }, { id: 'bottom_vcc_20', type: 'power' }, { id: 'bottom_gnd_20', type: 'power' }, { id: 'bottom_vcc_21', type: 'power' }, { id: 'bottom_gnd_21', type: 'power' }, { id: 'bottom_vcc_22', type: 'power' }, { id: 'bottom_gnd_22', type: 'power' }, { id: 'bottom_vcc_23', type: 'power' }, { id: 'bottom_gnd_23', type: 'power' }, { id: 'bottom_vcc_24', type: 'power' }, { id: 'bottom_gnd_24', type: 'power' }, { id: 'bottom_vcc_25', type: 'power' }, { id: 'bottom_gnd_25', type: 'power' }, { id: 'bottom_vcc_26', type: 'power' }, { id: 'bottom_gnd_26', type: 'power' }, { id: 'bottom_vcc_27', type: 'power' }, { id: 'bottom_gnd_27', type: 'power' }, { id: 'bottom_vcc_28', type: 'power' }, { id: 'bottom_gnd_28', type: 'power' }, { id: 'bottom_vcc_29', type: 'power' }, { id: 'bottom_gnd_29', type: 'power' }, { id: 'bottom_vcc_30', type: 'power' }, { id: 'bottom_gnd_30', type: 'power' }, { id: 'bottom_vcc_31', type: 'power' }, { id: 'bottom_gnd_31', type: 'power' }, { id: 'bottom_vcc_32', type: 'power' }, { id: 'bottom_gnd_32', type: 'power' }, { id: 'bottom_vcc_33', type: 'power' }, { id: 'bottom_gnd_33', type: 'power' }, { id: 'bottom_vcc_34', type: 'power' }, { id: 'bottom_gnd_34', type: 'power' }, { id: 'bottom_vcc_35', type: 'power' }, { id: 'bottom_gnd_35', type: 'power' }, { id: 'bottom_vcc_36', type: 'power' }, { id: 'bottom_gnd_36', type: 'power' }, { id: 'bottom_vcc_37', type: 'power' }, { id: 'bottom_gnd_37', type: 'power' }, { id: 'bottom_vcc_38', type: 'power' }, { id: 'bottom_gnd_38', type: 'power' }, { id: 'bottom_vcc_39', type: 'power' }, { id: 'bottom_gnd_39', type: 'power' }, { id: 'bottom_vcc_40', type: 'power' }, { id: 'bottom_gnd_40', type: 'power' }, { id: 'bottom_vcc_41', type: 'power' }, { id: 'bottom_gnd_41', type: 'power' }, { id: 'bottom_vcc_42', type: 'power' }, { id: 'bottom_gnd_42', type: 'power' }, { id: 'bottom_vcc_43', type: 'power' }, { id: 'bottom_gnd_43', type: 'power' }, { id: 'bottom_vcc_44', type: 'power' }, { id: 'bottom_gnd_44', type: 'power' }, { id: 'bottom_vcc_45', type: 'power' }, { id: 'bottom_gnd_45', type: 'power' }, { id: 'bottom_vcc_46', type: 'power' }, { id: 'bottom_gnd_46', type: 'power' }, { id: 'bottom_vcc_47', type: 'power' }, { id: 'bottom_gnd_47', type: 'power' }, { id: 'bottom_vcc_48', type: 'power' }, { id: 'bottom_gnd_48', type: 'power' }, { id: 'bottom_vcc_49', type: 'power' }, { id: 'bottom_gnd_49', type: 'power' }, { id: 'bottom_vcc_50', type: 'power' }, { id: 'bottom_gnd_50', type: 'power' }],
    'openhw-breadboard-half': [{ id: 'top_gnd_1', type: 'power' }, { id: 'top_vcc_1', type: 'power' }, { id: 'top_gnd_2', type: 'power' }, { id: 'top_vcc_2', type: 'power' }, { id: 'top_gnd_3', type: 'power' }, { id: 'top_vcc_3', type: 'power' }, { id: 'top_gnd_4', type: 'power' }, { id: 'top_vcc_4', type: 'power' }, { id: 'top_gnd_5', type: 'power' }, { id: 'top_vcc_5', type: 'power' }, { id: 'top_gnd_6', type: 'power' }, { id: 'top_vcc_6', type: 'power' }, { id: 'top_gnd_7', type: 'power' }, { id: 'top_vcc_7', type: 'power' }, { id: 'top_gnd_8', type: 'power' }, { id: 'top_vcc_8', type: 'power' }, { id: 'top_gnd_9', type: 'power' }, { id: 'top_vcc_9', type: 'power' }, { id: 'top_gnd_10', type: 'power' }, { id: 'top_vcc_10', type: 'power' }, { id: 'top_gnd_11', type: 'power' }, { id: 'top_vcc_11', type: 'power' }, { id: 'top_gnd_12', type: 'power' }, { id: 'top_vcc_12', type: 'power' }, { id: 'top_gnd_13', type: 'power' }, { id: 'top_vcc_13', type: 'power' }, { id: 'top_gnd_14', type: 'power' }, { id: 'top_vcc_14', type: 'power' }, { id: 'top_gnd_15', type: 'power' }, { id: 'top_vcc_15', type: 'power' }, { id: 'top_gnd_16', type: 'power' }, { id: 'top_vcc_16', type: 'power' }, { id: 'top_gnd_17', type: 'power' }, { id: 'top_vcc_17', type: 'power' }, { id: 'top_gnd_18', type: 'power' }, { id: 'top_vcc_18', type: 'power' }, { id: 'top_gnd_19', type: 'power' }, { id: 'top_vcc_19', type: 'power' }, { id: 'top_gnd_20', type: 'power' }, { id: 'top_vcc_20', type: 'power' }, { id: 'top_gnd_21', type: 'power' }, { id: 'top_vcc_21', type: 'power' }, { id: 'top_gnd_22', type: 'power' }, { id: 'top_vcc_22', type: 'power' }, { id: 'top_gnd_23', type: 'power' }, { id: 'top_vcc_23', type: 'power' }, { id: 'top_gnd_24', type: 'power' }, { id: 'top_vcc_24', type: 'power' }, { id: 'top_gnd_25', type: 'power' }, { id: 'top_vcc_25', type: 'power' }, { id: '1e', type: 'digital' }, { id: '1d', type: 'digital' }, { id: '1c', type: 'digital' }, { id: '1b', type: 'digital' }, { id: '1a', type: 'digital' }, { id: '1f', type: 'digital' }, { id: '1g', type: 'digital' }, { id: '1h', type: 'digital' }, { id: '1i', type: 'digital' }, { id: '1j', type: 'digital' }, { id: '2e', type: 'digital' }, { id: '2d', type: 'digital' }, { id: '2c', type: 'digital' }, { id: '2b', type: 'digital' }, { id: '2a', type: 'digital' }, { id: '2f', type: 'digital' }, { id: '2g', type: 'digital' }, { id: '2h', type: 'digital' }, { id: '2i', type: 'digital' }, { id: '2j', type: 'digital' }, { id: '3e', type: 'digital' }, { id: '3d', type: 'digital' }, { id: '3c', type: 'digital' }, { id: '3b', type: 'digital' }, { id: '3a', type: 'digital' }, { id: '3f', type: 'digital' }, { id: '3g', type: 'digital' }, { id: '3h', type: 'digital' }, { id: '3i', type: 'digital' }, { id: '3j', type: 'digital' }, { id: '4e', type: 'digital' }, { id: '4d', type: 'digital' }, { id: '4c', type: 'digital' }, { id: '4b', type: 'digital' }, { id: '4a', type: 'digital' }, { id: '4f', type: 'digital' }, { id: '4g', type: 'digital' }, { id: '4h', type: 'digital' }, { id: '4i', type: 'digital' }, { id: '4j', type: 'digital' }, { id: '5e', type: 'digital' }, { id: '5d', type: 'digital' }, { id: '5c', type: 'digital' }, { id: '5b', type: 'digital' }, { id: '5a', type: 'digital' }, { id: '5f', type: 'digital' }, { id: '5g', type: 'digital' }, { id: '5h', type: 'digital' }, { id: '5i', type: 'digital' }, { id: '5j', type: 'digital' }, { id: '6e', type: 'digital' }, { id: '6d', type: 'digital' }, { id: '6c', type: 'digital' }, { id: '6b', type: 'digital' }, { id: '6a', type: 'digital' }, { id: '6f', type: 'digital' }, { id: '6g', type: 'digital' }, { id: '6h', type: 'digital' }, { id: '6i', type: 'digital' }, { id: '6j', type: 'digital' }, { id: '7e', type: 'digital' }, { id: '7d', type: 'digital' }, { id: '7c', type: 'digital' }, { id: '7b', type: 'digital' }, { id: '7a', type: 'digital' }, { id: '7f', type: 'digital' }, { id: '7g', type: 'digital' }, { id: '7h', type: 'digital' }, { id: '7i', type: 'digital' }, { id: '7j', type: 'digital' }, { id: '8e', type: 'digital' }, { id: '8d', type: 'digital' }, { id: '8c', type: 'digital' }, { id: '8b', type: 'digital' }, { id: '8a', type: 'digital' }, { id: '8f', type: 'digital' }, { id: '8g', type: 'digital' }, { id: '8h', type: 'digital' }, { id: '8i', type: 'digital' }, { id: '8j', type: 'digital' }, { id: '9e', type: 'digital' }, { id: '9d', type: 'digital' }, { id: '9c', type: 'digital' }, { id: '9b', type: 'digital' }, { id: '9a', type: 'digital' }, { id: '9f', type: 'digital' }, { id: '9g', type: 'digital' }, { id: '9h', type: 'digital' }, { id: '9i', type: 'digital' }, { id: '9j', type: 'digital' }, { id: '10e', type: 'digital' }, { id: '10d', type: 'digital' }, { id: '10c', type: 'digital' }, { id: '10b', type: 'digital' }, { id: '10a', type: 'digital' }, { id: '10f', type: 'digital' }, { id: '10g', type: 'digital' }, { id: '10h', type: 'digital' }, { id: '10i', type: 'digital' }, { id: '10j', type: 'digital' }, { id: '11e', type: 'digital' }, { id: '11d', type: 'digital' }, { id: '11c', type: 'digital' }, { id: '11b', type: 'digital' }, { id: '11a', type: 'digital' }, { id: '11f', type: 'digital' }, { id: '11g', type: 'digital' }, { id: '11h', type: 'digital' }, { id: '11i', type: 'digital' }, { id: '11j', type: 'digital' }, { id: '12e', type: 'digital' }, { id: '12d', type: 'digital' }, { id: '12c', type: 'digital' }, { id: '12b', type: 'digital' }, { id: '12a', type: 'digital' }, { id: '12f', type: 'digital' }, { id: '12g', type: 'digital' }, { id: '12h', type: 'digital' }, { id: '12i', type: 'digital' }, { id: '12j', type: 'digital' }, { id: '13e', type: 'digital' }, { id: '13d', type: 'digital' }, { id: '13c', type: 'digital' }, { id: '13b', type: 'digital' }, { id: '13a', type: 'digital' }, { id: '13f', type: 'digital' }, { id: '13g', type: 'digital' }, { id: '13h', type: 'digital' }, { id: '13i', type: 'digital' }, { id: '13j', type: 'digital' }, { id: '14e', type: 'digital' }, { id: '14d', type: 'digital' }, { id: '14c', type: 'digital' }, { id: '14b', type: 'digital' }, { id: '14a', type: 'digital' }, { id: '14f', type: 'digital' }, { id: '14g', type: 'digital' }, { id: '14h', type: 'digital' }, { id: '14i', type: 'digital' }, { id: '14j', type: 'digital' }, { id: '15e', type: 'digital' }, { id: '15d', type: 'digital' }, { id: '15c', type: 'digital' }, { id: '15b', type: 'digital' }, { id: '15a', type: 'digital' }, { id: '15f', type: 'digital' }, { id: '15g', type: 'digital' }, { id: '15h', type: 'digital' }, { id: '15i', type: 'digital' }, { id: '15j', type: 'digital' }, { id: '16e', type: 'digital' }, { id: '16d', type: 'digital' }, { id: '16c', type: 'digital' }, { id: '16b', type: 'digital' }, { id: '16a', type: 'digital' }, { id: '16f', type: 'digital' }, { id: '16g', type: 'digital' }, { id: '16h', type: 'digital' }, { id: '16i', type: 'digital' }, { id: '16j', type: 'digital' }, { id: '17e', type: 'digital' }, { id: '17d', type: 'digital' }, { id: '17c', type: 'digital' }, { id: '17b', type: 'digital' }, { id: '17a', type: 'digital' }, { id: '17f', type: 'digital' }, { id: '17g', type: 'digital' }, { id: '17h', type: 'digital' }, { id: '17i', type: 'digital' }, { id: '17j', type: 'digital' }, { id: '18e', type: 'digital' }, { id: '18d', type: 'digital' }, { id: '18c', type: 'digital' }, { id: '18b', type: 'digital' }, { id: '18a', type: 'digital' }, { id: '18f', type: 'digital' }, { id: '18g', type: 'digital' }, { id: '18h', type: 'digital' }, { id: '18i', type: 'digital' }, { id: '18j', type: 'digital' }, { id: '19e', type: 'digital' }, { id: '19d', type: 'digital' }, { id: '19c', type: 'digital' }, { id: '19b', type: 'digital' }, { id: '19a', type: 'digital' }, { id: '19f', type: 'digital' }, { id: '19g', type: 'digital' }, { id: '19h', type: 'digital' }, { id: '19i', type: 'digital' }, { id: '19j', type: 'digital' }, { id: '20e', type: 'digital' }, { id: '20d', type: 'digital' }, { id: '20c', type: 'digital' }, { id: '20b', type: 'digital' }, { id: '20a', type: 'digital' }, { id: '20f', type: 'digital' }, { id: '20g', type: 'digital' }, { id: '20h', type: 'digital' }, { id: '20i', type: 'digital' }, { id: '20j', type: 'digital' }, { id: '21e', type: 'digital' }, { id: '21d', type: 'digital' }, { id: '21c', type: 'digital' }, { id: '21b', type: 'digital' }, { id: '21a', type: 'digital' }, { id: '21f', type: 'digital' }, { id: '21g', type: 'digital' }, { id: '21h', type: 'digital' }, { id: '21i', type: 'digital' }, { id: '21j', type: 'digital' }, { id: '22e', type: 'digital' }, { id: '22d', type: 'digital' }, { id: '22c', type: 'digital' }, { id: '22b', type: 'digital' }, { id: '22a', type: 'digital' }, { id: '22f', type: 'digital' }, { id: '22g', type: 'digital' }, { id: '22h', type: 'digital' }, { id: '22i', type: 'digital' }, { id: '22j', type: 'digital' }, { id: '23e', type: 'digital' }, { id: '23d', type: 'digital' }, { id: '23c', type: 'digital' }, { id: '23b', type: 'digital' }, { id: '23a', type: 'digital' }, { id: '23f', type: 'digital' }, { id: '23g', type: 'digital' }, { id: '23h', type: 'digital' }, { id: '23i', type: 'digital' }, { id: '23j', type: 'digital' }, { id: '24e', type: 'digital' }, { id: '24d', type: 'digital' }, { id: '24c', type: 'digital' }, { id: '24b', type: 'digital' }, { id: '24a', type: 'digital' }, { id: '24f', type: 'digital' }, { id: '24g', type: 'digital' }, { id: '24h', type: 'digital' }, { id: '24i', type: 'digital' }, { id: '24j', type: 'digital' }, { id: '25e', type: 'digital' }, { id: '25d', type: 'digital' }, { id: '25c', type: 'digital' }, { id: '25b', type: 'digital' }, { id: '25a', type: 'digital' }, { id: '25f', type: 'digital' }, { id: '25g', type: 'digital' }, { id: '25h', type: 'digital' }, { id: '25i', type: 'digital' }, { id: '25j', type: 'digital' }, { id: '26e', type: 'digital' }, { id: '26d', type: 'digital' }, { id: '26c', type: 'digital' }, { id: '26b', type: 'digital' }, { id: '26a', type: 'digital' }, { id: '26f', type: 'digital' }, { id: '26g', type: 'digital' }, { id: '26h', type: 'digital' }, { id: '26i', type: 'digital' }, { id: '26j', type: 'digital' }, { id: '27e', type: 'digital' }, { id: '27d', type: 'digital' }, { id: '27c', type: 'digital' }, { id: '27b', type: 'digital' }, { id: '27a', type: 'digital' }, { id: '27f', type: 'digital' }, { id: '27g', type: 'digital' }, { id: '27h', type: 'digital' }, { id: '27i', type: 'digital' }, { id: '27j', type: 'digital' }, { id: '28e', type: 'digital' }, { id: '28d', type: 'digital' }, { id: '28c', type: 'digital' }, { id: '28b', type: 'digital' }, { id: '28a', type: 'digital' }, { id: '28f', type: 'digital' }, { id: '28g', type: 'digital' }, { id: '28h', type: 'digital' }, { id: '28i', type: 'digital' }, { id: '28j', type: 'digital' }, { id: '29e', type: 'digital' }, { id: '29d', type: 'digital' }, { id: '29c', type: 'digital' }, { id: '29b', type: 'digital' }, { id: '29a', type: 'digital' }, { id: '29f', type: 'digital' }, { id: '29g', type: 'digital' }, { id: '29h', type: 'digital' }, { id: '29i', type: 'digital' }, { id: '29j', type: 'digital' }, { id: '30e', type: 'digital' }, { id: '30d', type: 'digital' }, { id: '30c', type: 'digital' }, { id: '30b', type: 'digital' }, { id: '30a', type: 'digital' }, { id: '30f', type: 'digital' }, { id: '30g', type: 'digital' }, { id: '30h', type: 'digital' }, { id: '30i', type: 'digital' }, { id: '30j', type: 'digital' }, { id: 'bottom_vcc_1', type: 'power' }, { id: 'bottom_gnd_1', type: 'power' }, { id: 'bottom_vcc_2', type: 'power' }, { id: 'bottom_gnd_2', type: 'power' }, { id: 'bottom_vcc_3', type: 'power' }, { id: 'bottom_gnd_3', type: 'power' }, { id: 'bottom_vcc_4', type: 'power' }, { id: 'bottom_gnd_4', type: 'power' }, { id: 'bottom_vcc_5', type: 'power' }, { id: 'bottom_gnd_5', type: 'power' }, { id: 'bottom_vcc_6', type: 'power' }, { id: 'bottom_gnd_6', type: 'power' }, { id: 'bottom_vcc_7', type: 'power' }, { id: 'bottom_gnd_7', type: 'power' }, { id: 'bottom_vcc_8', type: 'power' }, { id: 'bottom_gnd_8', type: 'power' }, { id: 'bottom_vcc_9', type: 'power' }, { id: 'bottom_gnd_9', type: 'power' }, { id: 'bottom_vcc_10', type: 'power' }, { id: 'bottom_gnd_10', type: 'power' }, { id: 'bottom_vcc_11', type: 'power' }, { id: 'bottom_gnd_11', type: 'power' }, { id: 'bottom_vcc_12', type: 'power' }, { id: 'bottom_gnd_12', type: 'power' }, { id: 'bottom_vcc_13', type: 'power' }, { id: 'bottom_gnd_13', type: 'power' }, { id: 'bottom_vcc_14', type: 'power' }, { id: 'bottom_gnd_14', type: 'power' }, { id: 'bottom_vcc_15', type: 'power' }, { id: 'bottom_gnd_15', type: 'power' }, { id: 'bottom_vcc_16', type: 'power' }, { id: 'bottom_gnd_16', type: 'power' }, { id: 'bottom_vcc_17', type: 'power' }, { id: 'bottom_gnd_17', type: 'power' }, { id: 'bottom_vcc_18', type: 'power' }, { id: 'bottom_gnd_18', type: 'power' }, { id: 'bottom_vcc_19', type: 'power' }, { id: 'bottom_gnd_19', type: 'power' }, { id: 'bottom_vcc_20', type: 'power' }, { id: 'bottom_gnd_20', type: 'power' }, { id: 'bottom_vcc_21', type: 'power' }, { id: 'bottom_gnd_21', type: 'power' }, { id: 'bottom_vcc_22', type: 'power' }, { id: 'bottom_gnd_22', type: 'power' }, { id: 'bottom_vcc_23', type: 'power' }, { id: 'bottom_gnd_23', type: 'power' }, { id: 'bottom_vcc_24', type: 'power' }, { id: 'bottom_gnd_24', type: 'power' }, { id: 'bottom_vcc_25', type: 'power' }, { id: 'bottom_gnd_25', type: 'power' }],
    'openhw-breadboard-mini': [{ id: '1e', type: 'digital' }, { id: '1d', type: 'digital' }, { id: '1c', type: 'digital' }, { id: '1b', type: 'digital' }, { id: '1a', type: 'digital' }, { id: '1f', type: 'digital' }, { id: '1g', type: 'digital' }, { id: '1h', type: 'digital' }, { id: '1i', type: 'digital' }, { id: '1j', type: 'digital' }, { id: '2e', type: 'digital' }, { id: '2d', type: 'digital' }, { id: '2c', type: 'digital' }, { id: '2b', type: 'digital' }, { id: '2a', type: 'digital' }, { id: '2f', type: 'digital' }, { id: '2g', type: 'digital' }, { id: '2h', type: 'digital' }, { id: '2i', type: 'digital' }, { id: '2j', type: 'digital' }, { id: '3e', type: 'digital' }, { id: '3d', type: 'digital' }, { id: '3c', type: 'digital' }, { id: '3b', type: 'digital' }, { id: '3a', type: 'digital' }, { id: '3f', type: 'digital' }, { id: '3g', type: 'digital' }, { id: '3h', type: 'digital' }, { id: '3i', type: 'digital' }, { id: '3j', type: 'digital' }, { id: '4e', type: 'digital' }, { id: '4d', type: 'digital' }, { id: '4c', type: 'digital' }, { id: '4b', type: 'digital' }, { id: '4a', type: 'digital' }, { id: '4f', type: 'digital' }, { id: '4g', type: 'digital' }, { id: '4h', type: 'digital' }, { id: '4i', type: 'digital' }, { id: '4j', type: 'digital' }, { id: '5e', type: 'digital' }, { id: '5d', type: 'digital' }, { id: '5c', type: 'digital' }, { id: '5b', type: 'digital' }, { id: '5a', type: 'digital' }, { id: '5f', type: 'digital' }, { id: '5g', type: 'digital' }, { id: '5h', type: 'digital' }, { id: '5i', type: 'digital' }, { id: '5j', type: 'digital' }, { id: '6e', type: 'digital' }, { id: '6d', type: 'digital' }, { id: '6c', type: 'digital' }, { id: '6b', type: 'digital' }, { id: '6a', type: 'digital' }, { id: '6f', type: 'digital' }, { id: '6g', type: 'digital' }, { id: '6h', type: 'digital' }, { id: '6i', type: 'digital' }, { id: '6j', type: 'digital' }, { id: '7e', type: 'digital' }, { id: '7d', type: 'digital' }, { id: '7c', type: 'digital' }, { id: '7b', type: 'digital' }, { id: '7a', type: 'digital' }, { id: '7f', type: 'digital' }, { id: '7g', type: 'digital' }, { id: '7h', type: 'digital' }, { id: '7i', type: 'digital' }, { id: '7j', type: 'digital' }, { id: '8e', type: 'digital' }, { id: '8d', type: 'digital' }, { id: '8c', type: 'digital' }, { id: '8b', type: 'digital' }, { id: '8a', type: 'digital' }, { id: '8f', type: 'digital' }, { id: '8g', type: 'digital' }, { id: '8h', type: 'digital' }, { id: '8i', type: 'digital' }, { id: '8j', type: 'digital' }, { id: '9e', type: 'digital' }, { id: '9d', type: 'digital' }, { id: '9c', type: 'digital' }, { id: '9b', type: 'digital' }, { id: '9a', type: 'digital' }, { id: '9f', type: 'digital' }, { id: '9g', type: 'digital' }, { id: '9h', type: 'digital' }, { id: '9i', type: 'digital' }, { id: '9j', type: 'digital' }, { id: '10e', type: 'digital' }, { id: '10d', type: 'digital' }, { id: '10c', type: 'digital' }, { id: '10b', type: 'digital' }, { id: '10a', type: 'digital' }, { id: '10f', type: 'digital' }, { id: '10g', type: 'digital' }, { id: '10h', type: 'digital' }, { id: '10i', type: 'digital' }, { id: '10j', type: 'digital' }, { id: '11e', type: 'digital' }, { id: '11d', type: 'digital' }, { id: '11c', type: 'digital' }, { id: '11b', type: 'digital' }, { id: '11a', type: 'digital' }, { id: '11f', type: 'digital' }, { id: '11g', type: 'digital' }, { id: '11h', type: 'digital' }, { id: '11i', type: 'digital' }, { id: '11j', type: 'digital' }, { id: '12e', type: 'digital' }, { id: '12d', type: 'digital' }, { id: '12c', type: 'digital' }, { id: '12b', type: 'digital' }, { id: '12a', type: 'digital' }, { id: '12f', type: 'digital' }, { id: '12g', type: 'digital' }, { id: '12h', type: 'digital' }, { id: '12i', type: 'digital' }, { id: '12j', type: 'digital' }, { id: '13e', type: 'digital' }, { id: '13d', type: 'digital' }, { id: '13c', type: 'digital' }, { id: '13b', type: 'digital' }, { id: '13a', type: 'digital' }, { id: '13f', type: 'digital' }, { id: '13g', type: 'digital' }, { id: '13h', type: 'digital' }, { id: '13i', type: 'digital' }, { id: '13j', type: 'digital' }, { id: '14e', type: 'digital' }, { id: '14d', type: 'digital' }, { id: '14c', type: 'digital' }, { id: '14b', type: 'digital' }, { id: '14a', type: 'digital' }, { id: '14f', type: 'digital' }, { id: '14g', type: 'digital' }, { id: '14h', type: 'digital' }, { id: '14i', type: 'digital' }, { id: '14j', type: 'digital' }, { id: '15e', type: 'digital' }, { id: '15d', type: 'digital' }, { id: '15c', type: 'digital' }, { id: '15b', type: 'digital' }, { id: '15a', type: 'digital' }, { id: '15f', type: 'digital' }, { id: '15g', type: 'digital' }, { id: '15h', type: 'digital' }, { id: '15i', type: 'digital' }, { id: '15j', type: 'digital' }, { id: '16e', type: 'digital' }, { id: '16d', type: 'digital' }, { id: '16c', type: 'digital' }, { id: '16b', type: 'digital' }, { id: '16a', type: 'digital' }, { id: '16f', type: 'digital' }, { id: '16g', type: 'digital' }, { id: '16h', type: 'digital' }, { id: '16i', type: 'digital' }, { id: '16j', type: 'digital' }, { id: '17e', type: 'digital' }, { id: '17d', type: 'digital' }, { id: '17c', type: 'digital' }, { id: '17b', type: 'digital' }, { id: '17a', type: 'digital' }, { id: '17f', type: 'digital' }, { id: '17g', type: 'digital' }, { id: '17h', type: 'digital' }, { id: '17i', type: 'digital' }, { id: '17j', type: 'digital' }],
    'openhw-buzzer': [{ id: 'GND', type: 'power' }, { id: 'SIG', type: 'digital' }],
    'openhw-cc1101': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'MOSI', type: 'digital' }, { id: 'SCK', type: 'digital' }, { id: 'MISO', type: 'digital' }, { id: 'GDO2', type: 'digital' }, { id: 'GDO0', type: 'digital' }, { id: 'CSN', type: 'digital' }],
    'openhw-charger': [{ id: 'IN+' }, { id: 'IN-' }, { id: 'BAT+' }, { id: 'BAT-' }],
    'openhw-dht22': [{ id: 'VCC', type: 'power' }, { id: 'DATA', type: 'digital' }, { id: 'NC', type: 'digital' }, { id: 'GND', type: 'power' }],
    'openhw-diode': [{ id: 'A', type: 'digital' }, { id: 'C', type: 'digital' }],
    'openhw-ds1307-rtc': [{ id: 'SQ_2', type: 'output' }, { id: 'DS_2', type: 'bidirectional' }, { id: 'SCL_2', type: 'input' }, { id: 'SDA_2', type: 'bidirectional' }, { id: 'VCC_2', type: 'input' }, { id: 'GND_2', type: 'input' }, { id: 'BAT_2', type: 'output' }, { id: 'DS', type: 'bidirectional' }, { id: 'SCL', type: 'input' }, { id: 'SDA', type: 'bidirectional' }, { id: 'VCC', type: 'input' }, { id: 'GND', type: 'input' }],
    'openhw-ds18b20': [{ id: 'GND', type: 'power' }, { id: 'DQ', type: 'bidirectional' }, { id: 'VCC', type: 'power' }],
    'openhw-ePaperDisplay': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'DIN', type: 'input' }, { id: 'CLK', type: 'input' }, { id: 'CS', type: 'input' }, { id: 'DC', type: 'input' }, { id: 'RST', type: 'input' }, { id: 'BUSY', type: 'output' }],
    'openhw-esp32': [{ id: 'EN' }, { id: 'VP' }, { id: 'VN' }, { id: '34' }, { id: '35' }, { id: '32' }, { id: '33' }, { id: '25' }, { id: '26' }, { id: '27' }, { id: '14' }, { id: '12' }, { id: '13' }, { id: 'GND.2', type: 'power' }, { id: 'VIN', type: 'power' }, { id: '23' }, { id: '22' }, { id: '1' }, { id: '3' }, { id: '21' }, { id: '19' }, { id: '18' }, { id: '5' }, { id: '17' }, { id: '16' }, { id: '4' }, { id: '2' }, { id: '15' }, { id: 'GND.1', type: 'power' }, { id: '3V3', type: 'power' }],
    'openhw-esp32-cam': [{ id: '5V.1', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: '12' }, { id: '13' }, { id: '15' }, { id: '14' }, { id: '2' }, { id: '4' }, { id: '3V3', type: 'power' }, { id: '16' }, { id: '0' }, { id: 'GND.2', type: 'power' }, { id: 'VCC', type: 'power' }, { id: '3' }, { id: '1' }, { id: 'GND.3', type: 'power' }],
    'openhw-hc-sr04': [{ id: 'VCC', type: 'power' }, { id: 'TRIG', type: 'digital' }, { id: 'ECHO', type: 'digital' }, { id: 'GND', type: 'power' }],
    'openhw-hp4067': [{ id: 'GND', type: 'power' }, { id: 'VCC', type: 'power' }, { id: 'EN', type: 'digital' }, { id: 'S3', type: 'digital' }, { id: 'S2', type: 'digital' }, { id: 'S1', type: 'digital' }, { id: 'S0', type: 'digital' }, { id: 'SIG', type: 'analog' }, { id: 'C15', type: 'analog' }, { id: 'C14', type: 'analog' }, { id: 'C13', type: 'analog' }, { id: 'C12', type: 'analog' }, { id: 'C11', type: 'analog' }, { id: 'C10', type: 'analog' }, { id: 'C9', type: 'analog' }, { id: 'C8', type: 'analog' }, { id: 'C7', type: 'analog' }, { id: 'C6', type: 'analog' }, { id: 'C5', type: 'analog' }, { id: 'C4', type: 'analog' }, { id: 'C3', type: 'analog' }, { id: 'C2', type: 'analog' }, { id: 'C1', type: 'analog' }, { id: 'C0', type: 'analog' }],
    'openhw-hx711_5': [{ id: 'GND', type: 'ground' }, { id: 'DT', type: 'digital' }, { id: 'SCK', type: 'digital' }, { id: 'VCC', type: 'power' }],
    'openhw-hx711_50': [{ id: 'GND', type: 'ground' }, { id: 'DT', type: 'digital' }, { id: 'SCK', type: 'digital' }, { id: 'VCC', type: 'power' }],
    'openhw-ili9341': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'CS', type: 'digital' }, { id: 'RESET', type: 'digital' }, { id: 'DC', type: 'digital' }, { id: 'MOSI', type: 'digital' }, { id: 'SCK', type: 'digital' }, { id: 'LED', type: 'digital' }, { id: 'MISO', type: 'digital' }],
    'openhw-ili9341-touch': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'CS', type: 'digital' }, { id: 'RESET', type: 'digital' }, { id: 'DC', type: 'digital' }, { id: 'MOSI', type: 'digital' }, { id: 'SCK', type: 'digital' }, { id: 'LED', type: 'digital' }, { id: 'MISO', type: 'digital' }, { id: 'SCL', type: 'digital' }, { id: 'SDA', type: 'bidirectional' }],
    'openhw-image': [],
    'openhw-inmp441': [{ id: 'VDD' }, { id: 'GND' }, { id: 'L/R' }, { id: 'WS' }, { id: 'SCK' }, { id: 'SD' }],
    'openhw-ir-receiver': [{ id: 'GND', type: 'power' }, { id: 'VCC', type: 'power' }, { id: 'OUT', type: 'digital' }],
    'openhw-ir-remote': [],
    'openhw-ks2e-m-dc5': [{ id: 'COIL1', type: 'input' }, { id: 'COIL2', type: 'input' }, { id: 'P1', type: 'passive' }, { id: 'NC1', type: 'passive' }, { id: 'NO1', type: 'passive' }, { id: 'P2', type: 'passive' }, { id: 'NC2', type: 'passive' }, { id: 'NO2', type: 'passive' }],
    'openhw-l293d': [{ id: 'EN1,2', type: 'digital' }, { id: 'IN1', type: 'digital' }, { id: 'OUT1', type: 'digital' }, { id: 'GND1', type: 'power' }, { id: 'GND2', type: 'power' }, { id: 'OUT2', type: 'digital' }, { id: 'IN2', type: 'digital' }, { id: 'VCC2', type: 'power' }, { id: 'VCC1', type: 'power' }, { id: 'IN4', type: 'digital' }, { id: 'OUT4', type: 'digital' }, { id: 'GND4', type: 'power' }, { id: 'GND3', type: 'power' }, { id: 'OUT3', type: 'digital' }, { id: 'IN3', type: 'digital' }, { id: 'EN3,4', type: 'digital' }],
    'openhw-lcd1602': [{ id: 'VSS', type: 'power' }, { id: 'VDD', type: 'power' }, { id: 'V0', type: 'analog' }, { id: 'RS', type: 'digital' }, { id: 'RW', type: 'digital' }, { id: 'E', type: 'digital' }, { id: 'D0', type: 'digital' }, { id: 'D1', type: 'digital' }, { id: 'D2', type: 'digital' }, { id: 'D3', type: 'digital' }, { id: 'D4', type: 'digital' }, { id: 'D5', type: 'digital' }, { id: 'D6', type: 'digital' }, { id: 'D7', type: 'digital' }, { id: 'A', type: 'power' }, { id: 'K', type: 'power' }],
    'openhw-lcd1602-i2c': [{ id: 'GND', type: 'power' }, { id: 'VCC', type: 'power' }, { id: 'SDA', type: 'bidi' }, { id: 'SCL', type: 'bidi' }],
    'openhw-lcd2004': [{ id: 'VSS' }, { id: 'VDD' }, { id: 'V0' }, { id: 'RS' }, { id: 'RW' }, { id: 'E' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'A' }, { id: 'K' }],
    'openhw-lcd2004-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'openhw-ldr-module': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'DO', type: 'output' }, { id: 'AO', type: 'analog' }],
    'openhw-led': [{ id: 'A', type: 'input' }, { id: 'K', type: 'input' }],
    'openhw-logic-analyzer': [{ id: 'GND', type: 'power' }, { id: 'D0', type: 'digital' }, { id: 'D1', type: 'digital' }, { id: 'D2', type: 'digital' }, { id: 'D3', type: 'digital' }, { id: 'D4', type: 'digital' }, { id: 'D5', type: 'digital' }, { id: 'D6', type: 'digital' }, { id: 'D7', type: 'digital' }],
    'openhw-ltdc-display': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }],
    'openhw-max7219': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'DIN', type: 'input' }, { id: 'CS', type: 'input' }, { id: 'CLK', type: 'input' }, { id: 'VCC_OUT', type: 'power' }, { id: 'GND_OUT', type: 'power' }, { id: 'DOUT', type: 'output' }, { id: 'CS_OUT', type: 'output' }, { id: 'CLK_OUT', type: 'output' }],
    'openhw-max98357': [{ id: 'LRC' }, { id: 'BCLK' }, { id: 'DIN' }, { id: 'GAIN' }, { id: 'SD' }, { id: 'GND' }, { id: 'VIN' }, { id: 'OUT+' }, { id: 'OUT-' }],
    'openhw-membrane-keypad': [{ id: 'R1', type: 'passive' }, { id: 'R2', type: 'passive' }, { id: 'R3', type: 'passive' }, { id: 'R4', type: 'passive' }, { id: 'C1', type: 'passive' }, { id: 'C2', type: 'passive' }, { id: 'C3', type: 'passive' }, { id: 'C4', type: 'passive' }],
    'openhw-mfrc522': [{ id: '3V3', type: 'power' }, { id: 'RST', type: 'digital' }, { id: 'GND', type: 'power' }, { id: 'IRQ', type: 'digital' }, { id: 'MISO', type: 'digital' }, { id: 'MOSI', type: 'digital' }, { id: 'SCK', type: 'digital' }, { id: 'SDA', type: 'digital' }],
    'openhw-motor': [{ id: '1', type: 'power' }, { id: '2', type: 'power' }],
    'openhw-motor-driver': [{ id: 'ENA', type: 'digital' }, { id: 'IN1', type: 'digital' }, { id: 'IN2', type: 'digital' }, { id: 'IN3', type: 'digital' }, { id: 'IN4', type: 'digital' }, { id: 'ENB', type: 'digital' }, { id: 'OUT1', type: 'analog' }, { id: 'OUT2', type: 'analog' }, { id: 'OUT3', type: 'analog' }, { id: 'OUT4', type: 'analog' }, { id: '12V', type: 'power' }, { id: 'GND', type: 'power' }, { id: '5V', type: 'power' }],
    'openhw-mpu6050': [{ id: 'INT', type: 'output' }, { id: 'AD0', type: 'input' }, { id: 'XCL', type: 'output' }, { id: 'XDA', type: 'bidirectional' }, { id: 'SDA', type: 'bidirectional' }, { id: 'SCL', type: 'input' }, { id: 'GND', type: 'input' }, { id: 'VCC', type: 'input' }],
    'openhw-mq2-gas-sensor': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'DO', type: 'digital' }, { id: 'AO', type: 'analog' }],
    'openhw-neopixel-matrix': [{ id: 'VCC', type: 'power' }, { id: 'DIN', type: 'digital' }, { id: 'GND', type: 'power' }, { id: 'DOUT', type: 'digital' }],
    'openhw-neopixel-ring': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'DIN', type: 'digital' }, { id: 'DOUT', type: 'digital' }],
    'openhw-nlsf595': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'MOSI', type: 'digital' }, { id: 'SCK', type: 'digital' }, { id: 'CS', type: 'digital' }, { id: 'R1', type: 'digital' }, { id: 'G1', type: 'digital' }, { id: 'B1', type: 'digital' }],
    'openhw-nokia-5110': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'SCE', type: 'digital' }, { id: 'RST', type: 'digital' }, { id: 'DC', type: 'digital' }, { id: 'DN', type: 'digital' }, { id: 'SCLK', type: 'digital' }, { id: 'LED', type: 'digital' }],
    'openhw-npn-transistor': [{ id: 'E', type: 'digital' }, { id: 'B', type: 'digital' }, { id: 'C', type: 'digital' }],
    'openhw-nrf24l01': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'CE', type: 'digital' }, { id: 'CSN', type: 'digital' }, { id: 'SCK', type: 'digital' }, { id: 'MOSI', type: 'digital' }, { id: 'MISO', type: 'digital' }, { id: 'IRQ', type: 'digital' }],
    'openhw-ntc-temperature-sensor': [{ id: 'GND', type: 'passive' }, { id: 'VCC', type: 'passive' }, { id: 'OUT', type: 'passive' }],
    'openhw-ntc-thermistor': [{ id: 'A0', type: 'analog_output' }, { id: 'D0', type: 'digital_output' }, { id: 'GND', type: 'power' }, { id: 'VCC', type: 'power' }],
    'openhw-pca9685': [{ id: 'SDA', type: 'digital' }, { id: 'SCL', type: 'digital' }, { id: 'TXD', type: 'digital' }, { id: 'RXD', type: 'digital' }, { id: '#4', type: 'digital' }, { id: '#17', type: 'digital' }, { id: '#18', type: 'digital' }, { id: '#27', type: 'digital' }, { id: '#22', type: 'digital' }, { id: '#23', type: 'digital' }, { id: '#24', type: 'digital' }, { id: '#25', type: 'digital' }, { id: 'MOSI', type: 'digital' }, { id: 'MISO', type: 'digital' }, { id: 'CLK', type: 'digital' }, { id: 'CE0', type: 'digital' }, { id: 'CE1', type: 'digital' }, { id: '#5', type: 'digital' }, { id: '#6', type: 'digital' }, { id: '#12', type: 'digital' }, { id: '#13', type: 'digital' }, { id: '#16', type: 'digital' }, { id: '#19', type: 'digital' }, { id: '#20', type: 'digital' }, { id: '#21', type: 'digital' }, { id: 'GND_IN', type: 'power' }, { id: 'VCC_IN', type: 'power' }, { id: '5.0V', type: 'power' }, { id: '3.3V', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'S0', type: 'digital' }, { id: 'V+0', type: 'power' }, { id: 'G0', type: 'power' }, { id: 'S1', type: 'digital' }, { id: 'V+1', type: 'power' }, { id: 'G1', type: 'power' }, { id: 'S2', type: 'digital' }, { id: 'V+2', type: 'power' }, { id: 'G2', type: 'power' }, { id: 'S3', type: 'digital' }, { id: 'V+3', type: 'power' }, { id: 'G3', type: 'power' }, { id: 'S4', type: 'digital' }, { id: 'V+4', type: 'power' }, { id: 'G4', type: 'power' }, { id: 'S5', type: 'digital' }, { id: 'V+5', type: 'power' }, { id: 'G5', type: 'power' }, { id: 'S6', type: 'digital' }, { id: 'V+6', type: 'power' }, { id: 'G6', type: 'power' }, { id: 'S7', type: 'digital' }, { id: 'V+7', type: 'power' }, { id: 'G7', type: 'power' }, { id: 'S8', type: 'digital' }, { id: 'V+8', type: 'power' }, { id: 'G8', type: 'power' }, { id: 'S9', type: 'digital' }, { id: 'V+9', type: 'power' }, { id: 'G9', type: 'power' }, { id: 'S10', type: 'digital' }, { id: 'V+10', type: 'power' }, { id: 'G10', type: 'power' }, { id: 'S11', type: 'digital' }, { id: 'V+11', type: 'power' }, { id: 'G11', type: 'power' }, { id: 'S12', type: 'digital' }, { id: 'V+12', type: 'power' }, { id: 'G12', type: 'power' }, { id: 'S13', type: 'digital' }, { id: 'V+13', type: 'power' }, { id: 'G13', type: 'power' }, { id: 'S14', type: 'digital' }, { id: 'V+14', type: 'power' }, { id: 'G14', type: 'power' }, { id: 'S15', type: 'digital' }, { id: 'V+15', type: 'power' }, { id: 'G15', type: 'power' }],
    'openhw-pca9865': [{ id: 'GND', type: 'power' }, { id: 'OE', type: 'digital' }, { id: 'SCL', type: 'digital' }, { id: 'SDA', type: 'digital' }, { id: 'VCC', type: 'power' }, { id: 'V+', type: 'power' }, { id: 'GND_R', type: 'power' }, { id: 'OE_R', type: 'digital' }, { id: 'SCL_R', type: 'digital' }, { id: 'SDA_R', type: 'digital' }, { id: 'VCC_R', type: 'power' }, { id: 'V+_R', type: 'power' }, { id: 'V+_IN', type: 'power' }, { id: 'GND_IN', type: 'power' }, { id: 'S0', type: 'digital' }, { id: 'V+0', type: 'power' }, { id: 'G0', type: 'power' }, { id: 'S1', type: 'digital' }, { id: 'V+1', type: 'power' }, { id: 'G1', type: 'power' }, { id: 'S2', type: 'digital' }, { id: 'V+2', type: 'power' }, { id: 'G2', type: 'power' }, { id: 'S3', type: 'digital' }, { id: 'V+3', type: 'power' }, { id: 'G3', type: 'power' }, { id: 'S4', type: 'digital' }, { id: 'V+4', type: 'power' }, { id: 'G4', type: 'power' }, { id: 'S5', type: 'digital' }, { id: 'V+5', type: 'power' }, { id: 'G5', type: 'power' }, { id: 'S6', type: 'digital' }, { id: 'V+6', type: 'power' }, { id: 'G6', type: 'power' }, { id: 'S7', type: 'digital' }, { id: 'V+7', type: 'power' }, { id: 'G7', type: 'power' }, { id: 'S8', type: 'digital' }, { id: 'V+8', type: 'power' }, { id: 'G8', type: 'power' }, { id: 'S9', type: 'digital' }, { id: 'V+9', type: 'power' }, { id: 'G9', type: 'power' }, { id: 'S10', type: 'digital' }, { id: 'V+10', type: 'power' }, { id: 'G10', type: 'power' }, { id: 'S11', type: 'digital' }, { id: 'V+11', type: 'power' }, { id: 'G11', type: 'power' }, { id: 'S12', type: 'digital' }, { id: 'V+12', type: 'power' }, { id: 'G12', type: 'power' }, { id: 'S13', type: 'digital' }, { id: 'V+13', type: 'power' }, { id: 'G13', type: 'power' }, { id: 'S14', type: 'digital' }, { id: 'V+14', type: 'power' }, { id: 'G14', type: 'power' }, { id: 'S15', type: 'digital' }, { id: 'V+15', type: 'power' }, { id: 'G15', type: 'power' }],
    'openhw-pcm5102': [{ id: 'VCC' }, { id: 'GND' }, { id: 'FLT' }, { id: 'DMP' }, { id: 'XMT' }, { id: 'FMT' }, { id: 'SCK' }, { id: 'BCK' }, { id: 'DIN' }, { id: 'LCK' }, { id: 'OUTL' }, { id: 'OUTR' }],
    'openhw-photodiode': [{ id: 'A', type: 'analog' }, { id: 'C', type: 'power' }],
    'openhw-photoresistor': [{ id: 'p1', type: 'passive' }, { id: 'p2', type: 'passive' }],
    'openhw-pico': [{ id: 'GP0', type: 'digital' }, { id: 'GP1', type: 'digital' }, { id: 'GND', type: 'power' }, { id: 'GP2', type: 'digital' }, { id: 'GP3', type: 'digital' }, { id: 'GP4', type: 'digital' }, { id: 'GP5', type: 'digital' }, { id: 'GND_1', type: 'power' }, { id: 'GP6', type: 'digital' }, { id: 'GP7', type: 'digital' }, { id: 'GP8', type: 'digital' }, { id: 'GP9', type: 'digital' }, { id: 'GND_2', type: 'power' }, { id: 'GP10', type: 'digital' }, { id: 'GP11', type: 'digital' }, { id: 'GP12', type: 'digital' }, { id: 'GP13', type: 'digital' }, { id: 'GND_3', type: 'power' }, { id: 'GP14', type: 'digital' }, { id: 'GP15', type: 'digital' }, { id: 'VBUS', type: 'power' }, { id: 'VSYS', type: 'power' }, { id: 'GND_4', type: 'power' }, { id: '3V3_EN', type: 'power' }, { id: '3V3', type: 'power' }, { id: 'ADC_VREF', type: 'power' }, { id: 'GP28', type: 'analog' }, { id: 'AGND', type: 'power' }, { id: 'GP27', type: 'analog' }, { id: 'GP26', type: 'analog' }, { id: 'RUN', type: 'power' }, { id: 'GP22', type: 'digital' }, { id: 'GND_5', type: 'power' }, { id: 'GP21', type: 'digital' }, { id: 'GP20', type: 'digital' }, { id: 'GP19', type: 'digital' }, { id: 'GP18', type: 'digital' }, { id: 'GND_6', type: 'power' }, { id: 'GP17', type: 'digital' }, { id: 'GP16', type: 'digital' }, { id: '13', type: 'digital' }, { id: '2', type: 'digital' }, { id: '5V', type: 'power' }, { id: 'A4', type: 'analog' }, { id: 'A5', type: 'analog' }, { id: 'SCK', type: 'digital' }, { id: 'MOSI', type: 'digital' }, { id: 'MISO', type: 'digital' }, { id: 'SS', type: 'digital' }],
    'openhw-pico-2': [{ id: 'GP0', type: 'digital' }, { id: 'GP1', type: 'digital' }, { id: 'GND', type: 'power' }, { id: 'GP2', type: 'digital' }, { id: 'GP3', type: 'digital' }, { id: 'GP4', type: 'digital' }, { id: 'GP5', type: 'digital' }, { id: 'GND_1', type: 'power' }, { id: 'GP6', type: 'digital' }, { id: 'GP7', type: 'digital' }, { id: 'GP8', type: 'digital' }, { id: 'GP9', type: 'digital' }, { id: 'GND_2', type: 'power' }, { id: 'GP10', type: 'digital' }, { id: 'GP11', type: 'digital' }, { id: 'GP12', type: 'digital' }, { id: 'GP13', type: 'digital' }, { id: 'GND_3', type: 'power' }, { id: 'GP14', type: 'digital' }, { id: 'GP15', type: 'digital' }, { id: 'VBUS', type: 'power' }, { id: 'VSYS', type: 'power' }, { id: 'GND_4', type: 'power' }, { id: '3V3_EN', type: 'power' }, { id: '3V3', type: 'power' }, { id: 'ADC_VREF', type: 'power' }, { id: 'GP28', type: 'analog' }, { id: 'AGND', type: 'power' }, { id: 'GP27', type: 'analog' }, { id: 'GP26', type: 'analog' }, { id: 'RUN', type: 'power' }, { id: 'GP22', type: 'digital' }, { id: 'GND_5', type: 'power' }, { id: 'GP21', type: 'digital' }, { id: 'GP20', type: 'digital' }, { id: 'GP19', type: 'digital' }, { id: 'GP18', type: 'digital' }, { id: 'GND_6', type: 'power' }, { id: 'GP17', type: 'digital' }, { id: 'GP16', type: 'digital' }, { id: '13', type: 'digital' }, { id: '2', type: 'digital' }, { id: '5V', type: 'power' }, { id: 'A4', type: 'analog' }, { id: 'A5', type: 'analog' }, { id: 'SCK', type: 'digital' }, { id: 'MOSI', type: 'digital' }, { id: 'MISO', type: 'digital' }, { id: 'SS', type: 'digital' }],
    'openhw-pico-2-eth': [{ id: 'GP0', type: 'digital' }, { id: 'GP1', type: 'digital' }, { id: 'GND', type: 'power' }, { id: 'GP2', type: 'digital' }, { id: 'GP3', type: 'digital' }, { id: 'GP4', type: 'digital' }, { id: 'GP5', type: 'digital' }, { id: 'GND_1', type: 'power' }, { id: 'GP6', type: 'digital' }, { id: 'GP7', type: 'digital' }, { id: 'GP8', type: 'digital' }, { id: 'GP9', type: 'digital' }, { id: 'GND_2', type: 'power' }, { id: 'GP10', type: 'digital' }, { id: 'GP11', type: 'digital' }, { id: 'GP12', type: 'digital' }, { id: 'GP13', type: 'digital' }, { id: 'GND_3', type: 'power' }, { id: 'GP14', type: 'digital' }, { id: 'GP15', type: 'digital' }, { id: 'VBUS', type: 'power' }, { id: 'VSYS', type: 'power' }, { id: 'GND_4', type: 'power' }, { id: '3V3_EN', type: 'power' }, { id: '3V3', type: 'power' }, { id: 'ADC_VREF', type: 'power' }, { id: 'GP28', type: 'analog' }, { id: 'AGND', type: 'power' }, { id: 'GP27', type: 'analog' }, { id: 'GP26', type: 'analog' }, { id: 'RUN', type: 'power' }, { id: 'GP22', type: 'digital' }, { id: 'GND_5', type: 'power' }, { id: 'GP21', type: 'digital' }, { id: 'GP20', type: 'digital' }, { id: 'GP19', type: 'digital' }, { id: 'GP18', type: 'digital' }, { id: 'GND_6', type: 'power' }, { id: 'GP17', type: 'digital' }, { id: 'GP16', type: 'digital' }, { id: '13', type: 'digital' }, { id: '2', type: 'digital' }, { id: '5V', type: 'power' }, { id: 'A4', type: 'analog' }, { id: 'A5', type: 'analog' }, { id: 'SCK', type: 'digital' }, { id: 'MOSI', type: 'digital' }, { id: 'MISO', type: 'digital' }, { id: 'SS', type: 'digital' }],
    'openhw-pico-2-w': [{ id: 'GP0', type: 'digital' }, { id: 'GP1', type: 'digital' }, { id: 'GND', type: 'power' }, { id: 'GP2', type: 'digital' }, { id: 'GP3', type: 'digital' }, { id: 'GP4', type: 'digital' }, { id: 'GP5', type: 'digital' }, { id: 'GND_1', type: 'power' }, { id: 'GP6', type: 'digital' }, { id: 'GP7', type: 'digital' }, { id: 'GP8', type: 'digital' }, { id: 'GP9', type: 'digital' }, { id: 'GND_2', type: 'power' }, { id: 'GP10', type: 'digital' }, { id: 'GP11', type: 'digital' }, { id: 'GP12', type: 'digital' }, { id: 'GP13', type: 'digital' }, { id: 'GND_3', type: 'power' }, { id: 'GP14', type: 'digital' }, { id: 'GP15', type: 'digital' }, { id: 'VBUS', type: 'power' }, { id: 'VSYS', type: 'power' }, { id: 'GND_4', type: 'power' }, { id: '3V3_EN', type: 'power' }, { id: '3V3', type: 'power' }, { id: 'ADC_VREF', type: 'power' }, { id: 'GP28', type: 'analog' }, { id: 'AGND', type: 'power' }, { id: 'GP27', type: 'analog' }, { id: 'GP26', type: 'analog' }, { id: 'RUN', type: 'power' }, { id: 'GP22', type: 'digital' }, { id: 'GND_5', type: 'power' }, { id: 'GP21', type: 'digital' }, { id: 'GP20', type: 'digital' }, { id: 'GP19', type: 'digital' }, { id: 'GP18', type: 'digital' }, { id: 'GND_6', type: 'power' }, { id: 'GP17', type: 'digital' }, { id: 'GP16', type: 'digital' }, { id: '13', type: 'digital' }, { id: '2', type: 'digital' }, { id: '5V', type: 'power' }, { id: 'A4', type: 'analog' }, { id: 'A5', type: 'analog' }, { id: 'SCK', type: 'digital' }, { id: 'MOSI', type: 'digital' }, { id: 'MISO', type: 'digital' }, { id: 'SS', type: 'digital' }],
    'openhw-pico-eth': [{ id: 'GP0', type: 'digital' }, { id: 'GP1', type: 'digital' }, { id: 'GND', type: 'power' }, { id: 'GP2', type: 'digital' }, { id: 'GP3', type: 'digital' }, { id: 'GP4', type: 'digital' }, { id: 'GP5', type: 'digital' }, { id: 'GND_1', type: 'power' }, { id: 'GP6', type: 'digital' }, { id: 'GP7', type: 'digital' }, { id: 'GP8', type: 'digital' }, { id: 'GP9', type: 'digital' }, { id: 'GND_2', type: 'power' }, { id: 'GP10', type: 'digital' }, { id: 'GP11', type: 'digital' }, { id: 'GP12', type: 'digital' }, { id: 'GP13', type: 'digital' }, { id: 'GND_3', type: 'power' }, { id: 'GP14', type: 'digital' }, { id: 'GP15', type: 'digital' }, { id: 'VBUS', type: 'power' }, { id: 'VSYS', type: 'power' }, { id: 'GND_4', type: 'power' }, { id: '3V3_EN', type: 'power' }, { id: '3V3', type: 'power' }, { id: 'ADC_VREF', type: 'power' }, { id: 'GP28', type: 'analog' }, { id: 'AGND', type: 'power' }, { id: 'GP27', type: 'analog' }, { id: 'GP26', type: 'analog' }, { id: 'RUN', type: 'power' }, { id: 'GP22', type: 'digital' }, { id: 'GND_5', type: 'power' }, { id: 'GP21', type: 'digital' }, { id: 'GP20', type: 'digital' }, { id: 'GP19', type: 'digital' }, { id: 'GP18', type: 'digital' }, { id: 'GND_6', type: 'power' }, { id: 'GP17', type: 'digital' }, { id: 'GP16', type: 'digital' }, { id: '13', type: 'digital' }, { id: '2', type: 'digital' }, { id: '5V', type: 'power' }, { id: 'A4', type: 'analog' }, { id: 'A5', type: 'analog' }, { id: 'SCK', type: 'digital' }, { id: 'MOSI', type: 'digital' }, { id: 'MISO', type: 'digital' }, { id: 'SS', type: 'digital' }],
    'openhw-pico-w': [{ id: 'GP0', type: 'digital' }, { id: 'GP1', type: 'digital' }, { id: 'GND', type: 'power' }, { id: 'GP2', type: 'digital' }, { id: 'GP3', type: 'digital' }, { id: 'GP4', type: 'digital' }, { id: 'GP5', type: 'digital' }, { id: 'GND_1', type: 'power' }, { id: 'GP6', type: 'digital' }, { id: 'GP7', type: 'digital' }, { id: 'GP8', type: 'digital' }, { id: 'GP9', type: 'digital' }, { id: 'GND_2', type: 'power' }, { id: 'GP10', type: 'digital' }, { id: 'GP11', type: 'digital' }, { id: 'GP12', type: 'digital' }, { id: 'GP13', type: 'digital' }, { id: 'GND_3', type: 'power' }, { id: 'GP14', type: 'digital' }, { id: 'GP15', type: 'digital' }, { id: 'VBUS', type: 'power' }, { id: 'VSYS', type: 'power' }, { id: 'GND_4', type: 'power' }, { id: '3V3_EN', type: 'power' }, { id: '3V3', type: 'power' }, { id: 'ADC_VREF', type: 'power' }, { id: 'GP28', type: 'analog' }, { id: 'AGND', type: 'power' }, { id: 'GP27', type: 'analog' }, { id: 'GP26', type: 'analog' }, { id: 'RUN', type: 'power' }, { id: 'GP22', type: 'digital' }, { id: 'GND_5', type: 'power' }, { id: 'GP21', type: 'digital' }, { id: 'GP20', type: 'digital' }, { id: 'GP19', type: 'digital' }, { id: 'GP18', type: 'digital' }, { id: 'GND_6', type: 'power' }, { id: 'GP17', type: 'digital' }, { id: 'GP16', type: 'digital' }, { id: '13', type: 'digital' }, { id: '2', type: 'digital' }, { id: '5V', type: 'power' }, { id: 'A4', type: 'analog' }, { id: 'A5', type: 'analog' }],
    'openhw-potentiometer': [{ id: '1', type: 'power' }, { id: 'SIG', type: 'analog' }, { id: '2', type: 'power' }],
    'openhw-power-supply': [{ id: '5V', type: 'power' }, { id: 'GND', type: 'power' }],
    'openhw-pushbutton': [{ id: '1l', type: 'passive' }, { id: '2l', type: 'passive' }, { id: '1r', type: 'passive' }, { id: '2r', type: 'passive' }],
    'openhw-pushbutton-6mm': [{ id: '1A', type: 'passive' }, { id: '1B', type: 'passive' }, { id: '2A', type: 'passive' }, { id: '2B', type: 'passive' }],
    'openhw-raindrop-module': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'DO', type: 'digital' }, { id: 'AO', type: 'analog' }, { id: 'PAD+', type: 'analog' }, { id: 'PAD-', type: 'power' }],
    'openhw-raindrop-pad': [{ id: 'AOUT', type: 'analog' }, { id: 'GND', type: 'power' }],
    'openhw-relay-module': [{ id: 'VCC', type: 'input' }, { id: 'GND', type: 'input' }, { id: 'IN', type: 'input' }, { id: 'NO', type: 'passive' }, { id: 'COM', type: 'passive' }, { id: 'NC', type: 'passive' }],
    'openhw-resistor': [{ id: 'p1', type: 'passive' }, { id: 'p2', type: 'passive' }],
    'openhw-rgb-led': [{ id: 'R', type: 'digital' }, { id: 'COM', type: 'digital' }, { id: 'G', type: 'digital' }, { id: 'B', type: 'digital' }],
    'openhw-rotary-encoder': [{ id: 'CLK', type: 'digital' }, { id: 'DT', type: 'digital' }, { id: 'SW', type: 'digital' }, { id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }],
    'openhw-rv32': [{ id: 'L0', type: 'digital_inout' }, { id: 'L1', type: 'digital_inout' }, { id: 'L2', type: 'digital_inout' }, { id: 'L3', type: 'digital_inout' }, { id: 'L4', type: 'digital_inout' }, { id: 'L5', type: 'digital_inout' }, { id: 'L6', type: 'digital_inout' }, { id: 'L7', type: 'digital_inout' }, { id: 'L8', type: 'digital_inout' }, { id: 'L9', type: 'digital_inout' }, { id: 'L10', type: 'digital_inout' }, { id: 'L11', type: 'digital_inout' }, { id: 'L12', type: 'digital_inout' }, { id: 'L13', type: 'digital_inout' }, { id: 'L14', type: 'digital_inout' }, { id: 'L15', type: 'digital_inout' }, { id: 'L16', type: 'digital_inout' }, { id: 'L17', type: 'digital_inout' }, { id: 'L18', type: 'digital_inout' }, { id: 'L19', type: 'digital_inout' }, { id: 'R0', type: 'digital_inout' }, { id: 'R1', type: 'digital_inout' }, { id: 'R2', type: 'digital_inout' }, { id: 'R3', type: 'digital_inout' }, { id: 'R4', type: 'digital_inout' }, { id: 'R5', type: 'digital_inout' }, { id: 'R6', type: 'digital_inout' }, { id: 'R7', type: 'digital_inout' }, { id: 'R8', type: 'digital_inout' }, { id: 'R9', type: 'digital_inout' }, { id: 'R10', type: 'digital_inout' }, { id: 'R11', type: 'digital_inout' }, { id: 'R12', type: 'digital_inout' }, { id: 'R13', type: 'digital_inout' }, { id: 'R14', type: 'digital_inout' }, { id: 'R15', type: 'digital_inout' }, { id: 'R16', type: 'digital_inout' }, { id: 'R17', type: 'digital_inout' }, { id: 'R18', type: 'digital_inout' }, { id: 'R19', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-sd-card': [{ id: 'CD', type: 'digital' }, { id: 'MISO', type: 'digital' }, { id: 'GND', type: 'power' }, { id: 'SCK', type: 'digital' }, { id: 'VCC', type: 'power' }, { id: 'MOSI', type: 'digital' }, { id: 'CS', type: 'digital' }],
    'openhw-servo': [{ id: 'GND', type: 'power' }, { id: 'V+', type: 'power' }, { id: 'PWM', type: 'digital' }],
    'openhw-simulation-monitor': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }, { id: 'TX', type: 'digital' }, { id: 'RX', type: 'digital' }],
    'openhw-slide-potentiometer': [{ id: 'GND', type: 'power' }, { id: 'SIG', type: 'analog' }, { id: 'VCC', type: 'power' }],
    'openhw-slide-switch': [{ id: '1', type: 'passive' }, { id: '2', type: 'passive' }, { id: '3', type: 'passive' }],
    'openhw-soil-moisture-sensor': [{ id: 'GND', type: 'power' }, { id: 'VCC', type: 'power' }, { id: 'SIG', type: 'digital' }],
    'openhw-sph0645': [{ id: '3V' }, { id: 'GND' }, { id: 'BCLK' }, { id: 'DOUT' }, { id: 'LRCL' }, { id: 'SEL' }],
    'openhw-ssd1306-oled': [{ id: 'GND', type: 'power' }, { id: 'VCC', type: 'power' }, { id: 'SCL', type: 'input' }, { id: 'SDA', type: 'bidirectional' }],
    'openhw-stepper-motor': [{ id: 'A-', type: 'digital' }, { id: 'A+', type: 'digital' }, { id: 'B+', type: 'digital' }, { id: 'B-', type: 'digital' }],
    'openhw-stm32-bluepill': [{ id: 'VBAT', type: 'power' }, { id: 'PC13', type: 'digital_inout' }, { id: 'PC14', type: 'digital_inout' }, { id: 'PC15', type: 'digital_inout' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB10', type: 'digital_inout' }, { id: 'PB11', type: 'digital_inout' }, { id: 'RESET', type: 'digital_inout' }, { id: '3V3.1', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: '5V', type: 'power' }, { id: 'PB9', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB5', type: 'digital_inout' }, { id: 'PB4', type: 'digital_inout' }, { id: 'PB3', type: 'digital_inout' }, { id: 'PA15', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA8', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-stm32-gd32f103c8': [{ id: 'VBAT', type: 'power' }, { id: 'PC13', type: 'digital_inout' }, { id: 'PC14', type: 'digital_inout' }, { id: 'PC15', type: 'digital_inout' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB10', type: 'digital_inout' }, { id: 'PB11', type: 'digital_inout' }, { id: 'RESET', type: 'power' }, { id: '3V3.1', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: '5V', type: 'power' }, { id: 'PB9', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB5', type: 'digital_inout' }, { id: 'PB4', type: 'digital_inout' }, { id: 'PB3', type: 'digital_inout' }, { id: 'PA15', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA8', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-stm32-gd32f103cb': [{ id: 'VBAT', type: 'power' }, { id: 'PC13', type: 'digital_inout' }, { id: 'PC14', type: 'digital_inout' }, { id: 'PC15', type: 'digital_inout' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB10', type: 'digital_inout' }, { id: 'PB11', type: 'digital_inout' }, { id: 'RESET', type: 'power' }, { id: '3V3.1', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: '5V', type: 'power' }, { id: 'PB9', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB5', type: 'digital_inout' }, { id: 'PB4', type: 'digital_inout' }, { id: 'PB3', type: 'digital_inout' }, { id: 'PA15', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA8', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-stm32-gd32f103rb': [{ id: 'VBAT', type: 'power' }, { id: 'PC13', type: 'digital_inout' }, { id: 'PC14', type: 'digital_inout' }, { id: 'PC15', type: 'digital_inout' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB10', type: 'digital_inout' }, { id: 'PB11', type: 'digital_inout' }, { id: 'RESET', type: 'power' }, { id: '3V3.1', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: '5V', type: 'power' }, { id: 'PB9', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB5', type: 'digital_inout' }, { id: 'PB4', type: 'digital_inout' }, { id: 'PB3', type: 'digital_inout' }, { id: 'PA15', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA8', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-stm32-maple-mini': [{ id: 'VBAT', type: 'power' }, { id: 'PC13', type: 'digital_inout' }, { id: 'PC14', type: 'digital_inout' }, { id: 'PC15', type: 'digital_inout' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB10', type: 'digital_inout' }, { id: 'PB11', type: 'digital_inout' }, { id: 'RESET', type: 'power' }, { id: '3V3.1', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: '5V', type: 'power' }, { id: 'PB9', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB5', type: 'digital_inout' }, { id: 'PB4', type: 'digital_inout' }, { id: 'PB3', type: 'digital_inout' }, { id: 'PA15', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA8', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-stm32-nucleo-f103rb': [{ id: 'VBAT', type: 'power' }, { id: 'PC13', type: 'digital_inout' }, { id: 'PC14', type: 'digital_inout' }, { id: 'PC15', type: 'digital_inout' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB10', type: 'digital_inout' }, { id: 'PB11', type: 'digital_inout' }, { id: 'RESET', type: 'power' }, { id: '3V3.1', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: '5V', type: 'power' }, { id: 'PB9', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB5', type: 'digital_inout' }, { id: 'PB4', type: 'digital_inout' }, { id: 'PB3', type: 'digital_inout' }, { id: 'PA15', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA8', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-stm32f103cb': [{ id: 'VBAT', type: 'power' }, { id: 'PC13', type: 'digital_inout' }, { id: 'PC14', type: 'digital_inout' }, { id: 'PC15', type: 'digital_inout' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB10', type: 'digital_inout' }, { id: 'PB11', type: 'digital_inout' }, { id: 'RESET', type: 'power' }, { id: '3V3.1', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: '5V', type: 'power' }, { id: 'PB9', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB5', type: 'digital_inout' }, { id: 'PB4', type: 'digital_inout' }, { id: 'PB3', type: 'digital_inout' }, { id: 'PA15', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA8', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-stm32f103rc': [{ id: 'VBAT', type: 'power' }, { id: 'PC13', type: 'digital_inout' }, { id: 'PC14', type: 'digital_inout' }, { id: 'PC15', type: 'digital_inout' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB10', type: 'digital_inout' }, { id: 'PB11', type: 'digital_inout' }, { id: 'RESET', type: 'power' }, { id: '3V3.1', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: '5V', type: 'power' }, { id: 'PB9', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB5', type: 'digital_inout' }, { id: 'PB4', type: 'digital_inout' }, { id: 'PB3', type: 'digital_inout' }, { id: 'PA15', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA8', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-stm32f4': [{ id: '5V', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: '3V3', type: 'power' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB9', type: 'digital_inout' }, { id: 'RESET', type: 'digital_inout' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: 'PC0', type: 'digital_inout' }, { id: 'PC1', type: 'digital_inout' }, { id: 'PD12', type: 'digital_inout' }, { id: 'PD13', type: 'digital_inout' }, { id: 'PD14', type: 'digital_inout' }, { id: 'PD15', type: 'digital_inout' }, { id: 'PC6', type: 'digital_inout' }, { id: 'PC7', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-stm32f401': [{ id: '5V', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: '3V3', type: 'power' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB9', type: 'digital_inout' }, { id: 'RESET', type: 'digital_inout' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: 'PC0', type: 'digital_inout' }, { id: 'PC1', type: 'digital_inout' }, { id: 'PD12', type: 'digital_inout' }, { id: 'PD13', type: 'digital_inout' }, { id: 'PD14', type: 'digital_inout' }, { id: 'PD15', type: 'digital_inout' }, { id: 'PC6', type: 'digital_inout' }, { id: 'PC7', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-stm32f407ve': [{ id: '5V', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: '3V3', type: 'power' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB9', type: 'digital_inout' }, { id: 'RESET', type: 'digital_inout' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: 'PC0', type: 'digital_inout' }, { id: 'PC1', type: 'digital_inout' }, { id: 'PD12', type: 'digital_inout' }, { id: 'PD13', type: 'digital_inout' }, { id: 'PD14', type: 'digital_inout' }, { id: 'PD15', type: 'digital_inout' }, { id: 'PC6', type: 'digital_inout' }, { id: 'PC7', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-stm32f411': [{ id: '5V', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: '3V3', type: 'power' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB9', type: 'digital_inout' }, { id: 'RESET', type: 'digital_inout' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: 'PC0', type: 'digital_inout' }, { id: 'PC1', type: 'digital_inout' }, { id: 'PD12', type: 'digital_inout' }, { id: 'PD13', type: 'digital_inout' }, { id: 'PD14', type: 'digital_inout' }, { id: 'PD15', type: 'digital_inout' }, { id: 'PC6', type: 'digital_inout' }, { id: 'PC7', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-stm32f429': [{ id: '5V', type: 'power' }, { id: 'GND.1', type: 'power' }, { id: '3V3', type: 'power' }, { id: 'PA0', type: 'digital_inout' }, { id: 'PA1', type: 'digital_inout' }, { id: 'PA2', type: 'digital_inout' }, { id: 'PA3', type: 'digital_inout' }, { id: 'PA4', type: 'digital_inout' }, { id: 'PA5', type: 'digital_inout' }, { id: 'PA6', type: 'digital_inout' }, { id: 'PA7', type: 'digital_inout' }, { id: 'PB0', type: 'digital_inout' }, { id: 'PB1', type: 'digital_inout' }, { id: 'PB6', type: 'digital_inout' }, { id: 'PB7', type: 'digital_inout' }, { id: 'PB8', type: 'digital_inout' }, { id: 'PB9', type: 'digital_inout' }, { id: 'RESET', type: 'digital_inout' }, { id: 'GND.2', type: 'power' }, { id: '3V3.2', type: 'power' }, { id: 'GND.3', type: 'power' }, { id: 'PC0', type: 'digital_inout' }, { id: 'PC1', type: 'digital_inout' }, { id: 'PD12', type: 'digital_inout' }, { id: 'PD13', type: 'digital_inout' }, { id: 'PD14', type: 'digital_inout' }, { id: 'PD15', type: 'digital_inout' }, { id: 'PC6', type: 'digital_inout' }, { id: 'PC7', type: 'digital_inout' }, { id: 'PA9', type: 'digital_inout' }, { id: 'PA10', type: 'digital_inout' }, { id: 'PA11', type: 'digital_inout' }, { id: 'PA12', type: 'digital_inout' }, { id: 'PB12', type: 'digital_inout' }, { id: 'PB13', type: 'digital_inout' }, { id: 'PB14', type: 'digital_inout' }, { id: 'PB15', type: 'digital_inout' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'openhw-text': [],
    'openhw-tm1637-7segment': [{ id: 'CLK', type: 'digital' }, { id: 'DIO', type: 'digital' }, { id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }],
    'openhw-usb-device': [{ id: 'VCC', type: 'power' }, { id: 'GND', type: 'power' }],
    'openhw-z80': [{ id: 'L0', type: 'digital_inout' }, { id: 'L1', type: 'digital_inout' }, { id: 'L2', type: 'digital_inout' }, { id: 'L3', type: 'digital_inout' }, { id: 'L4', type: 'digital_inout' }, { id: 'L5', type: 'digital_inout' }, { id: 'L6', type: 'digital_inout' }, { id: 'L7', type: 'digital_inout' }, { id: 'L8', type: 'digital_inout' }, { id: 'L9', type: 'digital_inout' }, { id: 'L10', type: 'digital_inout' }, { id: 'L11', type: 'digital_inout' }, { id: 'L12', type: 'digital_inout' }, { id: 'L13', type: 'digital_inout' }, { id: 'L14', type: 'digital_inout' }, { id: 'L15', type: 'digital_inout' }, { id: 'L16', type: 'digital_inout' }, { id: 'L17', type: 'digital_inout' }, { id: 'L18', type: 'digital_inout' }, { id: 'L19', type: 'digital_inout' }, { id: 'R0', type: 'digital_inout' }, { id: 'R1', type: 'digital_inout' }, { id: 'R2', type: 'digital_inout' }, { id: 'R3', type: 'digital_inout' }, { id: 'R4', type: 'digital_inout' }, { id: 'R5', type: 'digital_inout' }, { id: 'R6', type: 'digital_inout' }, { id: 'R7', type: 'digital_inout' }, { id: 'R8', type: 'digital_inout' }, { id: 'R9', type: 'digital_inout' }, { id: 'R10', type: 'digital_inout' }, { id: 'R11', type: 'digital_inout' }, { id: 'R12', type: 'digital_inout' }, { id: 'R13', type: 'digital_inout' }, { id: 'R14', type: 'digital_inout' }, { id: 'R15', type: 'digital_inout' }, { id: 'R16', type: 'digital_inout' }, { id: 'R17', type: 'digital_inout' }, { id: 'R18', type: 'digital_inout' }, { id: 'R19', type: 'digital_inout' }, { id: 'SWD_3V3', type: 'power' }, { id: 'SWDIO', type: 'digital_inout' }, { id: 'SWCLK', type: 'digital_inout' }, { id: 'SWD_GND', type: 'power' }],
    'wokwi-pir-motion-sensor': [{ id: 'VCC', type: 'power' }, { id: 'OUT', type: 'digital' }, { id: 'GND', type: 'power' }],
    'openhw-6mm-pushbutton': [{ id: '1A' }, { id: '1B' }, { id: '2A' }, { id: '2B' }], // ORPHAN: no manifest — hand-checked
    'wokwi-led': [{ id: 'A' }, { id: 'K' }], // ORPHAN: no manifest — hand-checked
    'wokwi-resistor': [{ id: 'p1' }, { id: 'p2' }], // ORPHAN: no manifest — hand-checked
    'wokwi-slide-switch': [{ id: '1' }, { id: '2' }, { id: '3' }], // ORPHAN: no manifest — hand-checked
    'wokwi-pushbutton': [{ id: '1l' }, { id: '2l' }, { id: '1r' }, { id: '2r' }, { id: '1' }, { id: '2' }], // ORPHAN: no manifest — hand-checked
    'wokwi-buzzer': [{ id: '1' }, { id: '2' }], // ORPHAN: no manifest — hand-checked
    'wokwi-neopixel-matrix': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'wokwi-ws2812b': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'openhw-ws2812b': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'wokwi-ws2821b': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'openhw-ws2821b': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'wokwi-servo': [{ id: 'GND' }, { id: 'V+' }, { id: 'PWM' }], // ORPHAN: no manifest — hand-checked
    'wokwi-motor': [{ id: '1' }, { id: '2' }], // ORPHAN: no manifest — hand-checked
    'wokwi-motor-driver': [{ id: 'ENA' }, { id: 'ENB' }, { id: 'IN1' }, { id: 'IN2' }, { id: 'IN3' }, { id: 'IN4' }, { id: 'OUT1' }, { id: 'OUT2' }, { id: 'OUT3' }, { id: 'OUT4' }, { id: '12V' }, { id: '5V' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'wokwi-potentiometer': [{ id: '1' }, { id: '2' }, { id: 'SIG' }], // ORPHAN: no manifest — hand-checked
    'wokwi-slide-potentiometer': [{ id: 'GND' }, { id: 'SIG' }, { id: 'VCC' }], // ORPHAN: no manifest — hand-checked
    'wokwi-lcd2004-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }], // ORPHAN: no manifest — hand-checked
    'wokwi-lcd1602': [{ id: 'VSS' }, { id: 'VDD' }, { id: 'V0' }, { id: 'RS' }, { id: 'RW' }, { id: 'E' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'A' }, { id: 'K' }], // ORPHAN: no manifest — hand-checked
    'wokwi-lcd2004': [{ id: 'VSS' }, { id: 'VDD' }, { id: 'V0' }, { id: 'RS' }, { id: 'RW' }, { id: 'E' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'A' }, { id: 'K' }], // ORPHAN: no manifest — hand-checked
    'wokwi-lcd1602-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }], // ORPHAN: no manifest — hand-checked
    'wokwi-ssd1306-oled': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SCL' }, { id: 'SDA' }], // ORPHAN: no manifest — hand-checked
    'wokwi-max7219': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DIN' }, { id: 'CS' }, { id: 'CLK' }, { id: 'VCC_OUT' }, { id: 'GND_OUT' }, { id: 'DOUT' }, { id: 'CS_OUT' }, { id: 'CLK_OUT' }], // ORPHAN: no manifest — hand-checked
    'wokwi-ldr-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }], // ORPHAN: no manifest — hand-checked
    'wokwi-7segment': [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }, { id: 'F' }, { id: 'G' }, { id: 'DP' }, { id: 'DIG1' }, { id: 'DIG2' }, { id: 'DIG3' }, { id: 'DIG4' }, { id: 'COLON' }], // ORPHAN: no manifest — hand-checked
    'wokwi-ili9341': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'RESET' }, { id: 'DC' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'LED' }, { id: 'MISO' }], // ORPHAN: no manifest — hand-checked
    'wokwi-sd-card': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'SCK' }, { id: 'MOSI' }, { id: 'MISO' }], // ORPHAN: no manifest — hand-checked
    'wokwi-power-supply': [{ id: 'GND' }, { id: '5V' }, { id: 'VCC' }], // ORPHAN: no manifest — hand-checked
    'shift_register': [{ id: 'vcc' }, { id: 'gnd' }, { id: 'ser' }, { id: 'srclk' }, { id: 'rclk' }, { id: 'oe' }, { id: 'srclr' }, { id: 'q0' }, { id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }, { id: 'q6' }, { id: 'q7' }, { id: 'q7s' }], // ORPHAN: no manifest — hand-checked
    'wokwi-membrane-keypad': [{ id: 'R1' }, { id: 'R2' }, { id: 'R3' }, { id: 'R4' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }], // ORPHAN: no manifest — hand-checked
    'wokwi-analog-joystick': [{ id: 'GND' }, { id: 'VCC' }, { id: 'VRX' }, { id: 'VRY' }, { id: 'SW' }], // ORPHAN: no manifest — hand-checked
    'wokwi-rotary-encoder': [{ id: 'CLK' }, { id: 'DT' }, { id: 'SW' }, { id: 'VCC' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'wokwi-tm1637-7segment': [{ id: 'CLK' }, { id: 'DIO' }, { id: 'VCC' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'wokwi-neopixel-ring': [{ id: 'DIN' }, { id: 'VDD' }, { id: 'VSS' }, { id: 'DOUT' }], // ORPHAN: no manifest — hand-checked
    'wokwi-rgb-led': [{ id: 'R' }, { id: 'COM' }, { id: 'G' }, { id: 'B' }], // ORPHAN: no manifest — hand-checked
    'wokwi-nokia-5110': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SCE' }, { id: 'RST' }, { id: 'DC' }, { id: 'DN' }, { id: 'SCLK' }, { id: 'LED' }], // ORPHAN: no manifest — hand-checked
    'wokwi-l293d': [{ id: 'EN1,2' }, { id: 'IN1' }, { id: 'OUT1' }, { id: 'GND1' }, { id: 'GND2' }, { id: 'OUT2' }, { id: 'IN2' }, { id: 'VCC2' }, { id: 'VCC1' }, { id: 'IN4' }, { id: 'OUT4' }, { id: 'GND4' }, { id: 'GND3' }, { id: 'OUT3' }, { id: 'IN3' }, { id: 'EN3,4' }], // ORPHAN: no manifest — hand-checked
    'wokwi-arduino-nano': [{ id: 'D0' }, { id: 'RX' }, { id: 'D1' }, { id: 'TX' }, { id: 'D2' }, { id: '2' }, { id: 'D3' }, { id: '3' }, { id: 'D4' }, { id: '4' }, { id: 'D5' }, { id: '5' }, { id: 'D6' }, { id: '6' }, { id: 'D7' }, { id: '7' }, { id: 'D8' }, { id: '8' }, { id: 'D9' }, { id: '9' }, { id: 'D10' }, { id: '10' }, { id: 'D11' }, { id: '11' }, { id: 'D12' }, { id: '12' }, { id: 'D13' }, { id: '13' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: '5V' }, { id: 'VCC' }, { id: '3V3' }, { id: 'GND' }, { id: 'GND.1' }, { id: 'GND.2' }, { id: 'RST' }, { id: 'RST.1' }, { id: 'RST.2' }, { id: 'VIN' }, { id: 'AREF' }], // ORPHAN: no manifest — hand-checked
    'openhw-dip-switch-8': [{ id: '1a' }, { id: '1b' }, { id: '2a' }, { id: '2b' }, { id: '3a' }, { id: '3b' }, { id: '4a' }, { id: '4b' }, { id: '5a' }, { id: '5b' }, { id: '6a' }, { id: '6b' }, { id: '7a' }, { id: '7b' }, { id: '8a' }, { id: '8b' }], // ORPHAN: no manifest — hand-checked
    'wokwi-pca9685': [{ id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'VCC' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'S4' }, { id: 'S5' }, { id: 'S6' }, { id: 'S7' }, { id: 'S8' }, { id: 'S9' }, { id: 'S10' }, { id: 'S11' }, { id: 'S12' }, { id: 'S13' }, { id: 'S14' }, { id: 'S15' }], // ORPHAN: no manifest — hand-checked
    'wokwi-pca9865': [{ id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'VCC' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'S4' }, { id: 'S5' }, { id: 'S6' }, { id: 'S7' }, { id: 'S8' }, { id: 'S9' }, { id: 'S10' }, { id: 'S11' }, { id: 'S12' }, { id: 'S13' }, { id: 'S14' }, { id: 'S15' }], // ORPHAN: no manifest — hand-checked
    'wokwi-soil-moisture-sensor': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SIG' }], // ORPHAN: no manifest — hand-checked
    'wokwi-cd74hc4067': [{ id: 'VCC' }, { id: 'GND' }, { id: 'EN' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'SIG' }, { id: 'C0' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }, { id: 'C5' }, { id: 'C6' }, { id: 'C7' }, { id: 'C8' }, { id: 'C9' }, { id: 'C10' }, { id: 'C11' }, { id: 'C12' }, { id: 'C13' }, { id: 'C14' }, { id: 'C15' }], // ORPHAN: no manifest — hand-checked
    'openhw-cd74hc4067': [{ id: 'VCC' }, { id: 'GND' }, { id: 'EN' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'SIG' }, { id: 'C0' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }, { id: 'C5' }, { id: 'C6' }, { id: 'C7' }, { id: 'C8' }, { id: 'C9' }, { id: 'C10' }, { id: 'C11' }, { id: 'C12' }, { id: 'C13' }, { id: 'C14' }, { id: 'C15' }], // ORPHAN: no manifest — hand-checked
    'wokwi-logic-analyzer': [{ id: 'GND' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }], // ORPHAN: no manifest — hand-checked
    'wokwi-photodiode': [{ id: 'A' }, { id: 'C' }], // ORPHAN: no manifest — hand-checked
    'wokwi-diode': [{ id: 'A' }, { id: 'C' }], // ORPHAN: no manifest — hand-checked
    'wokwi-npn-transistor': [{ id: 'E' }, { id: 'B' }, { id: 'C' }], // ORPHAN: no manifest — hand-checked
    'wokwi-a4988': [{ id: 'ENABLE' }, { id: 'MS1' }, { id: 'MS2' }, { id: 'MS3' }, { id: 'RESET' }, { id: 'SLEEP' }, { id: 'STEP' }, { id: 'DIR' }, { id: 'VMOT' }, { id: 'GND_MOT' }, { id: '2B' }, { id: '2A' }, { id: '1A' }, { id: '1B' }, { id: 'VDD' }, { id: 'GND_LOGIC' }], // ORPHAN: no manifest — hand-checked
    'wokwi-bmp180': [{ id: 'VIN' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }], // ORPHAN: no manifest — hand-checked
    'openhw-bmp180': [{ id: 'VIN' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }], // ORPHAN: no manifest — hand-checked
    'wokwi-bmp180-breakout': [{ id: 'VIN' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }], // ORPHAN: no manifest — hand-checked
    'wokwi-ds1307-rtc': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }], // ORPHAN: no manifest — hand-checked
    'wokwi-hc-sr04': [{ id: 'VCC' }, { id: 'TRIG' }, { id: 'ECHO' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'wokwi-mpu6050': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SCL' }, { id: 'SDA' }, { id: 'XDA' }, { id: 'XCL' }, { id: 'AD0' }, { id: 'INT' }], // ORPHAN: no manifest — hand-checked
    'wokwi-nlsf595': [{ id: 'VCC' }, { id: 'GND' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'CS' }, { id: 'R1' }, { id: 'G1' }, { id: 'B1' }], // ORPHAN: no manifest — hand-checked
    'wokwi-relay-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'IN' }, { id: 'NO' }, { id: 'NC' }, { id: 'COM' }], // ORPHAN: no manifest — hand-checked
    'wokwi-stepper-motor': [{ id: 'A+' }, { id: 'A-' }, { id: 'B+' }, { id: 'B-' }], // ORPHAN: no manifest — hand-checked
    'wokwi-arduino-mega': [{ id: 'D0' }, { id: 'RX0' }, { id: 'D1' }, { id: 'TX0' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }, { id: 'D8' }, { id: 'D9' }, { id: 'D10' }, { id: 'D11' }, { id: 'D12' }, { id: 'D13' }, { id: 'D14' }, { id: 'TX3' }, { id: 'D15' }, { id: 'RX3' }, { id: 'D16' }, { id: 'TX2' }, { id: 'D17' }, { id: 'RX2' }, { id: 'D18' }, { id: 'TX1' }, { id: 'D19' }, { id: 'RX1' }, { id: 'D20' }, { id: 'SDA' }, { id: 'D21' }, { id: 'SCL' }, { id: 'D22' }, { id: 'D23' }, { id: 'D24' }, { id: 'D25' }, { id: 'D26' }, { id: 'D27' }, { id: 'D28' }, { id: 'D29' }, { id: 'D30' }, { id: 'D31' }, { id: 'D32' }, { id: 'D33' }, { id: 'D34' }, { id: 'D35' }, { id: 'D36' }, { id: 'D37' }, { id: 'D38' }, { id: 'D39' }, { id: 'D40' }, { id: 'D41' }, { id: 'D42' }, { id: 'D43' }, { id: 'D44' }, { id: 'D45' }, { id: 'D46' }, { id: 'D47' }, { id: 'D48' }, { id: 'D49' }, { id: 'D50' }, { id: 'MISO' }, { id: 'D51' }, { id: 'MOSI' }, { id: 'D52' }, { id: 'SCK' }, { id: 'D53' }, { id: 'SS' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: 'A8' }, { id: 'A9' }, { id: 'A10' }, { id: 'A11' }, { id: 'A12' }, { id: 'A13' }, { id: 'A14' }, { id: 'A15' }, { id: '5V' }, { id: '3V3' }, { id: 'GND' }, { id: 'GND.1' }, { id: 'GND.2' }, { id: 'RST' }, { id: 'VIN' }, { id: 'AREF' }, { id: 'IORF' }], // ORPHAN: no manifest — hand-checked
    'wokwi-attiny85': [{ id: 'PB0' }, { id: 'PB1' }, { id: 'PB2' }, { id: 'PB3' }, { id: 'PB4' }, { id: 'PB5' }, { id: 'VCC' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'wokwi-battery': [{ id: 'VCC' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'wokwi-ds18b20': [{ id: 'GND' }, { id: 'DQ' }, { id: 'VDD' }], // ORPHAN: no manifest — hand-checked
    'wokwi-ir-receiver': [{ id: 'OUT' }, { id: 'GND' }, { id: 'VCC' }], // ORPHAN: no manifest — hand-checked
    'wokwi-mfrc522': [{ id: '3V3' }, { id: 'RST' }, { id: 'GND' }, { id: 'IRQ' }, { id: 'MISO' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'SDA' }], // ORPHAN: no manifest — hand-checked
    'openhw-mcp2518fd': [{ id: 'CS' }, { id: 'MOSI' }, { id: 'MISO' }, { id: 'SCK' }, { id: 'VCC' }, { id: 'GND' }, { id: 'INT' }, { id: 'TXCAN' }, { id: 'RXCAN' }], // ORPHAN: no manifest — hand-checked
    'DHT-22': [{ id: 'VCC' }, { id: 'DATA' }, { id: 'NC' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'MQ-2 Gas Sensor': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }], // ORPHAN: no manifest — hand-checked
    'openhw-pir-motion-sensor': [{ id: 'VCC' }, { id: 'OUT' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
    'wokwi-raindrop-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }, { id: 'PAD+' }, { id: 'PAD-' }], // ORPHAN: no manifest — hand-checked
    'wokwi-raindrop-pad': [{ id: 'AOUT' }, { id: 'GND' }], // ORPHAN: no manifest — hand-checked
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

/**
 * Component capability declaration (plan §5.6/§11).
 * Derives the capability vocabulary from manifest pin names — the same
 * mapping resolveLogicClass uses to pick a protocol base — so tests and
 * the conformance matrix can ask "what does this component need" without
 * importing logic or touching runners. Additive; behavior-neutral.
 * Vocabulary: digital-in/out, analog-in, pwm-in, i2c-target, spi-target,
 * uart, onewire, i2s.
 */
export function getComponentCapabilities(type: string): string[] {
    const out = new Set<string>();
    const pins = ((COMPONENT_PINS as any)[type] || []).map((p: any) => String(p?.id ?? p).toUpperCase());
    if (!pins.length) return [];
    const has = (...names: string[]) => pins.some((p: string) => names.includes(p));
    const hasAny = (names: string[]) => pins.some((p: string) => names.includes(p));
    // Digital presence: any board-wirable signal pin implies digital I/O.
    out.add('digital-in');
    out.add('digital-out');
    if (has('SDA') && has('SCL')) out.add('i2c-target');
    if (hasAny(['MOSI', 'DIN', 'SDI', 'MISO'])) out.add('spi-target');
    if (hasAny(['PWM', 'SIG'])) out.add('pwm-in');
    if (hasAny(['TX', 'TXD', 'RX', 'RXD'])) out.add('uart');
    if (hasAny(['DQ', 'DATA'])) out.add('onewire');
    if (hasAny(['AO', 'AOUT'])) out.add('analog-in');
    if (has('BCK', 'BCLK') && hasAny(['LRCK', 'LCK', 'WS', 'LRC', 'LRCLK'])) out.add('i2s');
    return Array.from(out);
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

/** River telemetry schema version (plan §5.5): additive evolution only. */
export const TELEMETRY_SCHEMA_VERSION = 1;

/**
 * Sampling policy for one telemetry ingest decision (plan §5.5).
 * Encodes the exact throttle semantics TelemetryManager applies:
 * default 250 ms window scaled by sim speed, 50 ms floor, and Delta mode
 * never throttles (throttling would permanently lose mutations).
 */
export interface TelemetrySamplePolicy {
  throttleMs: number;
  bypassThrottle: boolean;
}

export function telemetrySamplePolicy(
  telemetryMode: unknown,
  telemetrySampleInterval: unknown,
  simulationSpeed: unknown,
): TelemetrySamplePolicy {
  const safeSpeed = Number.isFinite(Number(simulationSpeed)) && Number(simulationSpeed) > 0 ? Number(simulationSpeed) : 1.0;
  const baseInterval = Number.isFinite(Number(telemetrySampleInterval)) ? Number(telemetrySampleInterval) : 250;
  return {
    throttleMs: Math.max(50, baseInterval / safeSpeed),
    bypassThrottle: telemetryMode === 'delta',
  };
}

/** Pure ingest gate: true when this message may be formatted/emitted now. */
export function shouldEmitTelemetrySample(lastEmitMs: number, nowMs: number, policy: TelemetrySamplePolicy): boolean {
  if (policy.bypassThrottle) return true;
  return nowMs - lastEmitMs >= policy.throttleMs;
}

/**
 * Validate a collected telemetry payload against the schema contract
 * (plan §5.5, Phase 3 seed): versioned when present, never silently
 * misshapen. Disabled telemetry (`{}`) is valid by design.
 */
export function validateTelemetrySchema(payload: any): { ok: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (payload === null || payload === undefined || typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, reasons: ['telemetry payload must be a plain object'] };
    }
    if (Object.keys(payload).length === 0) return { ok: true, reasons: [] }; // disabled telemetry
    if (!('schemaVersion' in payload)) {
        reasons.push('missing schemaVersion (collect via collectComponentTelemetry)');
    } else if ((payload as any).schemaVersion !== TELEMETRY_SCHEMA_VERSION) {
        reasons.push(`unsupported schemaVersion ${(payload as any).schemaVersion}, want ${TELEMETRY_SCHEMA_VERSION}`);
    }
    const data = (payload as any).telemetryData;
    if (data !== undefined && (typeof data !== 'object' || data === null || Array.isArray(data))) {
        reasons.push('telemetryData must be an object when present');
    }
    return { ok: reasons.length === 0, reasons };
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

    // River telemetry schema marker (plan §5.5/§11.4): additive version tag
    // so consumers can evolve without silent misreads. Unknown fields are
    // ignored by older readers; removal/rename requires a version bump.
    out.schemaVersion = TELEMETRY_SCHEMA_VERSION;
    return out;
}
