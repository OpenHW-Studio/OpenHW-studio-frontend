import { FullCircuitValidator } from './engine.js';

const UNO_PINS = [
    { id: '13', type: 'digital' },
    { id: '10', type: 'digital' },
    { id: 'A4', type: 'analog' },
    { id: 'A5', type: 'analog' },
    { id: '5V', type: 'power' },
    { id: '3v3', type: 'power' },
    { id: 'vin', type: 'power' },
    { id: 'gnd', type: 'power' },
    { id: 'gnd_1', type: 'power' },
    { id: 'gnd_2', type: 'power' },
    { id: 'gnd_3', type: 'power' },
];

const LED_PINS = [
    { id: 'A', type: 'input' },
    { id: 'K', type: 'input' },
];

const RES_PINS = [
    { id: 'p1', type: 'passive' },
    { id: 'p2', type: 'passive' },
];

function runCase(testCase) {
    const validator = new FullCircuitValidator(testCase.project);
    const passed = validator.runValidation();
    return {
        passed,
        errors: validator.errors,
    };
}

const cases = [
    {
        name: 'invalid_led_between_gpio_pins',
        expectPass: false,
        expectMessageIncludes: 'Unsupported pin-to-pin drive',
        project: {
            components: [
                { id: 'wokwi-arduino-uno_2', type: 'wokwi-arduino-uno', pins: UNO_PINS },
                { id: 'wokwi-led_4', type: 'wokwi-led', pins: LED_PINS },
            ],
            connections: [
                { from: 'wokwi-arduino-uno_2.13', to: 'wokwi-led_4.A' },
                { from: 'wokwi-led_4.K', to: 'wokwi-arduino-uno_2.10' },
            ],
        },
    },
    {
        name: 'valid_led_with_series_resistor_to_ground',
        expectPass: true,
        project: {
            components: [
                { id: 'uno_1', type: 'wokwi-arduino-uno', pins: UNO_PINS },
                { id: 'r1', type: 'wokwi-resistor', pins: RES_PINS, attrs: { value: '220' } },
                { id: 'led_1', type: 'wokwi-led', pins: LED_PINS },
            ],
            connections: [
                { from: 'uno_1.13', to: 'r1.p1' },
                { from: 'r1.p2', to: 'led_1.A' },
                { from: 'led_1.K', to: 'uno_1.gnd' },
            ],
        },
    },
    {
        name: 'fatal_short_vcc_to_gnd',
        expectPass: false,
        expectMessageIncludes: 'FATAL SHORT CIRCUIT',
        project: {
            components: [
                { id: 'uno_short', type: 'wokwi-arduino-uno', pins: UNO_PINS },
            ],
            connections: [
                { from: 'uno_short.5V', to: 'uno_short.gnd' },
            ],
        },
    },
    {
        name: 'serial_pin_conflict_d0',
        expectPass: false,
        expectMessageIncludes: 'Serial USB communication',
        project: {
            components: [
                { id: 'uno_serial', type: 'wokwi-arduino-uno', pins: UNO_PINS },
                { id: 'led_serial', type: 'wokwi-led', pins: LED_PINS },
            ],
            connections: [
                { from: 'uno_serial.0', to: 'led_serial.A' },
            ],
        },
    },
    {
        name: 'led_floating_cathode',
        expectPass: false,
        expectMessageIncludes: 'Cathode (K) is floating',
        project: {
            components: [
                { id: 'uno_f', type: 'wokwi-arduino-uno', pins: UNO_PINS },
                { id: 'led_f', type: 'wokwi-led', pins: LED_PINS },
            ],
            connections: [
                { from: 'uno_f.13', to: 'led_f.A' },
            ],
        },
    },
    {
        name: 'rp2040_overvoltage_5v',
        expectPass: false,
        expectMessageIncludes: 'exceeds 3.3V logic limit',
        project: {
            components: [
                { id: 'pico_1', type: 'wokwi-raspberry-pi-pico', pins: [{ id: 'GP0', type: 'digital' }, { id: 'VBUS', type: 'power' }] },
                { id: 'uno_1', type: 'wokwi-arduino-uno', pins: [{ id: '5V', type: 'power' }] },
            ],
            connections: [
                { from: 'uno_1.5V', to: 'pico_1.GP0' },
            ],
        },
    },
];

let failedCount = 0;

console.log('\\n[smoke] Circuit validation smoke tests');

cases.forEach((testCase) => {
    const result = runCase(testCase);
    const passMatches = result.passed === testCase.expectPass;
    const messageMatches =
        !testCase.expectMessageIncludes
            ? true
            : result.errors.some(err => String(err).includes(testCase.expectMessageIncludes));

    const ok = passMatches && messageMatches;
    if (!ok) {
        failedCount += 1;
    }

    console.log(`\\n- ${testCase.name}: ${ok ? 'PASS' : 'FAIL'}`);
    console.log(`  expected pass: ${testCase.expectPass}, actual: ${result.passed}`);
    if (testCase.expectMessageIncludes) {
        console.log(`  expected message contains: "${testCase.expectMessageIncludes}"`);
    }
    if (result.errors.length) {
        result.errors.forEach(err => console.log(`  error: ${err}`));
    }
});

if (failedCount > 0) {
    console.error(`\\n[smoke] ${failedCount} case(s) failed.`);
    process.exit(1);
}

console.log('\\n[smoke] All smoke cases passed.');
