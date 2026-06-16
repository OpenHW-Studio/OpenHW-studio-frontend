const fs = require('fs');
const { ESP32 } = require('./public/openhw-client-esp32/esp32-engine.js');

const rom = fs.readFileSync('./public/assets/esp32/esp32-v3-rom.bin');
const dirs = fs.readdirSync('../openhw-studio-backend/builds')
    .map(d => { const p = '../openhw-studio-backend/builds/'+d+'/build/merged-flash.bin'; try { return { d, p, t: fs.statSync(p).mtime.getTime() }; } catch { return null; }})
    .filter(Boolean).sort((a, b) => b.t - a.t);
const bin = fs.readFileSync(dirs[0].p);
console.log('Build:', dirs[0].d, '| Binary:', bin.length, 'bytes');

const esp = new ESP32({ flashSizeMB: 4, flash: bin });
esp.loadROM(rom);
esp.flash.set(bin);
esp.reset();
for (let p = 0; p < 64; p++) { esp.mmuTablePro[p] = p; esp.mmuTableApp[p] = p; }

// UART auto-drain fix
const uart0 = esp.uart[0];
const origTxUpdated = uart0.txUpdated.bind(uart0);
let uartOut = '';
uart0.onTX = b => { uartOut += String.fromCharCode(b); };
uart0.txUpdated = function() {
    origTxUpdated();
    if (this.txState !== 0) this.txComplete();
};

const MAX_STEPS = 50_000_000;
const REPORT_EVERY = 5_000_000;

for (let i = 0; i < MAX_STEPS; i++) {
    esp.step();
    if ((i + 1) % REPORT_EVERY === 0) {
        const pc = esp.cores[0].PC;
        console.log('Step', (i+1)/1e6 + 'M | PC: 0x' + pc.toString(16) + ' | Booted: ' + (pc >= 0x40080000));
        console.log('UART so far:', JSON.stringify(uartOut.slice(-200)));
        if (pc >= 0x40080000) { console.log('=== BOOTED! ==='); break; }
    }
}

const pc = esp.cores[0].PC;
console.log('\nFinal PC:', '0x' + pc.toString(16));
console.log('Booted:', pc >= 0x40080000 ? 'YES!!!' : 'no');
console.log('Full UART:', JSON.stringify(uartOut));
