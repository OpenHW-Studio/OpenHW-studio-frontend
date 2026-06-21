const fs = require('fs');
global.process = { env: {} };
const { ESP32 } = require('./public/openhw-client-esp32/esp32-engine.js');

const rom = fs.readFileSync('./public/assets/esp32/esp32-v3-rom.bin');
const dirs = fs.readdirSync('../openhw-studio-backend/builds')
    .map(d => { const p = '../openhw-studio-backend/builds/'+d+'/build/merged-flash.bin'; try { return { d, p, t: fs.statSync(p).mtime.getTime() }; } catch { return null; }})
    .filter(Boolean).sort((a, b) => b.t - a.t);
const bin = fs.readFileSync(dirs[0].p);

const esp = new ESP32({ flashSizeMB: 4, flash: bin });
esp.loadROM(rom);
esp.flash.set(bin);
esp.reset();

// MMU identity mapping
for (let p = 0; p < 64; p++) { esp.mmuTablePro[p] = p; esp.mmuTableApp[p] = p; }

// UART auto-drain
const uart0 = esp.uart[0];
const origTxUpdated = uart0.txUpdated.bind(uart0);
let uartOut = '';
uart0.onTX = b => { uartOut += String.fromCharCode(b); };
uart0.txUpdated = function() {
    origTxUpdated();
    if (this.txState !== 0) this.txComplete();
};

// Intercept ALL memory reads to catch what the BootROM sees as 'invalid header'
const core = esp.cores[0];
const origRead = core.readUint32.bind(core);
const suspectReads = [];
core.readUint32 = function(addr) {
    const v = origRead(addr);
    // Catch any read of 0xffffffff from flash-mapped regions
    if ((v >>> 0) === 0xffffffff && addr >= 0x3f400000 && addr < 0x3f500000) {
        suspectReads.push({ addr: '0x'+addr.toString(16), pc: '0x'+core.PC.toString(16) });
    }
    return v;
};

let steps = 0;
while (uartOut.indexOf('invalid header') === -1 && steps < 5000000) {
    esp.step();
    steps++;
}
console.log('Steps until "invalid header":', steps);
console.log('UART so far:', JSON.stringify(uartOut.slice(0, 200)));
console.log('First 5 0xffffffff reads from flash window:', suspectReads.slice(0, 5));

// Now check what the flashMMUMap says for the addresses being read
console.log('\nflashMMUMap entries around suspect addresses:');
for (const r of suspectReads.slice(0, 3)) {
    const addr = parseInt(r.addr, 16);
    const virtualPage = addr >>> 16;
    console.log('  addr ' + r.addr + ' -> virtual page ' + virtualPage + ' (0x' + virtualPage.toString(16) + ')');
    const mmuIdx = esp.flashMMUMap.get(virtualPage);
    console.log('  flashMMUMap.get(' + virtualPage + ') =', mmuIdx);
    if (mmuIdx !== undefined) {
        const physPage = esp.mmuTablePro[mmuIdx];
        console.log('  mmuTablePro[' + mmuIdx + '] =', physPage, '-> physical offset 0x' + (physPage * 0x10000).toString(16));
    }
}
