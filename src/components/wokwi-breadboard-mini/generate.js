import fs from 'fs';

const PITCH = 15;
const START_X = 15;
const START_Y = 15;

const pins = [];

// Terminal Strips (Cols 1-17, no power rails)
for (let col = 1; col <= 17; col++) {
    const xBase = START_X + (col - 1) * PITCH;
    ['e', 'd', 'c', 'b', 'a'].forEach((rowLabel, j) => {
        pins.push({ id: `${col}${rowLabel}`, x: xBase, y: START_Y + j * PITCH, type: 'digital' });
    });

    ['f', 'g', 'h', 'i', 'j'].forEach((rowLabel, j) => {
        // Gap of 2 pitches between 'a' and 'f' is standard (1.5 visually but logically 2 in grid)
        // Previous breadboards use a gap of 2*pitch. 
        // full breadboard 'a' row was START_Y+PITCH*3+4*PITCH = offset 7.
        // 'f' row was START_Y+PITCH*10 = offset 10. The gap was 10 - 7 = 3 pitches. 
        // Wait, 'a' is at index 4 (j=4): START_Y + 3*PITCH + 4*PITCH = 7*PITCH.
        // 'f' is at index 0 (j=0): START_Y + 10*PITCH. Gap = 3*PITCH.
        pins.push({ id: `${col}${rowLabel}`, x: xBase, y: START_Y + PITCH * 7 + j * PITCH, type: 'digital' });
    });
}

const w = START_X * 2 + 16 * PITCH;
const h = START_Y * 2 + 11 * PITCH;

const manifest = {
    type: "wokwi-breadboard-mini",
    label: "Breadboard (Mini)",
    group: "Basic",
    w: w,
    h: h,
    attrs: {},
    pins: pins
};

fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));

console.log('Generated mini breadboard manifest.json with ' + pins.length + ' pins.');
