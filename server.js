const WebSocket = require('ws');
const { CPU, AVRTimer, avrInstruction, AVRUSART } = require('avr8js');
const { parse } = require('intel-hex');

const wss = new WebSocket.Server({ port: 8085 });

console.log('Universal Emulator WebSocket Server running on port 8085');

// Helper to run instructions
const MHZ = 16e6;

wss.on('connection', (ws) => {
    console.log('Client connected');

    let cpu = null;
    let timer = null;
    let running = false;
    let pinStates = {};

    // High-performance loop
    function runSimulation() {
        if (!running || !cpu) return;

        // Run for a small batch of instructions to prevent blocking the event loop completely
        const startObj = cpu.cycles;
        const targetObj = cpu.cycles + 50000; // run 50k instructions per tick

        while (cpu.cycles < targetObj && running) {
            avrInstruction(cpu);
        }

        if (running) {
            setImmediate(runSimulation);
        }
    }

    // 60fps status broadcast loop
    const _statusInterval = setInterval(() => {
        if (running && cpu) {
            ws.send(JSON.stringify({ type: 'state', pins: pinStates }));
        }
    }, 1000 / 60); // ~16ms

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'START' && data.hex) {
                console.log('Starting simulation for client');

                // Setup memory
                const program = new Uint16Array(32768);
                const { data: hexData } = parse(data.hex);

                // Copy parsed hex to Uint16Array for the CPU
                const u8 = new Uint8Array(program.buffer);
                u8.set(hexData);

                // Setup CPU
                cpu = new CPU(program, 0x2200); // 2KB SRAM

                // Set up the timer
                timer = new AVRTimer(cpu, {
                    spi: () => { }, compA: () => { }, compB: () => { }, compC: () => { },
                    ovf: () => { }, input: () => { }
                });

                // Listen to PORTB (D8-D13) and PORTD (D0-D7), PORTC (A0-A5)
                // Let's attach a catch-all listener for simplicty.
                // In avr8js, pins are mapped to CPU memory locations.
                // PortB is 0x23 (PINB), 0x24 (DDRB), 0x25 (PORTB)
                // PortC is 0x26 (PINC), 0x27 (DDRC), 0x28 (PORTC)
                // PortD is 0x29 (PIND), 0x2A (DDRD), 0x2B (PORTD)

                // Simplified pin mapping tracker
                cpu.writeHooks[0x24] = (val) => { /* DDRB updated */ return true; };
                cpu.writeHooks[0x25] = (val) => {
                    // PORTB updated
                    pinStates['D8'] = (val & (1 << 0)) ? true : false;
                    pinStates['D9'] = (val & (1 << 1)) ? true : false;
                    pinStates['D10'] = (val & (1 << 2)) ? true : false;
                    pinStates['D11'] = (val & (1 << 3)) ? true : false;
                    pinStates['D12'] = (val & (1 << 4)) ? true : false;
                    pinStates['D13'] = (val & (1 << 5)) ? true : false;
                    return true;
                };

                cpu.writeHooks[0x2A] = (val) => { /* DDRD updated */ return true; };
                cpu.writeHooks[0x2B] = (val) => {
                    // PORTD updated
                    pinStates['D0'] = (val & (1 << 0)) ? true : false;
                    pinStates['D1'] = (val & (1 << 1)) ? true : false;
                    pinStates['D2'] = (val & (1 << 2)) ? true : false;
                    pinStates['D3'] = (val & (1 << 3)) ? true : false;
                    pinStates['D4'] = (val & (1 << 4)) ? true : false;
                    pinStates['D5'] = (val & (1 << 5)) ? true : false;
                    pinStates['D6'] = (val & (1 << 6)) ? true : false;
                    pinStates['D7'] = (val & (1 << 7)) ? true : false;
                    return true;
                };

                cpu.writeHooks[0x27] = (val) => { /* DDRC updated */ return true; };
                cpu.writeHooks[0x28] = (val) => {
                    // PORTC updated
                    pinStates['A0'] = (val & (1 << 0)) ? true : false;
                    pinStates['A1'] = (val & (1 << 1)) ? true : false;
                    pinStates['A2'] = (val & (1 << 2)) ? true : false;
                    pinStates['A3'] = (val & (1 << 3)) ? true : false;
                    pinStates['A4'] = (val & (1 << 4)) ? true : false;
                    pinStates['A5'] = (val & (1 << 5)) ? true : false;
                    return true;
                };

                running = true;
                setImmediate(runSimulation);

            } else if (data.type === 'STOP') {
                console.log('Stopping simulation for client');
                running = false;
                cpu = null;
                timer = null;
                pinStates = {};
            }
        } catch (err) {
            console.error('WebSocket msg error:', err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        running = false;
        cpu = null;
        timer = null;
        clearInterval(_statusInterval);
    });
});
