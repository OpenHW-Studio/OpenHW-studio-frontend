import { CPU, timer0Config, timer1Config, timer2Config, AVRTimer, avrInstruction } from 'avr8js';

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

        // Instantiate components
        (componentsDef || []).forEach(cDef => {
            const LogicClass = LOGIC_REGISTRY[cDef.type];
            if (LogicClass) {
                // Mock manifest lookup since we don't have full fs reads in worker
                // But we must tell the base component what pins are valid!
                const manifest = { type: cDef.type, attrs: cDef.attrs || {}, pins: [{ id: 'A' }, { id: 'K' }, { id: 'GND' }, { id: 'VSS' }] };
                const inst = new LogicClass(cDef.id, manifest);
                if (cDef.attrs) inst.state = { ...inst.state, ...cDef.attrs };
                this.instances.set(cDef.id, inst);
            }
        });

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



        const attachPortHook = (pinReg: number, ddrReg: number, portReg: number, pins: string[]) => {
            this.cpu!.writeHooks[ddrReg] = () => false;
            this.cpu!.writeHooks[portReg] = (val: number) => {
                pins.forEach((pin, i) => {
                    const isHigh = (val & (1 << i)) !== 0;
                    if (this.pinStates[pin] !== isHigh) {
                        this.pinStates[pin] = isHigh;
                        this.pinsChanged = true;
                        updateOopPin(pin, isHigh);
                    }
                });
                return false;
            };

            this.cpu!.readHooks[pinReg] = () => {
                let pinValue = 0;
                pins.forEach((pin, i) => {
                    // Start by assuming the pin matches whatever the AVR PORTx latch is outputting (pullups etc)
                    let bitIsHigh = this.pinStates[pin];

                    // Check if an external component is forcing this line low (e.g. Button to GND)
                    let forcedLow = false;
                    const arduinoPinStr = pin;
                    const visitedWires = new Set();

                    const checkForGnd = (targetStr: string) => {
                        const [compId, compPin] = targetStr.split(':');
                        const inst = this.instances.get(compId);
                        if (inst) {
                            // First, check if THIS exact pin is hard-tied to GND logic levels
                            const pk = compPin.toLowerCase();
                            const isGndNode = pk.startsWith('gnd') || pk === 'vss' || pk === 'k';
                            if (inst.getPinVoltage(compPin) === 0 && isGndNode) {
                                console.log(`[AVR trace ] Hit hard GND on ${compId}:${compPin}`);
                                forcedLow = true;
                            }

                            // Traverse THROUGH active pushbutton if it is pressed
                            if (inst.type === 'wokwi-pushbutton' && inst.state.pressed && !forcedLow) {
                                console.log(`[AVR trace ] Traversing active pushbutton ${compId}`);
                                const otherPin = compPin === '1' ? '2' : '1';
                                const forwardStr = `${compId}:${otherPin}`;
                                this.currentWires.forEach(w => {
                                    if (!visitedWires.has(w) && (w.from === forwardStr || w.to === forwardStr)) {
                                        visitedWires.add(w);
                                        checkForGnd(w.from === forwardStr ? w.to : w.from);
                                    }
                                });
                            }

                            // Traverse THROUGH passive components like resistors
                            if (inst.type === 'wokwi-resistor' && !forcedLow) {
                                console.log(`[AVR trace ] Traversing resistor ${compId}`);
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
                            // Only log the first jump down the wire tree
                            const targetStr = isFromArduino ? w.to : w.from;
                            if (visitedWires.size === 1) {
                                // console.log(`[AVR trace ] Pin ${arduinoPinStr} jump to ${targetStr}...`);
                            }
                            checkForGnd(targetStr);
                        }
                    });

                    if (forcedLow) {
                        bitIsHigh = false; // The external button pulled it low
                    }

                    if (bitIsHigh) {
                        pinValue |= (1 << i);
                    }
                });
                return pinValue;
            };
        };

        // attachPortHook signature: PIN, DDR, PORT, pin names array
        attachPortHook(0x23, 0x24, 0x25, ['8', '9', '10', '11', '12', '13']); // PORTB
        attachPortHook(0x29, 0x2A, 0x2B, ['0', '1', '2', '3', '4', '5', '6', '7']); // PORTD
        attachPortHook(0x26, 0x27, 0x28, ['A0', 'A1', 'A2', 'A3', 'A4', 'A5']); // PORTC

        // Initialize all hooked pins to LOW on startup so LED components aren't stuck waiting for a toggle
        ['8', '9', '10', '11', '12', '13', '0', '1', '2', '3', '4', '5', '6', '7'].forEach(pin => {
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

            while (this.cpu.cycles < targetObj && this.running) {
                avrInstruction(this.cpu);
                this.cpu.tick();
            }
            this.lastTime = now;

            const instArray = Array.from(this.instances.values());
            instArray.forEach(inst => inst.update(this.cpu!.cycles, this.currentWires, instArray));
        }

        setTimeout(this.runLoop, 1);
    }

    stop() {
        this.running = false;
        clearInterval(this.statusInterval);
    }
}
