/**
 * Protocol Analyzer
 * Translates raw emulator bus events into human-readable logs.
 */

export class ProtocolAnalyzer {
    constructor() {
        this.logs = [];
    }

    /**
     * Process an I2C event from the emulator
     */
    processI2C(event) {
        const { address, data, isWrite, timestamp } = event;
        const mode = isWrite ? 'WRITE' : 'READ';
        const hexData = Array.isArray(data) ? data.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ') : '0x' + data.toString(16);
        
        const log = {
            type: 'I2C',
            time: timestamp || Date.now(),
            message: `[I2C] Addr: 0x${address.toString(16).toUpperCase()} | ${mode} | Data: ${hexData}`
        };

        this.logs.push(log);
        return log;
    }

    /**
     * Process an SPI event from the emulator
     */
    processSPI(event) {
        const { data, timestamp } = event;
        const hexData = Array.isArray(data) ? data.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ') : '0x' + data.toString(16);

        const log = {
            type: 'SPI',
            time: timestamp || Date.now(),
            message: `[SPI] Data: ${hexData}`
        };

        this.logs.push(log);
        return log;
    }

    clear() {
        this.logs = [];
    }
}
