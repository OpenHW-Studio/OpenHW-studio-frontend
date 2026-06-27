import fs from 'fs';
import path from 'path';
import { RP2040, bootromB1 } from 'rp2040js';
import { loadRP2040FirmwareFromUF2Payload } from './runners/rp2040-runner.ts';

const UF2_PAYLOAD_PREFIX = 'UF2BASE64:';

async function main() {
    const uf2Path = path.resolve('../../openhw-studio-backend/data/firmware/pico-micropython-uart0.uf2');
    const uf2Data = fs.readFileSync(uf2Path);
    const uf2Payload = `${UF2_PAYLOAD_PREFIX}${uf2Data.toString('base64')}`;

    console.log(`UF2 payload length = ${uf2Payload.length}`);

    const rp2040 = new RP2040();
    rp2040.loadBootrom(bootromB1);

    const entryInfo = loadRP2040FirmwareFromUF2Payload(rp2040, uf2Payload);
    console.log(`Loaded UF2: EntryPoint = 0x${entryInfo.entryPoint.toString(16)}`);

    let output = '';
    rp2040.uart[0].onByte = (value) => {
        output += String.fromCharCode(value);
        process.stdout.write(String.fromCharCode(value));
    };

    rp2040.core.PC = 0x00000000;
    
    // Apply our GPIO fix
    for (let i = 0; i < 30; i++) {
        const gpio = rp2040.gpio[i];
        if (gpio) {
            gpio.padValue |= 0x40;
        }
    }

    console.log('Running for 1 second of emulated time...');
    for (let i = 0; i < 125000000; i++) {
        rp2040.executeInstruction();
        
        if (i % 10000000 === 0) {
            console.log(`PC = 0x${rp2040.core.PC.toString(16)}`);
        }
    }
    console.log('\nDone.');
}

main().catch(console.error);
