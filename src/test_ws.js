const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8085');

ws.on('open', function open() {
    console.log('Connected to emulator.');

    // A simple Arduino hex that sweeps a servo on D9
    // (Assuming we already compiled it on the frontend and got the hex)
    // Instead of a full hex, we'll just test the WebSocket payload parsing
    const payload = {
        type: 'START',
        hex: ':100000000C945C000C946E000C946E000C946E00CA\n:00000001FF', // dummy hex
        neopixels: [],
        servos: [
            { compId: 'servo1', pin: 'D9' }
        ]
    };

    ws.send(JSON.stringify(payload));
    console.log('START payload sent with servo on D9.');
});

ws.on('message', function incoming(data) {
    const msg = JSON.parse(data);
    if (msg.servos) {
        console.log('Received Servo State Update:', msg.servos);
    }
});

setTimeout(() => {
    console.log('Test finished.');
    process.exit(0);
}, 5000);
