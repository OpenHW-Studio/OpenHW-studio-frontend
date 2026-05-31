import { SlidePotLogic } from '../../../openhw-studio-emulator-danish/src/components/wokwi-slide-potentiometer/logic.js';

const components = [
    { id: 'wokwi-arduino-uno_4', type: 'wokwi-arduino-uno', attrs: {} },
    { id: 'wokwi-slide-potentiometer_6', type: 'wokwi-slide-potentiometer', attrs: { value: "50" } }
];

const wires = [
    { from: 'wokwi-slide-potentiometer_6:VCC', to: 'wokwi-arduino-uno_4:5V' },
    { from: 'wokwi-slide-potentiometer_6:GND', to: 'wokwi-arduino-uno_4:gnd_2' },
    { from: 'wokwi-slide-potentiometer_6:SIG', to: 'wokwi-arduino-uno_4:A0' }
];

const inst = new SlidePotLogic('wokwi-slide-potentiometer_6', { pins: [{ id: 'VCC' }, { id: 'GND' }, { id: 'SIG' }] });

inst.onEvent({ type: 'input', value: 71 });
inst.update(0, wires, [inst]);

console.log("Pin voltage after update:", inst.getPinVoltage('SIG'));

const isArduinoPin = (wireCoord: string, targetPin: string) => {
    const [compId, compPin] = wireCoord.split(':');
    const compDef = components.find(c => c.id === compId);
    if (!compDef || !compDef.type.includes('arduino')) return false;

    return compPin === targetPin || compPin === `D${targetPin}` || compPin === `A${targetPin}`;
};

let voltage = 0;
wires.forEach(w => {
    const isFromArduino = isArduinoPin(w.from, 'A0');
    const isToArduino = isArduinoPin(w.to, 'A0');

    console.log(`Wire: ${w.from} -> ${w.to}, isFromArduino=${isFromArduino}, isToArduino=${isToArduino}`);

    if (isFromArduino || isToArduino) {
        const targetStr = isFromArduino ? w.to : w.from;
        console.log(`targetStr=${targetStr}`);
        const [compId, compPin] = targetStr.split(':');

        // Mock get instance
        if (compId === 'wokwi-slide-potentiometer_6') {
            voltage = inst.getPinVoltage(compPin);
        }
    }
});

console.log("Voltage extracted:", voltage);
