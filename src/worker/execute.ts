import { CPU, timer0Config, timer1Config, timer2Config, AVRTimer, avrInstruction, AVRADC, adcConfig, AVRUSART, usart0Config, AVRTWI, twiConfig, AVRSPI, spiConfig, AVRIOPort, portBConfig, portCConfig, portDConfig, PinState } from 'avr8js';

import { BaseComponent } from '@openhw/emulator/src/components/BaseComponent.ts';
import { LEDLogic } from '@openhw/emulator/src/components/wokwi-led/logic.ts';
import { UnoLogic } from '@openhw/emulator/src/components/wokwi-arduino-uno/logic.ts';
import { ResistorLogic } from '@openhw/emulator/src/components/wokwi-resistor/logic.ts';
import { PushbuttonLogic } from '@openhw/emulator/src/components/wokwi-pushbutton/logic.ts';
import { PowerSupplyLogic } from '@openhw/emulator/src/components/wokwi-power-supply/logic.ts';
import { NeopixelLogic } from '@openhw/emulator/src/components/wokwi-neopixel-matrix/logic.ts';
import { BuzzerLogic } from '@openhw/emulator/src/components/wokwi-buzzer/logic.ts';
import { MotorLogic } from '@openhw/emulator/src/components/wokwi-motor/logic.ts';
import { ServoLogic } from '@openhw/emulator/src/components/wokwi-servo/logic.ts';
import { StepperMotorLogic } from '@openhw/emulator/src/components/wokwi-stepper-motor/logic.ts';
import { RotaryEncoderLogic } from '@openhw/emulator/src/components/wokwi-rotary-encoder/logic.ts';
import { MotorDriverLogic } from '@openhw/emulator/src/components/wokwi-motor-driver/logic.ts';
import { SlidePotLogic } from '@openhw/emulator/src/components/wokwi-slide-potentiometer/logic.ts';
import { PotentiometerLogic } from '@openhw/emulator/src/components/wokwi-potentiometer/logic.ts';
import { ShiftRegisterLogic } from '@openhw/emulator/src/components/shift_register/logic.ts';
import { JoystickLogic } from '@openhw/emulator/src/components/wokwi-analog-joystick/logic.ts';
import { AndGateLogic } from '@openhw/emulator/src/components/logic-and-gate/logic.ts';
import { OrGateLogic } from '@openhw/emulator/src/components/logic-or-gate/logic.ts';
import { NotGateLogic } from '@openhw/emulator/src/components/logic-not-gate/logic.ts';
import { NandGateLogic } from '@openhw/emulator/src/components/logic-nand-gate/logic.ts';
import { NorGateLogic } from '@openhw/emulator/src/components/logic-nor-gate/logic.ts';
import { XorGateLogic } from '@openhw/emulator/src/components/logic-xor-gate/logic.ts';
import { XnorGateLogic } from '@openhw/emulator/src/components/logic-xnor-gate/logic.ts';
import { Mux2to1Logic } from '@openhw/emulator/src/components/logic-mux-2to1/logic.ts';
import { DFlipFlopLogic } from '@openhw/emulator/src/components/logic-d-flipflop/logic.ts';
import { DFlipFlopRLogic } from '@openhw/emulator/src/components/logic-d-flipflop-r/logic.ts';
import { DFlipFlopDsrLogic } from '@openhw/emulator/src/components/logic-d-flipflop-dsr/logic.ts';
import { ClockGeneratorLogic } from '@openhw/emulator/src/components/logic-clock-generator/logic.ts';
import { WokwiTM1637Logic } from '@openhw/emulator/src/components/wokwi-tm1637-7segment/logic.ts';
import { RGBLEDLogic } from '@openhw/emulator/src/components/wokwi-rgb-led/logic.ts';
import { Nokia5110Logic } from '@openhw/emulator/src/components/wokwi-nokia-5110/logic.ts';
import { L293DLogic } from '@openhw/emulator/src/components/wokwi-l293d/logic.ts';
import { Lcd2004I2CLogic } from '@openhw/emulator/src/components/wokwi-lcd2004-i2c/logic.ts';
import { SSD1306Logic } from '@openhw/emulator/src/components/wokwi-ssd1306-oled/logic.ts';
import { PCA9685Logic } from '@openhw/emulator/src/components/wokwi-pca9685/logic.ts';
import { MAX30102Logic } from '@openhw/emulator/src/components/max30102/logic.ts';
import { LdrModuleLogic } from '@openhw/emulator/src/components/wokwi-ldr-module/logic.ts';
import { SoilMoistureSensorLogic } from '@openhw/emulator/src/components/wokwi-soil-moisture-sensor/logic.ts';
import { PhotodiodeLogic } from '@openhw/emulator/src/components/wokwi-photodiode/logic.ts';
import { DiodeLogic } from '@openhw/emulator/src/components/wokwi-diode/logic.ts';
import { NPNTransistorLogic } from '@openhw/emulator/src/components/wokwi-npn-transistor/logic.ts';
import { MAX7219Logic } from '@openhw/emulator/src/components/wokwi-max7219/logic.ts';
import { A4988Logic } from '@openhw/emulator/src/components/wokwi-a4988/logic.ts';
import { Wokwi7SegmentLogic } from '@openhw/emulator/src/components/wokwi-7segment/logic.ts';
import { ILI9341Logic } from '@openhw/emulator/src/components/wokwi-ili9341/logic.ts';
import { CD74HC4067Logic } from '@openhw/emulator/src/components/wokwi-cd74hc4067/logic.ts';
import { LogicAnalyzerLogic } from '@openhw/emulator/src/components/wokwi-logic-analyzer/logic.ts';
// ── Membrane Keypad Logic (defined inline to avoid Rollup web-worker resolution issues) ────
class KeypadLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = { pressedKey: null, connectedPair: null };
    }
    onEvent(event: string) {
        if (event.startsWith('press:')) {
            const key = event.split(':')[1];
            const matrix: Record<string, [string, string]> = {
                '1': ['R1', 'C1'], '2': ['R1', 'C2'], '3': ['R1', 'C3'], 'A': ['R1', 'C4'],
                '4': ['R2', 'C1'], '5': ['R2', 'C2'], '6': ['R2', 'C3'], 'B': ['R2', 'C4'],
                '7': ['R3', 'C1'], '8': ['R3', 'C2'], '9': ['R3', 'C3'], 'C': ['R3', 'C4'],
                '*': ['R4', 'C1'], '0': ['R4', 'C2'], '#': ['R4', 'C3'], 'D': ['R4', 'C4']
            };
            this.setState({ pressedKey: key, connectedPair: matrix[key] || null });
        } else if (event === 'release') {
            this.setState({ pressedKey: null, connectedPair: null });
        }
    }
}


