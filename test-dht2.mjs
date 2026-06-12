import { readFileSync } from 'fs';
import * as mod from './src/wasm/autowiring/openhw_studio_autowiring_engine.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
    const wasmPath = path.resolve(__dirname, './src/wasm/autowiring/openhw_studio_autowiring_engine_bg.wasm');
    const wasmBuffer = readFileSync(wasmPath);
    await mod.default(wasmBuffer);

    const manifestStr = readFileSync('/Users/riteshjadhav/Desktop/FOSSEE_COMP_FIX/openhw-studio-emulator/src/components/DHT-22/manifest.json', 'utf-8');
    const manifest = JSON.parse(manifestStr);
    const unoManifestStr = readFileSync('/Users/riteshjadhav/Desktop/FOSSEE_COMP_FIX/openhw-studio-emulator/src/components/openhw-arduino-uno/manifest.json', 'utf-8');
    const unoManifest = JSON.parse(unoManifestStr);

    mod.reset();
    mod.ingestComponent('uno1', 'openhw-arduino-uno', 0, 0, 400, 300, unoManifest.pins);

    const newComp = { id: 'dht22_1', type: 'openhw-dht22', x: 500, y: 0 };

    const plan = mod.generateAutonomousSetup(newComp, manifest, 'uno1', [], false, false);
    console.log("Plan:", JSON.stringify(plan, null, 2));
}
run().catch(console.error);
