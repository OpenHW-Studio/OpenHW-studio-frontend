const WebSocket = require('ws');
const { CPU, AVRTimer, avrInstruction, timer0Config, timer1Config, timer2Config } = require('avr8js');
const { parse } = require('intel-hex');

const wss = new WebSocket.Server({ port: 8085 });

console.log('Universal Emulator WebSocket Server running on port 8085');

// Helper to run instructions
const MHZ = 16e6;

wss.on('connection', (ws) => {
    console.log('Client connected');

    let cpu = null;
    let timers = [];
    let running = false;
    let pinStates = {};

    let lastTime = 0;

    // Real-time synced loop
    function runSimulation() {
        if (!running || !cpu) return;

        const now = Date.now();
        if (lastTime === 0) lastTime = now;

        const deltaTime = now - lastTime;

        if (deltaTime > 0) {
            // 16 MHz = 16,000 CPU cycles per real-life millisecond
            const cyclesToRun = deltaTime * 16000;

            // Limit to at most 100ms of calculations at a time so the server doesn't freeze
            const targetObj = cpu.cycles + Math.min(cyclesToRun, 1600000);

            while (cpu.cycles < targetObj && running) {
                avrInstruction(cpu);
                cpu.tick();
            }
            lastTime = now;
        }

        if (running) {
            // Give 1ms gap so WebSocket has time to send data without lagging
            setTimeout(runSimulation, 1);
        }
    }

    // 60fps status broadcast loop
    let lastLog = '';
    const _statusInterval = setInterval(() => {
        if (running && cpu) {
            ws.send(JSON.stringify({ type: 'state', pins: pinStates }));

            // Debugging pin D13 output specifically
            const currentLog = `Pin D13 is: ${pinStates['D13']}`;
            if (currentLog !== lastLog) {
                console.log(currentLog);
                lastLog = currentLog;
            }
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

                // Set up ALL hardware timers for delay() and millis() to work
                timers = [
                    new AVRTimer(cpu, timer0Config),
                    new AVRTimer(cpu, timer1Config),
                    new AVRTimer(cpu, timer2Config)
                ];

                // Listen to PORTB (D8-D13) and PORTD (D0-D7), PORTC (A0-A5)
                // Let's attach a catch-all listener for simplicty.
                // In avr8js, pins are mapped to CPU memory locations.
                // PortB is 0x23 (PINB), 0x24 (DDRB), 0x25 (PORTB)
                // PortC is 0x26 (PINC), 0x27 (DDRC), 0x28 (PORTC)
                // PortD is 0x29 (PIND), 0x2A (DDRD), 0x2B (PORTD)

                // Simplified pin mapping tracker
                cpu.writeHooks[0x24] = (val) => { /* DDRB updated */ return false; };
                cpu.writeHooks[0x25] = (val) => {
                    // PORTB updated
                    pinStates['D8'] = (val & (1 << 0)) ? true : false;
                    pinStates['D9'] = (val & (1 << 1)) ? true : false;
                    pinStates['D10'] = (val & (1 << 2)) ? true : false;
                    pinStates['D11'] = (val & (1 << 3)) ? true : false;
                    pinStates['D12'] = (val & (1 << 4)) ? true : false;
                    pinStates['D13'] = (val & (1 << 5)) ? true : false;
                    return false;
                };

                cpu.writeHooks[0x2A] = (val) => { /* DDRD updated */ return false; };
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
                    return false;
                };

                cpu.writeHooks[0x27] = (val) => { /* DDRC updated */ return false; };
                cpu.writeHooks[0x28] = (val) => {
                    // PORTC updated
                    pinStates['A0'] = (val & (1 << 0)) ? true : false;
                    pinStates['A1'] = (val & (1 << 1)) ? true : false;
                    pinStates['A2'] = (val & (1 << 2)) ? true : false;
                    pinStates['A3'] = (val & (1 << 3)) ? true : false;
                    pinStates['A4'] = (val & (1 << 4)) ? true : false;
                    pinStates['A5'] = (val & (1 << 5)) ? true : false;
                    return false;
                };

                running = true;
                lastTime = Date.now();
                setTimeout(runSimulation, 1);

            } else if (data.type === 'STOP') {
                console.log('Stopping simulation for client');
                running = false;
                cpu = null;
                timers = [];
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