export function parse(data: string) {
    const lines = data.split('\n');
    let highAddress = 0;
    const maxAddress = 32768; // 32KB typical Uno size
    const result = new Uint8Array(maxAddress);

    for (const line of lines) {
        if (line[0] !== ':') continue;
        const byteCount = parseInt(line.substring(1, 3), 16);
        const address = parseInt(line.substring(3, 7), 16);
        const recordType = parseInt(line.substring(7, 9), 16);

        if (recordType === 0) { // Data record
            for (let i = 0; i < byteCount; i++) {
                const byte = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16);
                const absoluteAddress = highAddress + address + i;
                if (absoluteAddress < maxAddress) {
                    result[absoluteAddress] = byte;
                }
            }
        } else if (recordType === 4 || recordType === 2) { // Extended linear/segment address
            highAddress = parseInt(line.substring(9, 13), 16) << (recordType === 4 ? 16 : 4);
        } // ignore recordTypes 1 (EOF) and others for this simple parser
    }
    return { data: result };
}

export const LOGIC_REGISTRY: Record<string, any> = {
    'wokwi-led': LEDLogic,
    'wokwi-arduino-uno': UnoLogic,
    'wokwi-resistor': ResistorLogic,
    'wokwi-pushbutton': PushbuttonLogic,
    'wokwi-power-supply': PowerSupplyLogic,
    'wokwi-neopixel-matrix': NeopixelLogic,
    'wokwi-neopixel-ring': NeopixelLogic,
    'wokwi-buzzer': BuzzerLogic,
    'wokwi-motor': MotorLogic,
    'wokwi-servo': ServoLogic,
    'wokwi-motor-driver': MotorDriverLogic,
    'wokwi-stepper-motor': StepperMotorLogic,
    'wokwi-rotary-encoder': RotaryEncoderLogic,
    'wokwi-slide-potentiometer': SlidePotLogic,
    'wokwi-potentiometer': PotentiometerLogic,
    'shift_register': ShiftRegisterLogic,
    'wokwi-membrane-keypad': KeypadLogic,
    'wokwi-analog-joystick': JoystickLogic,
    'logic-and-gate': AndGateLogic,
    'logic-or-gate': OrGateLogic,
    'logic-not-gate': NotGateLogic,
    'logic-nand-gate': NandGateLogic,
    'logic-nor-gate': NorGateLogic,
    'logic-xor-gate': XorGateLogic,
    'logic-xnor-gate': XnorGateLogic,
    'logic-mux-2to1': Mux2to1Logic,
    'logic-d-flipflop': DFlipFlopLogic,
    'logic-d-flipflop-r': DFlipFlopRLogic,
    'logic-d-flipflop-dsr': DFlipFlopDsrLogic,
    'logic-clock-generator': ClockGeneratorLogic,
    'wokwi-tm1637-7segment': WokwiTM1637Logic,
    'wokwi-rgb-led': RGBLEDLogic,
    'wokwi-nokia-5110': Nokia5110Logic,
    'wokwi-l293d': L293DLogic,
    'wokwi-arduino-nano': UnoLogic,
    'wokwi-lcd2004-i2c': Lcd2004I2CLogic,
    'wokwi-ssd1306-oled': SSD1306Logic,
    'wokwi-pca9685': PCA9685Logic,
    'max30102': MAX30102Logic,
    'wokwi-ldr-module': LdrModuleLogic,
    'wokwi-soil-moisture-sensor': SoilMoistureSensorLogic,
    'wokwi-photodiode': PhotodiodeLogic,
    'wokwi-diode': DiodeLogic,
    'wokwi-npn-transistor': NPNTransistorLogic,
    'wokwi-max7219': MAX7219Logic,
    'wokwi-a4988': A4988Logic,
    'wokwi-7segment': Wokwi7SegmentLogic,
    'wokwi-ili9341': ILI9341Logic,
    'wokwi-cd74hc4067': CD74HC4067Logic,
    'wokwi-logic-analyzer': LogicAnalyzerLogic,
};

