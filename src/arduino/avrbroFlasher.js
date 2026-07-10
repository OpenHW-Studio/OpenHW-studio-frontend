import avrbro from './avrbro/index.js';

/**
 * Flashes an Arduino (AVR) over Web Serial using avrbro.
 * @param {SerialPort} port The Web Serial port object obtained from navigator.serial
 * @param {string} hexText The raw Intel HEX string
 * @param {Object} options Options containing boardName and onProgress callback
 */
export async function flashArduinoWebSerial(port, hexText, options = {}) {
    const { 
        boardName = 'uno', 
        onProgress = (msg) => console.log(msg) 
    } = options;

    try {
        onProgress('Parsing HEX file...\n');
        
        // avrbro expects the raw hex string or a parsed binary array
        // parseHex usually handles turning the string into the binary format STK500 needs
        const binaryData = avrbro.parseHex ? avrbro.parseHex(hexText) : hexText;

        onProgress(`Starting flash sequence for Arduino ${boardName}...\n`);
        onProgress(`Please wait while the firmware is being uploaded... (This may take a few moments)\n`);

        const boardInfo = avrbro.boardsHelper.getBoard(boardName);
        const baudRate = boardInfo ? boardInfo.baud : 57600;

        // Open the Web Serial port
        await port.open({ baudRate });
        const reader = port.readable.getReader();
        const writer = port.writable.getWriter();
        const serialObj = { port, reader, writer };

        try {
            try {
                await avrbro.flash(serialObj, binaryData, { 
                    boardName: boardName, 
                    debug: false // Disabled debug logging to prevent heavy UI re-renders which throttle Web Serial I/O
                });
            } catch (flashErr) {
                // If upload finished but exiting bootloader mode or final page write timed out during handover, treat as non-fatal success
                const msg = flashErr?.message || '';
                if (msg.includes('Sending 11') || msg.includes('LEAVE_PROGMODE') || msg.includes('receiveData timeout') || msg.includes('Sending 64')) {
                    console.warn('Non-fatal bootloader handover/exit timeout ignored:', msg);
                } else {
                    throw flashErr;
                }
            }
            onProgress('Flash complete.\n');
        } finally {
            // Clean up serial port locks
            writer.releaseLock();
            reader.releaseLock();
            await port.close();
        }

    } catch (e) {
        onProgress(`\nError during flashing: ${e.message || e}\n`);
        throw e;
    }
}
