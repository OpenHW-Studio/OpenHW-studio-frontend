const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8085');

ws.on('open', function open() {
    console.log('Connected to emulator.');

    // This is a compiled hex of a script that manually bit-bangs D9 HIGH for 1500us and LOW.
    // We use this to test if our `processServoWrite` logic even works WITHOUT the Servo.h Timer dependency.
    const hex = `
:100000000C9434000C9446000C9446000C9446006C
:100010000C9446000C9446000C9446000C9446004C
:100020000C9446000C9446000C9446000C9446003C
:100030000C9446000C9446000C9446000C9446002C
:100040000C9446000C9446000C9446000C9446001C
:100050000C9446000C9446000C9446000C9446000C
:100060000C9446000C94460011241FBECFEFD8E0DE
:10007000DEBFCDBF11E0A0E0B1E001C01D92A230E3
:10008000B107E1F710E0CE010190F081E08102C08A
:1000900005900D92A030B107E1F70E945D000C941D
:1000A00064000C940000259A2D9A259808952D9A2E
:1000B000259A88EE93E021E0815090402040E1F790
:1000C00000C00000259880EE9EE824E081509040C0
:1000D0002040E1F700C000000895F894FFCF000072
:00000001FF
`;

    const payload = {
        type: 'START',
        hex: hex,
        neopixels: [],
        servos: [
            { compId: 'servo1', pin: 'D9' }
        ]
    };

    ws.send(JSON.stringify(payload));
    console.log('Sending manual bit-bang PWM payload...');
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
}, 3000);
