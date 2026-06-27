// Quick test: MicroPython + OLED I2C debug — correct pins GP4/GP5
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunnerForBoard } from './execute.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');

function toUf2PayloadFromFile(uf2Path: string): string {
    const raw = fs.readFileSync(uf2Path);
    return `UF2BASE64:${raw.toString('base64')}`;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const uf2Path = path.join(WORKSPACE_ROOT, 'openhw-studio-backend', 'data', 'firmware', 'pico-micropython-uart0.uf2');
    const uf2Payload = toUf2PayloadFromFile(uf2Path);

    // Circuit: Pico + SSD1306 OLED on I2C0 GP4(SDA)/GP5(SCL)
    const components = [
        { id: 'pico1', type: 'openhw-raspberry-pi-pico', attrs: { env: 'micropython', builder: 'arduino-pico' } },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {} },
    ];
    const wires = [
        { from: 'pico1:GND', to: 'oled1:GND' },
        { from: 'pico1:3V3', to: 'oled1:VCC' },
        { from: 'pico1:GP5', to: 'oled1:SCL' },
        { from: 'pico1:GP4', to: 'oled1:SDA' },
    ];

    let serialText = '';
    let i2cDebugEvents = 0;

    // Fixed MicroPython code: use GP4=SDA, GP5=SCL to match wiring
    const micropythonScript = [
        'from machine import Pin, I2C',
        'import time',
        'ADDR = 0x3C',
        'i2c = I2C(0, scl=Pin(5), sda=Pin(4), freq=100000)',
        'print("MP_BOOT_OK")',
        'time.sleep_ms(500)',
        'print("MP_SCAN")',
        'try:',
        '    devices = i2c.scan()',
        '    print("MP_DEVICES=", devices)',
        'except Exception as e:',
        '    print("MP_SCAN_ERR", e)',
        'for i in range(200):',
        '    try:',
        '        i2c.writeto(ADDR, bytearray([0x00, 0xAE]))',
        '        if i == 0: print("MP_I2C_OK")',
        '    except Exception as e:',
        '        if i == 0: print("MP_I2C_ERR", e)',
        '    time.sleep_ms(50)',
        'print("MP_DONE")',
    ].join('\n');

    const runner = await createRunnerForBoard(
        'openhw-raspberry-pi-pico',
        uf2Payload,
        components,
        wires,
        (msg: any) => {
            if (msg?.type === 'serial') {
                serialText += String(msg.data || '');
            }
            if (msg?.type === 'debug' && msg?.category === 'rp2040-i2c') {
                i2cDebugEvents++;
                const i2c = msg?.i2c || {};
                console.log(`[I2C_EVENT] reason=${msg.reason} bus=${i2c.bus} addr=0x${(i2c.address||0).toString(16)} ack=${i2c.ack} deviceCount=${i2c.deviceCount} activeSlave=${i2c.activeSlaveId}`);
            }
        },
        {
            boardId: 'pico1',
            serialBaudRate: 115200,
            debugEnabled: true,
            debugIntervalMs: 300,
        }
    );

    // Inject MicroPython code over serial
    const sendAttempt = () => {
        try {
            (runner as any).serialRx('\u0003\u0003\r\n');
            (runner as any).serialRx(`\u0003\u0003\u0005${micropythonScript}\n\u0004`);
            setTimeout(() => {
                try {
                    (runner as any).serialRx(`\u0003\u0003\u0001${micropythonScript}\n\u0004\u0002`);
                } catch (e) {}
            }, 120);
        } catch (e) {}
    };
    // Retry injections to handle slow MicroPython boot
    [1400, 3600, 5800].forEach((delayMs) => {
        setTimeout(sendAttempt, delayMs);
    });

    console.log('=== Running MicroPython + OLED (GP4/GP5) for 10s ===');
    const start = Date.now();
    await sleep(10000);
    const elapsed = (Date.now() - start) / 1000;

    try { (runner as any).stop(); } catch (e) {}

    console.log(`\n=== Results (${elapsed.toFixed(1)}s) ===`);
    console.log(`Serial (first 2000 chars):\n${serialText.slice(0, 2000)}`);
    console.log(`\nI2C debug events: ${i2cDebugEvents}`);

    // Check serial for key markers
    const hasBoot = serialText.includes('MP_BOOT_OK');
    const hasScan = serialText.includes('MP_SCAN');
    const hasDevices = serialText.includes('MP_DEVICES');
    const hasI2cOk = serialText.includes('MP_I2C_OK');
    const hasDone = serialText.includes('MP_DONE');

    console.log(`\nMarkers: MP_BOOT_OK=${hasBoot} MP_SCAN=${hasScan} MP_DEVICES=${hasDevices} MP_I2C_OK=${hasI2cOk} MP_DONE=${hasDone}`);
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
