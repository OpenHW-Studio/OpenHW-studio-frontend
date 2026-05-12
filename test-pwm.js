const { CPU, AVRIOPort, portBConfig, AVRTimer, timer1Config } = require('avr8js');

const cpu = new CPU(new Uint16Array(1024));
const p = new AVRIOPort(cpu, portBConfig);
const t1 = new AVRTimer(cpu, timer1Config);

console.log("AVRIOPort prototypes:");
console.log(Object.getOwnPropertyNames(AVRIOPort.prototype));

console.log("\nAVRTimer prototypes:");
console.log(Object.getOwnPropertyNames(AVRTimer.prototype));
