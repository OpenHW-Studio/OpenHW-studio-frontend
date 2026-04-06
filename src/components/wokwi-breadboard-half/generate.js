import fs from 'fs';

const PITCH = 15;
const START_X = 30;
const START_Y = 20;

const pins = [];

// 1. Top Power Rails
for (let i = 0; i < 25; i++) {
    const group = Math.floor(i / 5);
    const inGroup = i % 5;
    const xBase = START_X + group * PITCH * 6 + inGroup * PITCH;

    pins.push({ id: `top_gnd_${i + 1}`, x: xBase, y: START_Y, type: 'power' });
    pins.push({ id: `top_vcc_${i + 1}`, x: xBase, y: START_Y + PITCH, type: 'power' });
}

// 2. Terminal Strips (Cols 1-30)
for (let col = 1; col <= 30; col++) {
    const xBase = START_X + (col - 1) * PITCH;
    ['e', 'd', 'c', 'b', 'a'].forEach((rowLabel, j) => {
        pins.push({ id: `${col}${rowLabel}`, x: xBase, y: START_Y + PITCH * 3 + j * PITCH, type: 'digital' });
    });

    ['f', 'g', 'h', 'i', 'j'].forEach((rowLabel, j) => {
        pins.push({ id: `${col}${rowLabel}`, x: xBase, y: START_Y + PITCH * 10 + j * PITCH, type: 'digital' });
    });
}

// 3. Bottom Power Rails
for (let i = 0; i < 25; i++) {
    const group = Math.floor(i / 5);
    const inGroup = i % 5;
    const xBase = START_X + group * PITCH * 6 + inGroup * PITCH;

    pins.push({ id: `bottom_vcc_${i + 1}`, x: xBase, y: START_Y + PITCH * 16, type: 'power' });
    pins.push({ id: `bottom_gnd_${i + 1}`, x: xBase, y: START_Y + PITCH * 17, type: 'power' });
}

const w = START_X * 2 + 29 * PITCH;
const h = START_Y * 2 + 17 * PITCH;

const manifest = {
    type: "wokwi-breadboard-half",
    label: "Breadboard (Half)",
    group: "Basic",
    w: w,
    h: h,
    attrs: {},
    pins: pins
};

fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));

console.log('Generated half breadboard manifest.json with ' + pins.length + ' pins.');
