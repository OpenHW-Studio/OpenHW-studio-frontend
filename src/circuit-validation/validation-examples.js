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

const PUSHBUTTON_PINS = [
    { id: '1l', type: 'input' },
    { id: '2l', type: 'input' },
];

const POWER_SUPPLY_PINS = [
    { id: '5V', type: 'power' },
    { id: 'gnd', type: 'power' },
];

export function formatValidationError(error) {
    if (typeof error === 'string') return error;
    if (!error) return '';
    return error.message || error.text || JSON.stringify(error);
}

function makeUno(id) {
    return { id, type: 'wokwi-arduino-uno', pins: UNO_PINS };
}

function makeLed(id) {
    return { id, type: 'wokwi-led', pins: LED_PINS };
}

function makeResistor(id, value = '220') {
    return { id, type: 'wokwi-resistor', pins: RES_PINS, attrs: { value } };
}

function makePowerSupply(id, voltage = 5) {
    return { id, type: 'wokwi-power-supply', pins: POWER_SUPPLY_PINS, attrs: { voltage } };
}

function makePushbutton(id) {
    return { id, type: 'wokwi-pushbutton', pins: PUSHBUTTON_PINS };
}

function makeDemoSensor(id, severity = 'warn') {
    return {
        id,
        type: 'demo-sensor',
        pins: [
            { id: 'VIN', type: 'power' },
            { id: 'GND', type: 'power' },
        ],
        validation: {
            rules: [
                {
                    id: 'demo-sensor-vin',
                    severity,
                    priority: 10,
                    description: 'Demo sensor VIN must stay below 3.6 V',
                    check(component, _graph, validator) {
                        const vin = validator.calculateVoltageAtNode(`${component.id}.VIN`);

                        if (vin === null || vin === undefined) {
                            return {
                                id: 'demo-sensor-vin-missing',
                                ruleId: 'demo-sensor-vin',
                                severity: 'error',
                                message: 'Demo sensor VIN is not connected.',
                                compIds: [component.id],
                                remediation: 'Wire VIN to a valid supply.',
                            };
                        }

                        if (vin > 3.6) {
                            return {
                                id: 'demo-sensor-vin-high',
                                ruleId: 'demo-sensor-vin',
                                severity,
                                message: `Demo sensor VIN is ${vin.toFixed(2)} V. Maximum allowed is 3.6 V.`,
                                compIds: [component.id],
                                remediation: 'Use a 3.3 V supply or add level shifting.',
                            };
                        }

                        return null;
                    },
                },
            ],
        },
    };
}

function makeDemoSensorProject(severity = 'warn', supplyVoltage = 5) {
    return {
        components: [
            makePowerSupply('ps_demo', supplyVoltage),
            makeDemoSensor('demo_1', severity),
        ],
        connections: [
            { from: 'ps_demo.5V', to: 'demo_1.VIN' },
            { from: 'ps_demo.gnd', to: 'demo_1.GND' },
        ],
    };
}

function makeVoltageDividerProject() {
    return {
        components: [
            makePowerSupply('ps_divider', 5),
            makeResistor('r_top', '1000'),
            makeResistor('r_bottom', '1000'),
        ],
        connections: [
            { from: 'ps_divider.5V', to: 'r_top.p1' },
            { from: 'r_top.p2', to: 'r_bottom.p1' },
            { from: 'r_bottom.p2', to: 'ps_divider.gnd' },
        ],
    };
}

export const validationCases = [
    {
        name: 'invalid_led_between_gpio_pins',
        expectPass: false,
        expectMessageIncludes: 'Unsupported pin-to-pin drive',
        project: {
            components: [
                makeUno('wokwi-arduino-uno_2'),
                makeLed('wokwi-led_4'),
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
                makeUno('uno_1'),
                makeResistor('r1'),
                makeLed('led_1'),
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
                makeUno('uno_short'),
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
                makeUno('uno_serial'),
                makeLed('led_serial'),
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
                makeUno('uno_f'),
                makeLed('led_f'),
            ],
            connections: [
                { from: 'uno_f.13', to: 'led_f.A' },
            ],
        },
    },
    {
        name: 'component_validation_warns_but_passes',
        expectPass: true,
        expectMessageIncludes: 'Demo sensor VIN is 5.00 V',
        expectSeverity: 'warn',
        expectRuleId: 'demo-sensor-vin',
        project: makeDemoSensorProject('warn', 5),
    },
    {
        name: 'component_validation_blocks_overvoltage',
        expectPass: false,
        expectMessageIncludes: 'Demo sensor VIN is 5.00 V',
        expectSeverity: 'error',
        expectRuleId: 'demo-sensor-vin',
        project: makeDemoSensorProject('error', 5),
    },
    {
        name: 'resistive_divider_midpoint',
        expectPass: true,
        expectVoltageNode: 'r_top.p2',
        expectVoltageRange: [2.2, 2.8],
        project: makeVoltageDividerProject(),
    },
    {
        name: 'pushbutton_isolated_warning',
        expectPass: true,
        expectMessageIncludes: 'Button is completely disconnected',
        project: {
            components: [
                {
                    id: 'pb_1',
                    type: 'wokwi-pushbutton',
                    pins: PUSHBUTTON_PINS,
                    validation: {
                        rules: [
                            {
                                id: 'pushbutton-floating',
                                severity: 'warn',
                                priority: 1,
                                check(component, graph) {
                                    const p1 = graph.get(`${component.id}.1l`);
                                    const p2 = graph.get(`${component.id}.2l`);

                                    if ((!p1 || p1.length === 0) && (!p2 || p2.length === 0)) {
                                        return {
                                            id: 'pushbutton-floating',
                                            ruleId: 'pushbutton-floating',
                                            severity: 'warn',
                                            message: 'Button is completely disconnected.',
                                            compIds: [component.id],
                                            remediation: 'Wire the switch into a circuit.',
                                        };
                                    }

                                    return null;
                                },
                            },
                        ],
                    },
                },
            ],
            connections: [],
        },
    },
    {
        name: 'mixed_rail_conflict_detected',
        expectPass: false,
        expectMessageIncludes: 'Mixed-rail hard tie detected',
        project: {
            components: [
                makeUno('uno_conflict'),
            ],
            connections: [
                { from: 'uno_conflict.5V', to: 'uno_conflict.3v3' },
            ],
        },
    },
];
