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
import { MotorDriverLogic } from '@openhw/emulator/src/components/wokwi-motor-driver/logic.ts';
import { SlidePotLogic } from '@openhw/emulator/src/components/wokwi-slide-potentiometer/logic.ts';
import { PotentiometerLogic } from '@openhw/emulator/src/components/wokwi-potentiometer/logic.ts';

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

const LOGIC_REGISTRY: Record<string, any> = {
    'wokwi-led': LEDLogic,
    'wokwi-arduino-uno': UnoLogic,
    'wokwi-resistor': ResistorLogic,
    'wokwi-pushbutton': PushbuttonLogic,
    'wokwi-power-supply': PowerSupplyLogic,
    'wokwi-neopixel-matrix': NeopixelLogic,
    'wokwi-buzzer': BuzzerLogic,
    'wokwi-motor': MotorLogic,
    'wokwi-servo': ServoLogic,
    'wokwi-motor-driver': MotorDriverLogic,
    'wokwi-slide-potentiometer': SlidePotLogic,
    'wokwi-potentiometer': PotentiometerLogic
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

    constructor(hexData: string, componentsDef: any[], wiresDef: any[], onStateUpdate: (state: any) => void) {
        this.currentWires = wiresDef || [];

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
            onStateUpdate({ type: 'serial', data: char });
        };

        this.twi = new AVRTWI(this.cpu, twiConfig, 16e6);
        this.spi = new AVRSPI(this.cpu, spiConfig, 16e6);

        this.portB = new AVRIOPort(this.cpu, portBConfig);
        this.portC = new AVRIOPort(this.cpu, portCConfig);
        this.portD = new AVRIOPort(this.cpu, portDConfig);

        // Per-type pin lists so every component's pins are registered correctly
        const COMPONENT_PINS: Record<string, { id: string }[]> = {
            'wokwi-led': [{ id: 'A' }, { id: 'K' }],
            'wokwi-resistor': [{ id: 'p1' }, { id: 'p2' }],
            'wokwi-pushbutton': [{ id: '1' }, { id: '2' }],
            'wokwi-buzzer': [{ id: '1' }, { id: '2' }],
            'wokwi-neopixel-matrix': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
            'wokwi-servo': [{ id: 'GND' }, { id: 'V+' }, { id: 'PWM' }],
            'wokwi-motor': [{ id: 'A' }, { id: 'B' }],
            'wokwi-motor-driver': [{ id: 'IN1' }, { id: 'IN2' }, { id: 'IN3' }, { id: 'IN4' }, { id: 'GND' }, { id: 'VCC' }],
            'wokwi-potentiometer': [{ id: 'GND' }, { id: 'SIG' }, { id: 'VCC' }],
            'wokwi-slide-potentiometer': [{ id: 'GND' }, { id: 'SIG' }, { id: 'VCC' }],
            'wokwi-power-supply': [{ id: 'GND' }, { id: 'VCC' }],
        };

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
                this.twi.completeStop();
            }

            connectToSlave(addr: number, write: boolean) {
                const instArray = Array.from(this.instances.values());
                let ack = false;
                for (const inst of instArray) {
                    if (inst.onI2CStart) {
                        if (inst.onI2CStart(addr, !write)) { // write here in avr8js is actually the exact R/W bit. "write" true means bit is 0
                            ack = true;
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
                // Not heavily used without a specific target, return 0xFF dummy
                this.twi.completeRead(0xFF);
            }
        }

        this.twi.eventHandler = new TWIAdapter(this.twi, this.instances);

        // Setup SPI Hooks bridging AVRSPI to BaseComponents
        this.spi.onByte = (value: number) => {
            const instArray = Array.from(this.instances.values());
            let returnByte = 0xFF; // Default MISO if nothing responds
            for (const inst of instArray) {
                if (inst.onSPIByte) {
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

                if (msg.pins || msg.components) {
                    onStateUpdate(msg);
                }
            }
        }, 1000 / 60);
    }

    private setupHooks() {
        if (!this.cpu) return;

        // All three GND pins on the Uno (gnd_1, gnd_2, gnd_3) are treated as the same ground net.
        const isArduinoGndPin = (compPin: string) =>
            compPin === 'GND' || /^gnd(_\d+)?$/i.test(compPin);

        const isArduinoPin = (wireCoord: string, targetPin: string) => {
            const [compId, compPin] = wireCoord.split(':');
            const inst = this.instances.get(compId);
            if (!inst || !inst.type.includes('arduino')) return false;

            return compPin === targetPin || compPin === `D${targetPin}` || compPin === `A${targetPin}`;
        };

        const updateOopPin = (arduinoPinStr: string, isHigh: boolean) => {
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
                const isFromArduino = isArduinoPin(w.from, arduinoPinStr);
                const isToArduino = isArduinoPin(w.to, arduinoPinStr);

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

                const fromIsArduinoGnd = fromInst && fromInst.type.includes('arduino') && isArduinoGndPin(fromPin);
                const toIsArduinoGnd = toInst && toInst.type.includes('arduino') && isArduinoGndPin(toPin);

                if (fromIsArduinoGnd && toInst) {
                    toInst.setPinVoltage(toPin, 0.0);
                } else if (toIsArduinoGnd && fromInst) {
                    fromInst.setPinVoltage(fromPin, 0.0);
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
            const checkPort = (port: AVRIOPort, pinNames: string[]) => {
                pinNames.forEach((pin, i) => {
                    let forcedLow = false;
                    const arduinoPinStr = pin;
                    const visitedWires = new Set();

                    const checkForGnd = (targetStr: string) => {
                        const [compId, compPin] = targetStr.split(':');
                        const inst = this.instances.get(compId);
                        if (inst) {
                            const pk = compPin.toLowerCase();
                            const isGndNode = pk.startsWith('gnd') || pk === 'vss' || pk === 'k';
                            if (inst.getPinVoltage(compPin) === 0 && isGndNode) {
                                forcedLow = true;
                            }
                            if (inst.type === 'wokwi-pushbutton' && inst.state.pressed && !forcedLow) {
                                const otherPin = compPin === '1' ? '2' : '1';
                                const forwardStr = `${compId}:${otherPin}`;
                                this.currentWires.forEach(w => {
                                    if (!visitedWires.has(w) && (w.from === forwardStr || w.to === forwardStr)) {
                                        visitedWires.add(w);
                                        checkForGnd(w.from === forwardStr ? w.to : w.from);
                                    }
                                });
                            }
                            if (inst.type === 'wokwi-resistor' && !forcedLow) {
                                const otherPin = compPin === 'p1' ? 'p2' : 'p1';
                                const forwardStr = `${compId}:${otherPin}`;
                                this.currentWires.forEach(w => {
                                    if (!visitedWires.has(w) && (w.from === forwardStr || w.to === forwardStr)) {
                                        visitedWires.add(w);
                                        checkForGnd(w.from === forwardStr ? w.to : w.from);
                                    }
                                });
                            }
                        }
                    };

                    this.currentWires.forEach(w => {
                        const isFromArduino = isArduinoPin(w.from, arduinoPinStr);
                        const isToArduino = isArduinoPin(w.to, arduinoPinStr);
                        if (isFromArduino || isToArduino) {
                            visitedWires.add(w);
                            checkForGnd(isFromArduino ? w.to : w.from);
                        }
                    });

                    // Set native input bit. If forced to GND by external circuit, it's false
                    if (port) port.setPin(i, !forcedLow);
                });
            };

            if (this.portB) checkPort(this.portB, ['8', '9', '10', '11', '12', '13']);
            if (this.portD) checkPort(this.portD, ['0', '1', '2', '3', '4', '5', '6', '7']);
            if (this.portC) checkPort(this.portC, ['A0', 'A1', 'A2', 'A3', 'A4', 'A5']);
        };

        const attachPort = (port: AVRIOPort, pinNames: string[]) => {
            port.addListener((value) => {
                pinNames.forEach((pin, i) => {
                    const isHigh = (value & (1 << i)) !== 0;
                    if (this.pinStates[pin] !== isHigh) {
                        this.pinStates[pin] = isHigh;
                        this.pinsChanged = true;
                        updateOopPin(pin, isHigh);
                    }
                });
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
            this.lastTime = now;

            // Transmit one buffered serial byte per roughly 1ms chunk (simulates ~9600 baud)
            if (this.serialBuffer.length > 0 && this.usart) {
                this.usart.writeByte(this.serialBuffer.shift()!);
            }

            const instArray = Array.from(this.instances.values());
            instArray.forEach(inst => inst.update(this.cpu!.cycles, this.currentWires, instArray));

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

                        if (fromComp.includes('arduino') && fromPin === arduinoPin) {
                            isConnectedToPin = true;
                            otherCompId = toComp;
                            otherCompPin = toPin;
                        } else if (toComp.includes('arduino') && toPin === arduinoPin) {
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
        }
    }

    stop() {
        this.running = false;
        clearInterval(this.statusInterval);
    }
}
