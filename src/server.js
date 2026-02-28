import { WebSocketServer } from 'ws';
import { CPU, AVRTimer, avrInstruction, timer0Config, timer1Config, timer2Config } from 'avr8js';
import intelHex from 'intel-hex';
const { parse } = intelHex;
import connectDB from './connectDB.js';

connectDB();

const wss = new WebSocketServer({ port: 8085 });

console.log('Universal Emulator WebSocket Server running on port 8085');

// Helper to run instructions
const MHZ = 16e6;

// ─── NeoPixel WS2812 Protocol Helpers ─────────────────────────────────────────

// Map Arduino pin name (e.g. 'D6') to AVR port address and bit mask
function getPinPortMapping(pinName) {
    const PORTD_ADDR = 0x2B; // D0-D7
    const PORTB_ADDR = 0x25; // D8-D13
    const match = pinName.match(/^D(\d+)$/);
    if (!match) return null;
    const num = parseInt(match[1]);
    if (num <= 7) {
        return { portAddr: PORTD_ADDR, bitMask: (1 << num), bitIndex: num };
    } else if (num <= 13) {
        return { portAddr: PORTB_ADDR, bitMask: (1 << (num - 8)), bitIndex: num - 8 };
    }
    return null;
}

// WS2812 timing thresholds (in CPU cycles at 16MHz)
// Bit 1: HIGH for ~800ns (~12.8 cycles), LOW for ~450ns (~7.2 cycles)
// Bit 0: HIGH for ~400ns (~6.4 cycles),  LOW for ~850ns (~13.6 cycles)
// We use ~10 cycles as the threshold to distinguish 0 vs 1
const WS2812_BIT_THRESHOLD = 10; // cycles — HIGH longer than this = bit 1
const WS2812_RESET_THRESHOLD = 800; // cycles — LOW longer than this = reset (50µs)

wss.on('connection', (ws) => {
    console.log('Client connected');

    let cpu = null;
    let timers = [];
    let running = false;
    let pinStates = {};

    // NeoPixel state
    let neopixelConfigs = [];    // [{ compId, pin, rows, cols, portAddr, bitMask }]
    let neopixelDecoders = {};   // keyed by pin name: { lastCycle, highCycles, currentByte, bitCount, pixelBuffer, lastVal }
    let neopixelState = {};      // keyed by compId: [[row, col, {r,g,b}], ...]

    // ── WS2812 Bit-Bang Decoder ──────────────────────────────────────────────
    // Called from port write hooks. Detects NeoPixel data pin transitions and
    // decodes timed HIGH pulses into GRB color bytes.
    function processNeopixelWrite(portAddr, val) {
        if (neopixelConfigs.length === 0 || !cpu) return;

        for (const config of neopixelConfigs) {
            if (config.portAddr !== portAddr) continue;

            const decoder = neopixelDecoders[config.pin];
            if (!decoder) continue;

            const pinHigh = (val & config.bitMask) !== 0;
            const currentCycle = cpu.cycles;

            if (pinHigh && !decoder.lastVal) {
                // LOW → HIGH transition (rising edge)
                // Check if LOW period was long enough for a reset
                if (decoder.lastCycle > 0) {
                    const lowDuration = currentCycle - decoder.lastCycle;
                    if (lowDuration > WS2812_RESET_THRESHOLD && decoder.pixelBuffer.length > 0) {
                        // Reset detected — flush pixel buffer to state
                        flushNeopixelBuffer(config, decoder);
                    }
                }
                decoder.lastCycle = currentCycle;
            } else if (!pinHigh && decoder.lastVal) {
                // HIGH → LOW transition (falling edge)
                // Duration of HIGH determines bit value
                const highDuration = currentCycle - decoder.lastCycle;
                const bit = highDuration > WS2812_BIT_THRESHOLD ? 1 : 0;

                decoder.currentBits.push(bit);

                // Every 8 bits = 1 byte (GRB order)
                if (decoder.currentBits.length === 8) {
                    let byteVal = 0;
                    for (let i = 0; i < 8; i++) {
                        byteVal = (byteVal << 1) | decoder.currentBits[i];
                    }
                    decoder.pixelBuffer.push(byteVal);
                    decoder.currentBits = [];
                }

                decoder.lastCycle = currentCycle;
            }

            decoder.lastVal = pinHigh;
        }
    }

    // Convert GRB byte buffer to RGB pixel array and store in neopixelState
    function flushNeopixelBuffer(config, decoder) {
        const pixels = [];
        const { rows, cols } = config;
        const totalPixels = rows * cols;

        // Every 3 bytes = 1 pixel in GRB order
        for (let i = 0; i + 2 < decoder.pixelBuffer.length && i / 3 < totalPixels; i += 3) {
            const g = decoder.pixelBuffer[i];
            const r = decoder.pixelBuffer[i + 1];
            const b = decoder.pixelBuffer[i + 2];
            const pixelIndex = i / 3;
            const row = Math.floor(pixelIndex / cols);
            const col = pixelIndex % cols;
            // setPixel expects floats 0.0-1.0
            pixels.push([row, col, { r: r / 255, g: g / 255, b: b / 255 }]);
        }

        if (pixels.length > 0) {
            neopixelState[config.compId] = pixels;
        }

        // Reset decoder for next frame
        decoder.pixelBuffer = [];
        decoder.currentBits = [];
    }

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
    let lastPinStates = {};
    const _statusInterval = setInterval(() => {
        if (running && cpu) {
            const msg = { type: 'state', pins: pinStates };

            // Include neopixel data if any has been decoded
            if (Object.keys(neopixelState).length > 0) {
                msg.neopixels = neopixelState;
                // Clear after sending so we only send changes
                neopixelState = {};
            }

            ws.send(JSON.stringify(msg));

            // Dynamic pin state logging
            for (const pin in pinStates) {
                if (pinStates[pin] !== lastPinStates[pin]) {
                    console.log(`Pin ${pin} is: ${pinStates[pin]}`);
                    lastPinStates[pin] = pinStates[pin];
                }
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

                // ── Setup NeoPixel decoders from wiring info ──────────────
                neopixelConfigs = [];
                neopixelDecoders = {};
                neopixelState = {};

                if (data.neopixels && data.neopixels.length > 0) {
                    console.log('NeoPixel configs received:', data.neopixels);
                    for (const np of data.neopixels) {
                        // Map Arduino pin name to port address and bit mask
                        const pinMap = getPinPortMapping(np.pin);
                        if (pinMap) {
                            neopixelConfigs.push({
                                ...np,
                                portAddr: pinMap.portAddr,
                                bitMask: pinMap.bitMask,
                            });
                            neopixelDecoders[np.pin] = {
                                lastCycle: 0,
                                highCycles: 0,
                                currentBits: [],
                                pixelBuffer: [],
                                lastVal: 0,
                                totalPixels: np.rows * np.cols,
                            };
                            console.log(`NeoPixel decoder setup for pin ${np.pin} (${np.rows}x${np.cols})`);
                        }
                    }
                }

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
                    // Check for NeoPixel bit-bang on PORTB pins
                    processNeopixelWrite(0x25, val);
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
                    // Check for NeoPixel bit-bang on PORTD pins
                    processNeopixelWrite(0x2B, val);
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
                neopixelConfigs = [];
                neopixelDecoders = {};
                neopixelState = {};
            }
        } catch (err) {
            console.error('WebSocket msg error:', err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        running = false;
        cpu = null;
        timers = [];
        clearInterval(_statusInterval);
    });
});
