class SlidePotLogic {
    constructor(id) {
        this.id = id;
        this.state = { value: 50 };
        this.pins = { VCC: { voltage: 0 }, GND: { voltage: 0 }, SIG: { voltage: 0 } };
    }

    getPinVoltage(pin) { return this.pins[pin].voltage; }
    setPinVoltage(pin, v) { this.pins[pin].voltage = v; }

    update(wires) {
        let val = Number(this.state.value) || 0;
        let vcc = this.getPinVoltage('VCC');
        let gnd = this.getPinVoltage('GND');

        wires.forEach(w => {
            if (w.from === `${this.id}:VCC` || w.to === `${this.id}:VCC`) {
                const other = w.from === `${this.id}:VCC` ? w.to : w.from;
                const pk = other.toLowerCase();
                if (pk.endsWith(':5v') || pk.endsWith(':vcc')) vcc = 5.0;
                if (pk.endsWith(':3.3v') || pk.endsWith(':3v3')) vcc = 3.3;
                if (pk.includes(':gnd')) vcc = 0.0;
            }
            if (w.from === `${this.id}:GND` || w.to === `${this.id}:GND`) {
                const other = w.from === `${this.id}:GND` ? w.to : w.from;
                const pk = other.toLowerCase();
                if (pk.endsWith(':5v') || pk.endsWith(':vcc')) gnd = 5.0;
                if (pk.endsWith(':3.3v') || pk.endsWith(':3v3')) gnd = 3.3;
                if (pk.includes(':gnd')) gnd = 0.0;
            }
        });

        const sigV = gnd + (vcc - gnd) * (val / 100.0);
        this.setPinVoltage('SIG', sigV);
        console.log(`[SlidePot] id=${this.id} val=${val} vcc=${vcc} gnd=${gnd} sigV=${sigV}`);
    }
}

const components = [
    { id: 'wokwi-arduino-uno_4', type: 'wokwi-arduino-uno', attrs: {} },
    { id: 'wokwi-slide-potentiometer_6', type: 'wokwi-slide-potentiometer', attrs: { value: "71" } }
];

const wires = [
    { from: 'wokwi-slide-potentiometer_6:VCC', to: 'wokwi-arduino-uno_4:5V' },
    { from: 'wokwi-slide-potentiometer_6:GND', to: 'wokwi-arduino-uno_4:gnd_2' },
    { from: 'wokwi-slide-potentiometer_6:SIG', to: 'wokwi-arduino-uno_4:A0' },
    { from: 'wokwi-servo_8:V+', to: 'wokwi-arduino-uno_4:5V' },
    { from: 'wokwi-servo_8:PWM', to: 'wokwi-arduino-uno_4:9' },
    { from: 'wokwi-servo_8:GND', to: 'wokwi-arduino-uno_4:gnd_1' }
];

const inst = new SlidePotLogic('wokwi-slide-potentiometer_6');
inst.state.value = 71;
inst.update(wires);

const isArduinoPin = (wireCoord, targetPin) => {
    const [compId, compPin] = wireCoord.split(':');
    const compDef = components.find(c => c.id === compId);
    if (!compDef || !compDef.type.includes('arduino')) return false;

    return compPin === targetPin || compPin === `D${targetPin}` || compPin === `A${targetPin}`;
};

let voltage = 0;
let isArduinoPinLogs = [];
wires.forEach(w => {
    const isFromArduino = isArduinoPin(w.from, 'A0');
    const isToArduino = isArduinoPin(w.to, 'A0');

    if (isFromArduino || isToArduino) {
        const targetStr = isFromArduino ? w.to : w.from;
        const [compId, compPin] = targetStr.split(':');
        isArduinoPinLogs.push(`Found Arduino pinpoint mathing A0. Target: ${compId}:${compPin}`);
        if (compId === 'wokwi-slide-potentiometer_6') {
            const v = inst.getPinVoltage('SIG');
            if (v > voltage) voltage = v;
        }
    }
});

console.log("Extracted Voltage:", voltage);
console.log(isArduinoPinLogs);
