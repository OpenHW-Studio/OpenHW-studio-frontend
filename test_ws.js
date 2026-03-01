const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8085');

ws.on('open', () => {
    console.log('Connected, sending start hex...');
    ws.send(JSON.stringify({
        type: 'START',
        hex: ':100000000C945C000C946E000C946E000C946E00CA\n:00000001FF'
    }));
});

ws.on('close', () => console.log('Disconnected.'));
ws.on('error', (e) => console.log('Error:', e));