// Per-type pin lists so every component's pins are registered correctly
export const COMPONENT_PINS: Record<string, { id: string }[]> = {
    'wokwi-led': [{ id: 'A' }, { id: 'K' }],
    'wokwi-resistor': [{ id: 'p1' }, { id: 'p2' }],
    'wokwi-pushbutton': [{ id: '1' }, { id: '2' }],
    'wokwi-buzzer': [{ id: '1' }, { id: '2' }],
    'wokwi-servo': [{ id: 'GND' }, { id: 'V+' }, { id: 'PWM' }],
    'wokwi-motor': [{ id: '1' }, { id: '2' }],
    'wokwi-motor-driver': [{ id: 'ENA' }, { id: 'ENB' }, { id: 'IN1' }, { id: 'IN2' }, { id: 'IN3' }, { id: 'IN4' }, { id: 'OUT1' }, { id: 'OUT2' }, { id: 'OUT3' }, { id: 'OUT4' }, { id: '12V' }, { id: '5V' }, { id: 'GND' }],
    'wokwi-stepper-motor': [{ id: 'A+' }, { id: 'A-' }, { id: 'B+' }, { id: 'B-' }],
    'wokwi-rotary-encoder': [{ id: 'CLK' }, { id: 'DT' }, { id: 'SW' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-potentiometer': [{ id: '1' }, { id: '2' }, { id: 'SIG' }],
    'wokwi-slide-potentiometer': [{ id: 'GND' }, { id: 'SIG' }, { id: 'VCC' }],
    'wokwi-power-supply': [{ id: 'GND' }, { id: 'VCC' }],
    'shift_register': [{ id: 'vcc' }, { id: 'gnd' }, { id: 'ser' }, { id: 'srclk' }, { id: 'rclk' }, { id: 'oe' }, { id: 'srclr' }, { id: 'q0' }, { id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }, { id: 'q6' }, { id: 'q7' }, { id: 'q7s' }],
    'wokwi-membrane-keypad': [{ id: 'R1' }, { id: 'R2' }, { id: 'R3' }, { id: 'R4' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }],
    'wokwi-analog-joystick': [{ id: 'GND' }, { id: '5V' }, { id: 'VRX' }, { id: 'VRY' }, { id: 'SW' }],
    'logic-and-gate': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'OUT' }],
    'logic-or-gate': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'OUT' }],
    'logic-not-gate': [{ id: 'IN' }, { id: 'OUT' }],
    'logic-nand-gate': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'OUT' }],
    'logic-nor-gate': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'OUT' }],
    'logic-xor-gate': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'OUT' }],
    'logic-xnor-gate': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'OUT' }],
    'logic-mux-2to1': [{ id: 'D0' }, { id: 'D1' }, { id: 'SEL' }, { id: 'OUT' }],
    'logic-d-flipflop': [{ id: 'D' }, { id: 'CLK' }, { id: 'Q' }, { id: 'Qbar' }],
    'logic-d-flipflop-r': [{ id: 'D' }, { id: 'CLK' }, { id: 'R' }, { id: 'Q' }, { id: 'Qbar' }],
    'logic-d-flipflop-dsr': [{ id: 'D' }, { id: 'CLK' }, { id: 'S' }, { id: 'R' }, { id: 'Q' }, { id: 'Qbar' }],
    'logic-clock-generator': [{ id: 'OUT' }],
    'wokwi-tm1637-7segment': [{ id: 'CLK' }, { id: 'DIO' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-neopixel-ring': [{ id: 'DIN' }, { id: 'VDD' }, { id: 'VSS' }, { id: 'DOUT' }],
    'wokwi-neopixel-matrix': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }, { id: 'DOUT' }],
    'wokwi-rgb-led': [{ id: 'R' }, { id: 'COM' }, { id: 'G' }, { id: 'B' }],
    'wokwi-nokia-5110': [{ id: 'VCC' }, { id: 'GND' }, { id: 'SCE' }, { id: 'RST' }, { id: 'DC' }, { id: 'DN' }, { id: 'SCLK' }, { id: 'LED' }],
    'wokwi-l293d': [{ id: 'EN1,2' }, { id: 'IN1' }, { id: 'OUT1' }, { id: 'GND1' }, { id: 'GND2' }, { id: 'OUT2' }, { id: 'IN2' }, { id: 'VCC2' }, { id: 'VCC1' }, { id: 'IN4' }, { id: 'OUT4' }, { id: 'GND4' }, { id: 'GND3' }, { id: 'OUT3' }, { id: 'IN3' }, { id: 'EN3,4' }],
    'wokwi-arduino-nano': [{ id: 'D0' }, { id: 'RX' }, { id: 'D1' }, { id: 'TX' }, { id: 'D2' }, { id: '2' }, { id: 'D3' }, { id: '3' }, { id: 'D4' }, { id: '4' }, { id: 'D5' }, { id: '5' }, { id: 'D6' }, { id: '6' }, { id: 'D7' }, { id: '7' }, { id: 'D8' }, { id: '8' }, { id: 'D9' }, { id: '9' }, { id: 'D10' }, { id: '10' }, { id: 'D11' }, { id: '11' }, { id: 'D12' }, { id: '12' }, { id: 'D13' }, { id: '13' }, { id: 'A0' }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }, { id: 'A5' }, { id: 'A6' }, { id: 'A7' }, { id: '5V' }, { id: 'VCC' }, { id: '3V3' }, { id: 'GND' }, { id: 'GND.1' }, { id: 'GND.2' }, { id: 'RST' }, { id: 'RST.1' }, { id: 'RST.2' }, { id: 'VIN' }, { id: 'AREF' }],
    'wokwi-lcd2004-i2c': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    'wokwi-ssd1306-oled': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SCL' }, { id: 'SDA' }],
    'wokwi-pca9685': [{ id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'VCC' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'S4' }, { id: 'S5' }, { id: 'S6' }, { id: 'S7' }, { id: 'S8' }, { id: 'S9' }, { id: 'S10' }, { id: 'S11' }, { id: 'S12' }, { id: 'S13' }, { id: 'S14' }, { id: 'S15' }],
    'max30102': [{ id: 'VIN' }, { id: 'SDA' }, { id: 'SCL' }, { id: 'GND' }, { id: 'INT' }, { id: 'IRD' }, { id: 'RD' }],
    'wokwi-ldr-module': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DO' }, { id: 'AO' }],
    'wokwi-soil-moisture-sensor': [{ id: 'GND' }, { id: 'VCC' }, { id: 'SIG' }],
    'wokwi-photodiode': [{ id: 'A' }, { id: 'C' }],
    'wokwi-diode': [{ id: 'A' }, { id: 'C' }],
    'wokwi-npn-transistor': [{ id: 'E' }, { id: 'B' }, { id: 'C' }],
    'wokwi-max7219': [{ id: 'VCC' }, { id: 'GND' }, { id: 'DIN' }, { id: 'CS' }, { id: 'CLK' }, { id: 'VCC_OUT' }, { id: 'GND_OUT' }, { id: 'DOUT' }, { id: 'CS_OUT' }, { id: 'CLK_OUT' }],
    'wokwi-a4988': [{ id: 'ENABLE' }, { id: 'MS1' }, { id: 'MS2' }, { id: 'MS3' }, { id: 'RESET' }, { id: 'SLEEP' }, { id: 'STEP' }, { id: 'DIR' }, { id: 'VMOT' }, { id: 'GND_MOT' }, { id: '2B' }, { id: '2A' }, { id: '1A' }, { id: '1B' }, { id: 'VDD' }, { id: 'GND_LOGIC' }],
    'wokwi-7segment': [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }, { id: 'F' }, { id: 'G' }, { id: 'DP' }, { id: 'DIG1' }, { id: 'DIG2' }, { id: 'DIG3' }, { id: 'DIG4' }, { id: 'COLON' }],
    'wokwi-ili9341': [{ id: 'VCC' }, { id: 'GND' }, { id: 'CS' }, { id: 'RESET' }, { id: 'DC' }, { id: 'MOSI' }, { id: 'SCK' }, { id: 'LED' }, { id: 'MISO' }],
    'wokwi-cd74hc4067': [{ id: 'VCC' }, { id: 'GND' }, { id: 'EN' }, { id: 'S0' }, { id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'SIG' }, { id: 'C0' }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }, { id: 'C4' }, { id: 'C5' }, { id: 'C6' }, { id: 'C7' }, { id: 'C8' }, { id: 'C9' }, { id: 'C10' }, { id: 'C11' }, { id: 'C12' }, { id: 'C13' }, { id: 'C14' }, { id: 'C15' }],
    'wokwi-logic-analyzer': [{ id: 'GND' }, { id: 'D0' }, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5' }, { id: 'D6' }, { id: 'D7' }],
};

export type AVRRunnerOptions = {
    boardId?: string;
    onByteTransmit?: (payload: { boardId: string; value: number; char: string }) => void;
    serialBaudRate?: number;
};

