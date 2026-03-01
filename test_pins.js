const { execSync } = require('child_process');
const { CPU, avrInstruction, AVRTimer } = require('avr8js');
const { parse } = require('intel-hex');
const fs = require('fs');
const path = require('path');

const cli = path.resolve(__dirname, '../../bin/arduino-cli.exe');
fs.writeFileSync('blink.ino', 'void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); digitalWrite(13, LOW); }');
execSync(`"${cli}" compile --fqbn arduino:avr:uno --build-path ./build blink.ino`);
const hex = fs.readFileSync('./build/blink.ino.hex', 'utf8');

const { data: hexData } = parse(hex);
const program = new Uint16Array(32768);
new Uint8Array(program.buffer).set(hexData);
const cpu = new CPU(program, 0x2200);
new AVRTimer(cpu, {
    spi: () => { }, compA: () => { }, compB: () => { }, compC: () => { },
    ovf: () => { }, input: () => { }
});

for (let i = 0x20; i < 0x30; i++) {
    cpu.writeHooks[i] = (val) => {
        console.log(`Address 0x${i.toString(16).toUpperCase()} written: ${val.toString(2)}`);
        return true;
    }
}

console.log("Running simulation...");
for (let i = 0; i < 500000; i++) {
    avrInstruction(cpu);
}
