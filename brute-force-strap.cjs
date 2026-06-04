// brute-force-strap.js
// Tests all 64 possible strapValue combinations to find which lets the ESP32 boot
// strapPins for ESP32: [5, 15, 4, 2, 0, 12]
// strapBoot = 16 (bit 4 = GPIO0 HIGH = SPI Flash Boot)
// strapValue default = 19 (0b010011) = GPIO5=1, GPIO15=1, GPIO0=1

const fs = require('fs');
const { ESP32, SimulationClock } = require('./public/openhw-client-esp32/esp32-engine.js');

const rom = fs.readFileSync('./public/assets/esp32/esp32-v3-rom.bin');

// Find latest build with a merged-flash.bin
const buildsDir = '../openhw-studio-backend/builds';
const dirs = fs.readdirSync(buildsDir)
    .map(d => {
        const p = `${buildsDir}/${d}/build/merged-flash.bin`;
        try { return { d, p, t: fs.statSync(p).mtime.getTime() }; } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.t - a.t);

if (!dirs.length) { console.error('No build found!'); process.exit(1); }
const { d: buildId, p: binPath } = dirs[0];
console.log(`Using build: ${buildId}`);
const binContent = fs.readFileSync(binPath);
console.log(`Binary size: ${binContent.length} bytes`);

// Strap pin mapping (bit index -> GPIO pin number)
const STRAP_PINS = [5, 15, 4, 2, 0, 12];
function strapToGpios(val) {
    return STRAP_PINS.map((pin, bit) => `GPIO${pin}=${(val >> bit) & 1}`).join(', ');
}

const LOOP_PCS = new Set([0x4000fca9, 0x4000fcac, 0x4000fcae]);
const FLASH_START = 0x40080000; // App code starts here after boot

console.log('\n=== Brute Force: Testing all 64 strap values ===\n');
const STEPS_PER_TEST = 500000;
const results = [];

for (let strap = 0; strap < 64; strap++) {
    const esp = new ESP32({ flashSizeMB: 4, clock: new SimulationClock() });
    esp.loadROM(rom);

    // Set up flash with actual firmware
    const f = new Uint8Array(4 * 1024 * 1024).fill(0xFF);
    f.set(binContent);
    esp.flash.set(f);

    // Reset THEN set strapValue (key: reset() resets strapValue back to 19)
    esp.reset();
    esp.gpio.strapValue = strap;

    let uartOut = '';
    esp.uart[0].onTX = (b) => { uartOut += String.fromCharCode(b); };

    for (let i = 0; i < STEPS_PER_TEST; i++) esp.step();

    const finalPC = esp.cores[0].PC;
    const inLoop = LOOP_PCS.has(finalPC);
    const booted = finalPC >= FLASH_START;
    const interesting = !inLoop && !booted;

    const gpioStr = strapToGpios(strap);
    const status = booted ? '✅ BOOTED' : (interesting ? '⚠️  INTERESTING' : '❌ LOOP');

    if (booted || interesting) {
        results.push({ strap, finalPC, uartOut, gpioStr, status });
    }

    process.stdout.write(`\rStrap 0x${strap.toString(16).padStart(2,'0')} (${strap.toString(2).padStart(6,'0')}b) → PC: 0x${finalPC.toString(16)} ${status}`);
    if (uartOut) { process.stdout.write(` UART: ${JSON.stringify(uartOut.slice(0,50))}`); }
    process.stdout.write('\n');
}

console.log('\n=== RESULTS ===\n');
if (results.length === 0) {
    console.log('No strap value caused a successful boot or interesting behavior.');
    console.log('The issue is NOT with strapping — it\'s something else (SPI protocol, flash size, binary format).');
} else {
    for (const r of results) {
        console.log(`\n${r.status} Strap: 0x${r.strap.toString(16)} (${r.gpioStr})`);
        console.log(`  PC: 0x${r.finalPC.toString(16)}`);
        if (r.uartOut) console.log(`  UART: ${JSON.stringify(r.uartOut.slice(0, 200))}`);
    }
}