export class AVRRunner {
    cpu: CPU | null = null;
    adc: AVRADC | null = null;
    usart: AVRUSART | null = null;
    twi: AVRTWI | null = null;
    spi: AVRSPI | null = null;
    portB: AVRIOPort | null = null;
    portC: AVRIOPort | null = null;
    portD: AVRIOPort | null = null;
    updatePhysics: (() => void) | null = null;
    timers: AVRTimer[] = [];
    running: boolean = false;
    pinStates: Record<string, boolean> = {};
    currentWires: any[] = [];
    instances: Map<string, BaseComponent> = new Map();
    lastTime: number = 0;
    statusInterval: any;
    pinsChanged: boolean = true;
    boardId: string;
    private serialBaudRate: number = 9600;
    private serialByteBudget: number = 0;
    private readonly onStateUpdate: (state: any) => void;
    private readonly onByteTransmitCb?: (payload: { boardId: string; value: number; char: string }) => void;
    private i2sState = new Map<string, { bclkLast: boolean; wsLast: boolean; shiftBuf: number; bitCount: number }>();

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions = {}
    ) {
        this.currentWires = wiresDef || [];
        this.onStateUpdate = onStateUpdate;
        this.onByteTransmitCb = options.onByteTransmit;
        this.boardId = options.boardId || (componentsDef || []).find((c: any) => c.type.includes('arduino'))?.id || 'wokwi-arduino-uno_0';
        this.setSerialBaudRate(options.serialBaudRate ?? 9600);

        // Setup memory and CPU
        const program = new Uint16Array(32768);
        const { data } = parse(hexData);
        const u8 = new Uint8Array(program.buffer);
        u8.set(data);

        this.cpu = new CPU(program, 0x2200);

        this.timers = [
            new AVRTimer(this.cpu, timer0Config),
            new AVRTimer(this.cpu, timer1Config),
            new AVRTimer(this.cpu, timer2Config)
        ];

        this.adc = new AVRADC(this.cpu, adcConfig);

        this.usart = new AVRUSART(this.cpu, usart0Config, 16e6);
        this.usart.onByteTransmit = (value) => {
            const char = String.fromCharCode(value);
            this.pulseBoardLed('1');
            if (this.onByteTransmitCb) {
                this.onByteTransmitCb({ boardId: this.boardId, value, char });
            } else {
                this.onStateUpdate({ type: 'serial', data: char, value, boardId: this.boardId });
            }
        };

        this.twi = new AVRTWI(this.cpu, twiConfig, 16e6);
        this.spi = new AVRSPI(this.cpu, spiConfig, 16e6);

        this.buildNetlist();

        this.portB = new AVRIOPort(this.cpu, portBConfig);
        this.portC = new AVRIOPort(this.cpu, portCConfig);
        this.portD = new AVRIOPort(this.cpu, portDConfig);

        // Instantiate components
        (componentsDef || []).forEach(cDef => {
            const LogicClass = LOGIC_REGISTRY[cDef.type];
            if (LogicClass) {
                const pins = COMPONENT_PINS[cDef.type] || [{ id: 'A' }, { id: 'K' }, { id: 'GND' }, { id: 'VSS' }];
                const manifest = { type: cDef.type, attrs: cDef.attrs || {}, pins };
                const inst = new LogicClass(cDef.id, manifest);
                if (cDef.attrs) inst.state = { ...inst.state, ...cDef.attrs };
                this.instances.set(cDef.id, inst);
            }
        });

        // Setup I2C Hooks bridging AVRTWI events to BaseComponents
        class TWIAdapter {
            // Track the addressed slave across the read transaction
            private activeSlave: BaseComponent | null = null;

            constructor(private twi: AVRTWI, private instances: Map<string, BaseComponent>) { }

            start(repeated: boolean) {
                this.twi.completeStart();
            }

            stop() {
                const instArray = Array.from(this.instances.values());
                for (const inst of instArray) {
                    if (inst.onI2CStop) {
                        inst.onI2CStop();
                    }
                }
                this.activeSlave = null;
                this.twi.completeStop();
            }

            connectToSlave(addr: number, write: boolean) {
                const instArray = Array.from(this.instances.values());
                let ack = false;
                this.activeSlave = null;
                for (const inst of instArray) {
                    if (inst.onI2CStart) {
                        if (inst.onI2CStart(addr, !write)) { // write here in avr8js is actually the exact R/W bit. "write" true means bit is 0
                            ack = true;
                            if (!this.activeSlave) this.activeSlave = inst; // remember first ACKing slave
                        }
                    }
                }
                this.twi.completeConnect(ack);
            }

            writeByte(value: number) {
                const instArray = Array.from(this.instances.values());
                let handled = false;
                for (const inst of instArray) {
                    if (inst.onI2CByte) {
                        if (inst.onI2CByte(-1, value)) {
                            handled = true;
                        }
                    }
                }
                this.twi.completeWrite(handled);
            }

            readByte(ack: boolean) {
                // Ask the currently addressed slave for the next byte.
                // Components expose this via onI2CReadByte() or readByte().
                let byte = 0xFF;
                if (this.activeSlave) {
                    const slave = this.activeSlave as any;
                    if (typeof slave.onI2CReadByte === 'function') {
                        byte = slave.onI2CReadByte() & 0xFF;
                    } else if (typeof slave.readByte === 'function') {
                        byte = slave.readByte() & 0xFF;
                    }
                }
                this.twi.completeRead(byte);
            }
        }

        this.twi.eventHandler = new TWIAdapter(this.twi, this.instances);

        // Setup SPI Hooks bridging AVRSPI to BaseComponents
        this.spi.onByte = (value: number) => {
            const instArray = Array.from(this.instances.values());
            let returnByte = 0xFF; // Default MISO if nothing responds

            const unoId = this.boardId;

            if (unoId) {
                const misoNet = this.pinToNet.get(`${unoId}:12`);
                if (misoNet !== undefined) {
                    // 1. Direct Loopback (MISO connected to MOSI)
                    if (misoNet === this.pinToNet.get(`${unoId}:11`)) {
                        returnByte = value;
                    }
                    // 2. MISO connected to SCK (Clock pulses)
                    else if (misoNet === this.pinToNet.get(`${unoId}:13`)) {
                        returnByte = 0xAA; // Arbitrary pattern to show clock signal picked up
                    }
                    // 3. MISO connected to any other driven Pin (like 10/SS)
                    else {
                        // Check if the net is currently driven HIGH by another pin
                        let drivenHigh = false;
                        for (const [p, net] of this.pinToNet) {
                            if (net === misoNet && !p.endsWith(':12')) {
                                const [compId, pinId] = p.split(':');
                                if (compId === unoId && this.pinStates[pinId]) {
                                    drivenHigh = true;
                                    break;
                                }
                            }
                        }
                        returnByte = drivenHigh ? 0xFF : 0x00;
                    }
                }
            }

            for (const inst of instArray) {
                if (inst.onSPIByte && this.isSPISelected(inst)) {
                    const res = inst.onSPIByte(value);
                    if (res !== undefined) {
                        returnByte = res;
                    }
                }
            }

            // The SPI peripheral needs to be told when the transfer is physically complete 
            // based on the clock divider speed.
            this.cpu!.addClockEvent(() => {
                this.spi!.completeTransfer(returnByte);
            }, this.spi!.transferCycles);
        };

        // Setup IO Hooks
        this.setupHooks();

        this.running = true;
        this.lastTime = performance.now();
        this.runLoop();

        // 60FPS sync
        this.statusInterval = setInterval(() => {
            if (this.running && this.cpu) {
                const msg: any = { type: 'state' };

                if (this.pinsChanged) {
                    msg.pins = this.pinStates;
                    this.pinsChanged = false;
                }

                if (this.adc) {
                    msg.analog = Array.from(this.adc.channelValues);
                }

                const compStates = Array.from(this.instances.values())
                    .filter(inst => inst.stateChanged)
                    .map(inst => {
                        inst.stateChanged = false;
                        return { id: inst.id, state: inst.getSyncState() };
                    });

                if (compStates.length > 0) {
                    msg.components = compStates;
                }

                // Always send state to ensure continuous plotter timing and analog tracking
                if (!msg.pins) msg.pins = this.pinStates; // Ensure plotData has pins object
                msg.boardId = this.boardId;
                this.onStateUpdate(msg);
            }
        }, 1000 / 60);
    }

    onEvent(compId: string, event: string) {
        const inst = this.instances.get(compId);
        if (inst) {
            inst.onEvent(event);
            if (this.updatePhysics) this.updatePhysics();
            this.pinsChanged = true;
        }
    }

    private isBoardArduinoPin(wireCoord: string, targetPin: string): boolean {
        const [compId, compPin] = wireCoord.split(':');
        if (compId !== this.boardId) return false;

        const pin = compPin.toUpperCase();
        let target = targetPin.toUpperCase();

        // Alias RX/TX
        if (target === '0') target = 'RX';
        if (target === '1') target = 'TX';

        return pin === target ||
            pin === `D${target}` ||
            pin === `A${target}` ||
            (pin.startsWith('D') && pin.substring(1) === target) ||
            (pin.startsWith('A') && pin.substring(1) === target) ||
            (target === 'RX' && pin === '0') ||
            (target === 'TX' && pin === '1');
    }

    private pulseBoardLed(pinId: '0' | '1') {
        const boardInst = this.instances.get(this.boardId);
        if (!boardInst || !this.cpu) return;
        boardInst.onPinStateChange(pinId, true, this.cpu.cycles);
        // Also pulse RX/TX if those pin IDs exist instead of 0/1
        const alias = pinId === '0' ? 'RX' : 'TX';
        boardInst.onPinStateChange(alias, true, this.cpu.cycles);
    }

    private isPinDrivenLow(compPin: string): boolean {
        let port: any = null;
        let bit = -1;
        let normalized = compPin.toUpperCase();

        if (normalized.startsWith('D')) {
            normalized = normalized.substring(1);
        }

        const num = parseInt(normalized);
        if (!isNaN(num) && normalized.indexOf('A') === -1) {
            if (num >= 0 && num <= 7) { port = this.portD; bit = num; }
            else if (num >= 8 && num <= 13) { port = this.portB; bit = num - 8; }
        } else if (normalized.startsWith('A')) {
            const numA = parseInt(normalized.substring(1));
            if (numA >= 0 && numA <= 5) { port = this.portC; bit = numA; }
        }

        if (port && bit !== -1 && this.cpu) {
            // DDR: 1 = output, 0 = input
            // DDR/PORT are I/O addresses; they need a 0x20 offset for Data space access on ATmega328P
            const isOutput = (this.cpu.data[port.portConfig.DDR + 0x20] & (1 << bit)) !== 0;
            const isPortLow = (this.cpu.data[port.portConfig.PORT + 0x20] & (1 << bit)) === 0;
            return isOutput && isPortLow;
        }
        return false;
    }

    private setupHooks() {
        if (!this.cpu) return;

        // All three GND pins on the Uno (gnd_1, gnd_2, gnd_3) are treated as the same ground net.
        const isArduinoGndPin = (compPin: string) =>
            compPin === 'GND' || /^gnd([._]\d+)?$/i.test(compPin);

        const isArduino5VPin = (compPin: string) =>
            compPin === '5V' || compPin === 'VCC';

        const updateOopPin = (arduinoPinStr: string, isHigh: boolean) => {
            if (arduinoPinStr === '2' || arduinoPinStr === '3') {
                console.log(`[AVRRunner] Pin ${arduinoPinStr} -> ${isHigh ? 'HIGH' : 'LOW'}`);
            }
            const v = isHigh ? 5.0 : 0.0;
            const visitedWires = new Set();

            const traverse = (targetStr: string) => {
                const [compId, compPin] = targetStr.split(':');
                const inst = this.instances.get(compId);
                if (inst) {
                    if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: 'INPUT' };
                    inst.setPinVoltage(compPin, v);

                    if (this.cpu) {
                        inst.onPinStateChange(compPin, isHigh, this.cpu.cycles);
                    }

                    // Dispatch I2S frame events when BCLK/WS pins change
                    this.tickI2S(inst, compId, compPin, isHigh);

                    // Traverse THROUGH passive components like resistors
                    if (inst.type === 'wokwi-resistor') {
                        const otherPin = compPin === 'p1' ? 'p2' : 'p1';
                        inst.setPinVoltage(otherPin, v);
                        const forwardStr = `${compId}:${otherPin}`;

                        // Find downstream wires connected to the other side of the resistor
                        this.currentWires.forEach(w => {
                            if (!visitedWires.has(w) && (w.from === forwardStr || w.to === forwardStr)) {
                                visitedWires.add(w);
                                const nextTarget = w.from === forwardStr ? w.to : w.from;
                                traverse(nextTarget);
                            }
                        });
                    }
                }
            };

            // Ensure that the node we are expanding from is actually the Arduino's pin
            this.currentWires.forEach(w => {
                const isFromArduino = this.isBoardArduinoPin(w.from, arduinoPinStr);
                const isToArduino = this.isBoardArduinoPin(w.to, arduinoPinStr);

                if (isFromArduino || isToArduino) {
                    visitedWires.add(w);
                    const targetStr = isFromArduino ? w.to : w.from;
                    traverse(targetStr);
                }
            });

            // Propagate ground through any wire connected to any Arduino GND pin (gnd_1, gnd_2, gnd_3)
            this.currentWires.forEach(w => {
                const [fromComp, fromPin] = w.from.split(':');
                const [toComp, toPin] = w.to.split(':');
                const fromInst = this.instances.get(fromComp);
                const toInst = this.instances.get(toComp);

                const fromIsArduinoGnd = fromComp === this.boardId && fromInst && fromInst.type.includes('arduino') && isArduinoGndPin(fromPin);
                const toIsArduinoGnd = toComp === this.boardId && toInst && toInst.type.includes('arduino') && isArduinoGndPin(toPin);

                if (fromIsArduinoGnd && toInst) {
                    toInst.setPinVoltage(toPin, 0.0);
                } else if (toIsArduinoGnd && fromInst) {
                    fromInst.setPinVoltage(fromPin, 0.0);
                }

                const fromIsArduino5V = fromComp === this.boardId && fromInst && fromInst.type.includes('arduino') && isArduino5VPin(fromPin);
                const toIsArduino5V = toComp === this.boardId && toInst && toInst.type.includes('arduino') && isArduino5VPin(toPin);

                if (fromIsArduino5V && toInst) {
                    toInst.setPinVoltage(toPin, 5.0);
                } else if (toIsArduino5V && fromInst) {
                    fromInst.setPinVoltage(fromPin, 5.0);
                }
            });

            this.instances.forEach(inst => {
                Object.keys(inst.pins).forEach(pinKey => {
                    const pk = pinKey.toLowerCase();
                    if (pk.startsWith('gnd') || pk === 'vss' || pk === 'k') {
                        inst.setPinVoltage(pinKey, 0.0);
                    }
                });
                if ('5V' in inst.pins) inst.setPinVoltage('5V', 5.0);
            });
        };



        this.updatePhysics = () => {
            const forcedLowSet = new Set<string>();

            const checkPinForGnd = (arduinoPinStr: string) => {
                let forcedLow = false;
                const visitedWires = new Set();

                const checkForGndInternal = (targetStr: string) => {
                    if (forcedLow) return;
                    const [compId, compPin] = targetStr.split(':');
                    const inst = this.instances.get(compId);
                    if (inst) {
                        const pk = compPin.toLowerCase();
                        const isGndNode = pk.startsWith('gnd') || pk === 'vss' || pk === 'k';

                        // Check if this is the board and specifically if the pin is driven LOW by CPU
                        const isArduinoLow = compId === this.boardId &&
                            compPin !== arduinoPinStr &&
                            this.isPinDrivenLow(compPin);

                        if (isGndNode || isArduinoLow) {
                            forcedLow = true;
                            return;
                        }

                        // Traversal logic
                        if (inst.type === 'wokwi-membrane-keypad' && inst.state.connectedPair) {
                            const pair = inst.state.connectedPair;
                            const otherPin = compPin === pair[0] ? pair[1] : (compPin === pair[1] ? pair[0] : null);
                            if (otherPin) {
                                const forwardStr = `${compId}:${otherPin}`;
                                this.currentWires.forEach(w => {
                                    if (!visitedWires.has(w) && (w.from === forwardStr || w.to === forwardStr)) {
                                        visitedWires.add(w);
                                        checkForGndInternal(w.from === forwardStr ? w.to : w.from);
                                    }
                                });
                            }
                        } else if (inst.type === 'wokwi-pushbutton' && inst.state.pressed) {
                            const otherPin = compPin === '1' ? '2' : (compPin === '2' ? '1' : null);
                            if (otherPin) {
                                const forwardStr = `${compId}:${otherPin}`;
                                this.currentWires.forEach(w => {
                                    if (!visitedWires.has(w) && (w.from === forwardStr || w.to === forwardStr)) {
                                        visitedWires.add(w);
                                        checkForGndInternal(w.from === forwardStr ? w.to : w.from);
                                    }
                                });
                            }
                        } else if (inst.type === 'wokwi-rotary-encoder') {
                            const isGrounded = (compPin === 'SW' && inst.state.sw) ||
                                (compPin === 'CLK' && inst.getPinVoltage('CLK') === 0) ||
                                (compPin === 'DT' && inst.getPinVoltage('DT') === 0);
                            if (isGrounded) {
                                // Find the GND pin of this encoder
                                const gndStr = `${compId}:GND`;
                                this.currentWires.forEach(w => {
                                    if (!visitedWires.has(w) && (w.from === gndStr || w.to === gndStr)) {
                                        visitedWires.add(w);
                                        checkForGndInternal(w.from === gndStr ? w.to : w.from);
                                    }
                                });
                            }
                        } else if (inst.type === 'wokwi-analog-joystick' && inst.state.pressed) {
                            if (compPin === 'SW') {
                                const forwardStr = `${compId}:GND`;
                                this.currentWires.forEach(w => {
                                    if (!visitedWires.has(w) && (w.from === forwardStr || w.to === forwardStr)) {
                                        visitedWires.add(w);
                                        checkForGndInternal(w.from === forwardStr ? w.to : w.from);
                                    }
                                });
                            } else if (compPin === 'GND' || compPin === 'gnd') {
                                const forwardStr = `${compId}:SW`;
                                this.currentWires.forEach(w => {
                                    if (!visitedWires.has(w) && (w.from === forwardStr || w.to === forwardStr)) {
                                        visitedWires.add(w);
                                        checkForGndInternal(w.from === forwardStr ? w.to : w.from);
                                    }
                                });
                            }
                        } else if (inst.type === 'wokwi-resistor') {
                            const otherPin = compPin === 'p1' ? 'p2' : (compPin === 'p2' ? 'p1' : null);
                            if (otherPin) {
                                const forwardStr = `${compId}:${otherPin}`;
                                this.currentWires.forEach(w => {
                                    if (!visitedWires.has(w) && (w.from === forwardStr || w.to === forwardStr)) {
                                        visitedWires.add(w);
                                        checkForGndInternal(w.from === forwardStr ? w.to : w.from);
                                    }
                                });
                            }
                        }
                    }
                };

                this.currentWires.forEach(w => {
                    const isFromArduino = this.isBoardArduinoPin(w.from, arduinoPinStr);
                    const isToArduino = this.isBoardArduinoPin(w.to, arduinoPinStr);
                    if (isFromArduino || isToArduino) {
                        const targetStr = isFromArduino ? w.to : w.from;
                        visitedWires.add(w);
                        checkForGndInternal(targetStr);
                    }
                });

                return forcedLow;
            };

            // Pass 1: Identify all pins that should be LOW
            const allPinsToCheck = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
            allPinsToCheck.forEach(pin => {
                if (checkPinForGnd(pin)) {
                    forcedLowSet.add(pin);
                }
            });

            // Pass 2: Apply to ports
            const applyPort = (p: AVRIOPort, pNames: string[]) => {
                pNames.forEach((pin, i) => {
                    p.setPin(i, !forcedLowSet.has(pin));
                });
            };

            if (this.portB) applyPort(this.portB, ['8', '9', '10', '11', '12', '13']);
            if (this.portD) applyPort(this.portD, ['0', '1', '2', '3', '4', '5', '6', '7']);
            if (this.portC) applyPort(this.portC, ['A0', 'A1', 'A2', 'A3', 'A4', 'A5']);
        };

        const attachPort = (port: AVRIOPort, pinNames: string[]) => {
            port.addListener((value) => {
                let anyChanged = false;
                pinNames.forEach((pin, i) => {
                    const isHigh = (value & (1 << i)) !== 0;
                    if (this.pinStates[pin] !== isHigh) {
                        this.pinStates[pin] = isHigh;
                        this.pinsChanged = true;
                        anyChanged = true;

                        const boardInst = this.instances.get(this.boardId);
                        if (boardInst) {
                            boardInst.onPinStateChange(pin, isHigh, this.cpu!.cycles);
                        }

                        updateOopPin(pin, isHigh);
                    }
                });
                if (anyChanged && this.updatePhysics) {
                    this.updatePhysics();
                }
            });
        };

        if (this.portB) attachPort(this.portB, ['8', '9', '10', '11', '12', '13']); // PORTB
        if (this.portD) attachPort(this.portD, ['0', '1', '2', '3', '4', '5', '6', '7']); // PORTD
        if (this.portC) attachPort(this.portC, ['A0', 'A1', 'A2', 'A3', 'A4', 'A5']); // PORTC

        // Initialize all hooked pins to LOW on startup so LED components aren't stuck waiting for a toggle
        ['8', '9', '10', '11', '12', '13', '0', '1', '2', '3', '4', '5', '6', '7', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'].forEach(pin => {
            this.pinStates[pin] = false;
            updateOopPin(pin, false);
        });

        // Hook DDR registers because transitioning from INPUT floating (0) to OUTPUT LOW (0) 
        // doesn't trigger port.addListener (logic level doesn't change, both are 0), 
        // but it DOES change whether the pin can act as a GROUND in updatePhysics!
        const hookDdr = (addr: number) => {
            if (!this.cpu) return;
            const orig = this.cpu.writeHooks[addr];
            this.cpu.writeHooks[addr] = (value: number, oldVal: number, addrFunc: number, mask: number) => {
                const ret = orig ? orig(value, oldVal, addrFunc, mask) : false;
                if (value !== oldVal && this.updatePhysics) {
                    this.updatePhysics();
                }
                return ret;
            };
        };
        hookDdr(portBConfig.DDR);
        hookDdr(portCConfig.DDR);
        hookDdr(portDConfig.DDR);
    }

    private runLoop = () => {
        if (!this.running || !this.cpu) return;

        const now = performance.now();
        const deltaTime = now - this.lastTime;

        if (deltaTime > 0) {
            const cyclesToRun = deltaTime * 16000;
            const targetObj = this.cpu.cycles + Math.min(cyclesToRun, 1600000);

            if (this.updatePhysics) this.updatePhysics();

            while (this.cpu.cycles < targetObj && this.running) {
                avrInstruction(this.cpu);
                this.cpu.tick();
            }
            if (this.cpu.cycles % 160000 < 16000) {
                console.log(`[AVRRunner] Cycles: ${this.cpu.cycles}. Running: ${this.running}`);
            }
            this.lastTime = now;

            // Host/UART receive pacing: bytes per second = baud / 10 (8N1 frame)
            // bytes per ms = baud / 10000. We accumulate fractional budget over time.
            const bytesPerMs = this.serialBaudRate / 10000;
            this.serialByteBudget += deltaTime * bytesPerMs;

            if (this.serialBuffer.length > 0 && this.usart && this.serialByteBudget >= 1) {
                const maxBytes = Math.floor(this.serialByteBudget);
                const toSend = Math.min(maxBytes, this.serialBuffer.length);
                for (let i = 0; i < toSend; i++) {
                    this.usart.writeByte(this.serialBuffer.shift()!);
                }
                this.serialByteBudget -= toSend;
            }

            const instArray = Array.from(this.instances.values());
            instArray.forEach(inst => inst.update(this.cpu!.cycles, this.currentWires, instArray));

            // Propagate voltages through wires from non-Arduino component outputs
            // (e.g. motor driver OUT1-OUT4 → stepper motor A+/A-/B+/B-)
            for (const w of this.currentWires) {
                const [fromComp, fromPin] = w.from.split(':');
                const [toComp, toPin] = w.to.split(':');

                // Skip wires connecting to the Arduino board itself (already handled by updateOopPin)
                if (fromComp === this.boardId || toComp === this.boardId) continue;

                const fromInst = this.instances.get(fromComp);
                const toInst = this.instances.get(toComp);
                if (!fromInst || !toInst) continue;

                // Propagate from → to
                const fromV = fromInst.getPinVoltage(fromPin);
                if (toInst.getPinVoltage(toPin) !== fromV) {
                    toInst.setPinVoltage(toPin, fromV);
                    toInst.onPinStateChange(toPin, fromV > 2.5, this.cpu!.cycles);
                }

                // Propagate to → from (bidirectional for cases like power supply connections)
                const toV = toInst.getPinVoltage(toPin);
                if (fromInst.getPinVoltage(fromPin) !== toV) {
                    fromInst.setPinVoltage(fromPin, toV);
                    fromInst.onPinStateChange(fromPin, toV > 2.5, this.cpu!.cycles);
                }
            }

            if (this.adc && this.cpu) {
                // Poll analog voltages at ~60Hz or however often runLoop breaks, 
                // but actually runLoop is very frequent (every 1ms)
                for (let i = 0; i < 6; i++) {
                    const arduinoPin = `A${i}`;
                    let voltage = 0;
                    for (const w of this.currentWires) {
                        const [fromComp, fromPin] = w.from.split(':');
                        const [toComp, toPin] = w.to.split(':');

                        let isConnectedToPin = false;
                        let otherCompId = '';
                        let otherCompPin = '';

                        if (fromComp === this.boardId && (fromPin === arduinoPin || fromPin === `A${i}`)) {
                            isConnectedToPin = true;
                            otherCompId = toComp;
                            otherCompPin = toPin;
                        } else if (toComp === this.boardId && (toPin === arduinoPin || toPin === `A${i}`)) {
                            isConnectedToPin = true;
                            otherCompId = fromComp;
                            otherCompPin = fromPin;
                        }

                        if (isConnectedToPin) {
                            const inst = this.instances.get(otherCompId);
                            if (inst) {
                                voltage = Math.max(voltage, inst.getPinVoltage(otherCompPin));
                            }
                        }
                    }
                    this.adc.channelValues[i] = voltage;
                }
            }
        }

        setTimeout(this.runLoop, 1);
    }

    private serialBuffer: number[] = [];

    serialRx(data: string) {
        for (let i = 0; i < data.length; i++) {
            this.serialBuffer.push(data.charCodeAt(i));
            this.pulseBoardLed('0');
        }
    }

    serialRxByte(value: number) {
        this.serialBuffer.push(value & 0xff);
        this.pulseBoardLed('0');
    }

    setSerialBaudRate(baud: number) {
        const parsed = Number(baud);
        if (!Number.isFinite(parsed)) return;
        const clamped = Math.max(300, Math.min(2000000, Math.floor(parsed)));
        this.serialBaudRate = clamped;
    }

    getSerialBaudRate(): number {
        return this.serialBaudRate;
    }

    stop() {
        this.running = false;
        clearInterval(this.statusInterval);
    }

    // ─── SPI: chip-select awareness ───────────────────────────────────────────
    /**
     * Returns true if the component should receive the current SPI byte.
     * A component is selected when:
     *   • It has no CS/SS pin  (single-slave wiring → always selected), OR
     *   • Its CS/SS pin voltage is < 0.5 V  (active-LOW chip select)
     */
    private isSPISelected(inst: BaseComponent): boolean {
        const csNames = ['cs', 'ce', 'ss', 'ssel', 'nss', 'csn', 'cs_n', 'nce'];
        for (const name of csNames) {
            if (inst.pins[name]) return inst.getPinVoltage(name) < 0.5;
            if (inst.pins[name.toUpperCase()]) return inst.getPinVoltage(name.toUpperCase()) < 0.5;
        }
        return true; // no CS pin → always selected
    }

    // ─── I2S: bit-bang frame assembler ────────────────────────────────────────
    /**
     * Called from the pin-change traversal whenever any component has a pin
     * voltage updated.  If the changed pin is the component's BCLK or WS line
     * (matched by common I2S naming conventions), the assembler clocks one bit
     * into a shift buffer.  Once bitsPerFrame bits have been collected for one
     * channel, onI2SFrame() is called.
     *
     * Left-justified format (no WS-delay):
     *   WS=LOW  → left  channel (channel 0)
     *   WS=HIGH → right channel (channel 1)
     * Data is sampled on the BCLK **rising** edge, MSB first.
     */
    private tickI2S(inst: BaseComponent, compId: string, changedPin: string, isHigh: boolean): void {
        if (!inst.onI2SFrame) return;

        const pin = changedPin.toLowerCase();
        const isBclk = pin === 'bclk' || pin === 'sck' || pin === 'bit_clk' || pin === 'blck';
        const isWs = pin === 'ws' || pin === 'lrck' || pin === 'wsel' || pin === 'lrc';

        if (!isBclk && !isWs) return;

        if (!this.i2sState.has(compId)) {
            this.i2sState.set(compId, { bclkLast: false, wsLast: false, shiftBuf: 0, bitCount: 0 });
        }
        const state = this.i2sState.get(compId)!;

        if (isWs) {
            if (state.wsLast !== isHigh) {
                // WS edge → end of the current-channel frame
                const bpf = (inst.state?.i2sBitsPerFrame as number | undefined) ?? 16;
                if (state.bitCount >= bpf) {
                    const channel = state.wsLast ? 1 : 0;
                    const sample = (state.shiftBuf << (32 - bpf)) | 0; // sign-extend
                    inst.onI2SFrame(channel, sample, bpf);
                }
                state.wsLast = isHigh;
                state.shiftBuf = 0;
                state.bitCount = 0;
            }
            return;
        }

        // BCLK edge
        const rising = isHigh && !state.bclkLast;
        state.bclkLast = isHigh;

        if (rising) {
            // Sample SDATA (accept several common pin names)
            const sdPin = this.findI2SPinName(inst, ['sdata', 'sdin', 'din', 'sd', 'dout', 'data']);
            const bit = sdPin !== null ? (inst.getPinVoltage(sdPin) > 0.5 ? 1 : 0) : 0;

            const bpf = (inst.state?.i2sBitsPerFrame as number | undefined) ?? 16;
            state.shiftBuf = ((state.shiftBuf << 1) | bit) >>> 0;
            state.bitCount++;

            if (state.bitCount >= bpf) {
                const channel = state.wsLast ? 1 : 0;
                const sample = (state.shiftBuf << (32 - bpf)) | 0;
                inst.onI2SFrame(channel, sample, bpf);
                state.shiftBuf = 0;
                state.bitCount = 0;
            }
        }
    }

    /** Finds the first existing pin on `inst` from a list of candidate names
     *  (case-insensitive, lower then UPPER checked). */
    private findI2SPinName(inst: BaseComponent, candidates: string[]): string | null {
        for (const name of candidates) {
            if (inst.pins[name]) return name;
            if (inst.pins[name.toUpperCase()]) return name.toUpperCase();
        }
        return null;
    }

    private pinToNet = new Map<string, number>();

    private buildNetlist() {
        const adj = new Map<string, string[]>();

        // Add wires to adjacency list
        for (const wire of this.currentWires) {
            if (!adj.has(wire.from)) adj.set(wire.from, []);
            if (!adj.has(wire.to)) adj.set(wire.to, []);
            adj.get(wire.from)!.push(wire.to);
            adj.get(wire.to)!.push(wire.from);
        }

        // Add resistor bridges to adjacency list
        for (const [id, inst] of this.instances) {
            if (inst.type === 'wokwi-resistor') {
                const p1 = `${id}:p1`;
                const p2 = `${id}:p2`;
                if (!adj.has(p1)) adj.set(p1, []);
                if (!adj.has(p2)) adj.set(p2, []);
                adj.get(p1)!.push(p2);
                adj.get(p2)!.push(p1);
            } else if (inst.type === 'wokwi-breadboard' || inst.type === 'wokwi-breadboard-half' || inst.type === 'wokwi-breadboard-mini') {
                const connectAll = (arr: string[]) => {
                    for (let i = 0; i < arr.length - 1; i++) {
                        if (!adj.has(arr[i])) adj.set(arr[i], []);
                        if (!adj.has(arr[i + 1])) adj.set(arr[i + 1], []);
                        adj.get(arr[i])!.push(arr[i + 1]);
                        adj.get(arr[i + 1])!.push(arr[i]);
                    }
                };

                if (inst.type !== 'wokwi-breadboard-mini') {
                    const topGnd = [], topVcc = [], bottomVcc = [], bottomGnd = [];
                    for (let i = 1; i <= 50; i++) {
                        topGnd.push(`${id}:top_gnd_${i}`);
                        topVcc.push(`${id}:top_vcc_${i}`);
                        bottomVcc.push(`${id}:bottom_vcc_${i}`);
                        bottomGnd.push(`${id}:bottom_gnd_${i}`);
                    }
                    connectAll(topGnd);
                    connectAll(topVcc);
                    connectAll(bottomVcc);
                    connectAll(bottomGnd);
                }

                const cols = inst.type === 'wokwi-breadboard-half' ? 30 : (inst.type === 'wokwi-breadboard-mini' ? 17 : 63);
                for (let col = 1; col <= cols; col++) {
                    connectAll([`${id}:${col}a`, `${id}:${col}b`, `${id}:${col}c`, `${id}:${col}d`, `${id}:${col}e`]);
                    connectAll([`${id}:${col}f`, `${id}:${col}g`, `${id}:${col}h`, `${id}:${col}i`, `${id}:${col}j`]);
                }
            }
        }

        const visited = new Set<string>();
        let currentNet = 0;

        for (const startNode of adj.keys()) {
            if (!visited.has(startNode)) {
                const queue = [startNode];
                visited.add(startNode);
                while (queue.length > 0) {
                    const node = queue.shift()!;
                    this.pinToNet.set(node, currentNet);

                    // Also set aliases (D11, 11 etc)
                    const parts = node.split(':');
                    if (parts.length === 2) {
                        const compId = parts[0];
                        const pinId = parts[1];
                        if (!pinId.startsWith('D') && !pinId.startsWith('A') && /^\d+$/.test(pinId)) {
                            this.pinToNet.set(`${compId}:D${pinId}`, currentNet);
                        } else if (pinId.startsWith('D')) {
                            this.pinToNet.set(`${compId}:${pinId.substring(1)}`, currentNet);
                        }
                    }

                    for (const neighbor of adj.get(node) || []) {
                        if (!visited.has(neighbor)) {
                            visited.add(neighbor);
                            queue.push(neighbor);
                        }
                    }
                }
                currentNet++;
            }
        }
    }

    private arePinsConnected(pinA: string, pinB: string): boolean {
        const netA = this.pinToNet.get(pinA);
        const netB = this.pinToNet.get(pinB);
        return netA !== undefined && netA === netB;
    }
}
