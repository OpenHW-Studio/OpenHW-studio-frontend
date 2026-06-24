import { readFile } from 'fs/promises';
import { resolve } from 'path';
import init, { generateAutonomousSetup, ingestComponent, reset } from './src/wasm/autowiring/openhw_studio_autowiring_engine.js';

async function run() {
    const wasmPath = new URL('./src/wasm/autowiring/openhw_studio_autowiring_engine_bg.wasm', import.meta.url);
    const wasmBytes = await readFile(wasmPath);
    await init(wasmBytes);
    reset();

    const ringManifestStr = await readFile(resolve('../openhw-studio-emulator/src/components/openhw-neopixel-ring/manifest.json'), 'utf-8');
    const ringManifest = JSON.parse(ringManifestStr);
    
    const unoManifestStr = await readFile(resolve('../openhw-studio-emulator/src/components/openhw-arduino-uno/manifest.json'), 'utf-8');
    const unoManifest = JSON.parse(unoManifestStr);

    const bbManifestStr = await readFile(resolve('../openhw-studio-emulator/src/components/openhw-breadboard-half/manifest.json'), 'utf-8');
    const bbManifest = JSON.parse(bbManifestStr);

    // Ingest board
    ingestComponent('uno1', 'openhw-arduino-uno', 0, 0, 425, 320, unoManifest.pins);
    
    // Ingest breadboard
    ingestComponent('bb1', 'openhw-breadboard-half', 0, 400, 495, 295, bbManifest.pins);

    // Ingest ring
    ingestComponent('ring1', 'openhw-neopixel-ring', 0, 450, 60, 60, ringManifest.pins);

    try {
        const components = [
            { id: 'uno1', type: 'openhw-arduino-uno', x: 0, y: 0, w: 425, h: 320 },
            { id: 'bb1', type: 'openhw-breadboard-half', x: 0, y: 400, w: 495, h: 295 },
        ];
        
        const newComp = { id: 'ring1', type: 'openhw-neopixel-ring', x: 0, y: 450, w: 60, h: 60 };
        
        console.log("Calling generateAutonomousSetup...");
        const plan = generateAutonomousSetup(newComp, ringManifest, 'uno1', [], true, false);
        console.log("PLAN:", JSON.stringify(plan, null, 2));
    } catch (e) {
        console.error("ERROR:", e);
    }
}

run();
