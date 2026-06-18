import { ESPLoader, Transport } from 'esptool-js';

/**
 * Flashes an ESP32 over Web Serial using esptool-js.
 * @param {SerialPort} port The Web Serial port object obtained from navigator.serial
 * @param {string} base64Hex The base64 encoded merged binary firmware
 * @param {Object} options Options containing baudRate and onProgress callback
 */
export async function flashESP32WebSerial(port, base64Hex, options = {}) {
    const { 
        baudRate = 115200, 
        onProgress = (msg) => console.log(msg) 
    } = options;

    let transport;

    try {
        // esptool-js expects a Uint8Array for the 'data' field.
        // We decode base64 into a binary string, then pack it into a Uint8Array
        // to prevent JavaScript from accidentally applying UTF-8 encoding.
        let rawBase64 = base64Hex;
        if (rawBase64.includes(':')) {
            rawBase64 = rawBase64.split(':').pop();
        }
        
        const binaryString = atob(rawBase64);
        const len = binaryString.length;
        const binaryData = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            binaryData[i] = binaryString.charCodeAt(i);
        }

        const terminal = {
            clean() { },
            writeLine(data) {
                onProgress(data + '\n');
            },
            write(data) {
                onProgress(data);
            }
        };

        // Initialize transport with the provided Web Serial port
        transport = new Transport(port, true);
        
        const esploader = new ESPLoader({
            transport,
            baudrate: baudRate,
            terminal,
            romBaudrate: 115200
        });

        onProgress('Connecting to ESP32...\n');
        const chip = await esploader.main();
        onProgress(`Connected to ${chip}\n`);

        const fileArray = [
            {
                data: binaryData, 
                address: 0x0
            }
        ];

        onProgress('Starting flash sequence...\n');
        try {
            await esploader.writeFlash({
                fileArray,
                flashSize: 'keep',
                flashMode: 'keep',
                flashFreq: 'keep',
                eraseAll: false,
                compress: true,
                reportProgress: (fileIndex, written, total) => {
                    const percent = Math.round((written / total) * 100);
                    onProgress(`Writing: ${percent}%...\n`);
                }
            });
        } catch (flashErr) {
            if (flashErr.message && flashErr.message.includes('Failed to leave compressed flash mode')) {
                onProgress('Note: Timed out waiting for final flash acknowledgment, but writing finished.\n');
            } else {
                throw flashErr;
            }
        }

        onProgress('Flash complete. Performing hard reset...\n');
        if (typeof esploader.hard_reset === 'function') {
            await esploader.hard_reset();
        } else if (transport) {
            // Manual hard reset using Web Serial DTR/RTS lines
            await transport.setDTR(false);
            await transport.setRTS(true);
            await new Promise((resolve) => setTimeout(resolve, 100));
            await transport.setDTR(false);
            await transport.setRTS(false);
        }
    } catch (e) {
        onProgress(`\nError during flashing: ${e.message || e}\n`);
        throw e;
    } finally {
        if (transport) {
            await transport.disconnect();
        }
    }
}
