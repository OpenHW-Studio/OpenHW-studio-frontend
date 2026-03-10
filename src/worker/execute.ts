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
import { ShiftRegisterLogic } from '@openhw/emulator/src/components/shift_register/logic.ts';

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
    'wokwi-buzzer': BuzzerLogic,
    'wokwi-motor': MotorLogic,
    'wokwi-servo': ServoLogic,
    'wokwi-motor-driver': MotorDriverLogic,
    'wokwi-slide-potentiometer': SlidePotLogic,
    'wokwi-potentiometer': PotentiometerLogic,
    'shift_register': ShiftRegisterLogic,
};

// Per-type pin lists so every component's pins are registered correctly
export const COMPONENT_PINS: Record<string, { id: string }[]> = {
    'wokwi-led': [{ id: 'A' }, { id: 'K' }],
    'wokwi-resistor': [{ id: 'p1' }, { id: 'p2' }],
    'wokwi-pushbutton': [{ id: '1' }, { id: '2' }],
    'wokwi-buzzer': [{ id: '1' }, { id: '2' }],
    'wokwi-neopixel-matrix': [{ id: 'DIN' }, { id: 'VCC' }, { id: 'GND' }],
    'wokwi-servo': [{ id: 'GND' }, { id: 'V+' }, { id: 'PWM' }],
    'wokwi-motor': [{ id: '1' }, { id: '2' }],
    'wokwi-motor-driver': [{ id: 'ENA' }, { id: 'ENB' }, { id: 'IN1' }, { id: 'IN2' }, { id: 'IN3' }, { id: 'IN4' }, { id: 'OUT1' }, { id: 'OUT2' }, { id: 'OUT3' }, { id: 'OUT4' }, { id: '12V' }, { id: '5V' }, { id: 'GND' }],
    'wokwi-potentiometer': [{ id: '1' }, { id: '2' }, { id: 'SIG' }],
    'wokwi-slide-potentiometer': [{ id: 'GND' }, { id: 'SIG' }, { id: 'VCC' }],
    'wokwi-power-supply': [{ id: 'GND' }, { id: 'VCC' }],
    'shift_register': [{ id: 'vcc' }, { id: 'gnd' }, { id: 'ser' }, { id: 'srclk' }, { id: 'rclk' }, { id: 'oe' }, { id: 'srclr' }, { id: 'q0' }, { id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }, { id: 'q6' }, { id: 'q7' }, { id: 'q7s' }],
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
    private i2sState = new Map<string, { bclkLast: boolean; wsLast: boolean; shiftBuf: number; bitCount: number }>();

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

            let unoId = '';
            for (const [id, inst] of this.instances) {
                if (inst.type === 'wokwi-arduino-uno') {
                    unoId = id;
                    break;
                }
            }

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
                onStateUpdate(msg);
            }
        }, 1000 / 60);
    }

    private setupHooks() {
        if (!this.cpu) return;

        // All three GND pins on the Uno (gnd_1, gnd_2, gnd_3) are treated as the same ground net.
        const isArduinoGndPin = (compPin: string) =>
            compPin === 'GND' || /^gnd(_\d+)?$/i.test(compPin);

        const isArduino5VPin = (compPin: string) =>
            compPin === '5V' || compPin === 'VCC';

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

                const fromIsArduino5V = fromInst && fromInst.type.includes('arduino') && isArduino5VPin(fromPin);
                const toIsArduino5V = toInst && toInst.type.includes('arduino') && isArduino5VPin(toPin);

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

                        // Notify the board itself
                        this.instances.forEach(inst => {
                            if (inst.type.includes('arduino')) {
                                inst.onPinStateChange(pin, isHigh, this.cpu!.cycles);
                            }
                        });

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
            if (inst.pins[name])             return inst.getPinVoltage(name) < 0.5;
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

        const pin    = changedPin.toLowerCase();
        const isBclk = pin === 'bclk' || pin === 'sck' || pin === 'bit_clk' || pin === 'blck';
        const isWs   = pin === 'ws'   || pin === 'lrck' || pin === 'wsel'   || pin === 'lrc';

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
                    const sample  = (state.shiftBuf << (32 - bpf)) | 0; // sign-extend
                    inst.onI2SFrame(channel, sample, bpf);
                }
                state.wsLast   = isHigh;
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
            const bit   = sdPin !== null ? (inst.getPinVoltage(sdPin) > 0.5 ? 1 : 0) : 0;

            const bpf = (inst.state?.i2sBitsPerFrame as number | undefined) ?? 16;
            state.shiftBuf = ((state.shiftBuf << 1) | bit) >>> 0;
            state.bitCount++;

            if (state.bitCount >= bpf) {
                const channel = state.wsLast ? 1 : 0;
                const sample  = (state.shiftBuf << (32 - bpf)) | 0;
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
            if (inst.pins[name])               return name;
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
