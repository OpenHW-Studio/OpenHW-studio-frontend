export const validation = {
    rules: [
        {
            id: 'max30102-vin-voltage',
            description: 'VIN must be connected to a 1.8 V – 3.3 V supply',
            check(comp: any, _graph: any, validator: any) {
                const v = validator.calculateVoltageAtNode(`${comp.id}-VIN`);
                if (v === undefined || v === null) {
                    return {
                        severity: 'error',
                        message:  'MAX30102 VIN is not connected to a power source.',
                    };
                }
                if (v > 3.6) {
                    return {
                        severity: 'error',
                        message: `MAX30102 VIN is ${v.toFixed(2)} V. Maximum rated voltage is 3.6 V — the IC may be damaged.`,
                    };
                }
                if (v < 1.7) {
                    return {
                        severity: 'warning',
                        message: `MAX30102 VIN is ${v.toFixed(2)} V. The chip requires at least 1.8 V to operate.`,
                    };
                }
                return null;
            },
        },
        {
            id: 'max30102-gnd-connected',
            description: 'GND must be connected to ground (0 V)',
            check(comp: any, _graph: any, validator: any) {
                const v = validator.calculateVoltageAtNode(`${comp.id}-GND`);
                if (v === undefined || v === null) {
                    return {
                        severity: 'error',
                        message:  'MAX30102 GND pin is not connected.',
                    };
                }
                if (v > 0.1) {
                    return {
                        severity: 'error',
                        message:  `MAX30102 GND pin is at ${v.toFixed(2)} V instead of 0 V — check your ground connection.`,
                    };
                }
                return null;
            },
        },
        {
            id: 'max30102-i2c-pullups',
            description: 'SDA and SCL require pull-up resistors for reliable I2C communication',
            check(comp: any, _graph: any, validator: any) {
                const sclR = validator.findSeriesResistance(`${comp.id}-SCL`);
                const sdaR = validator.findSeriesResistance(`${comp.id}-SDA`);

                if (sclR === 0 && sdaR === 0) {
                    // Both are directly driven – no pull-up visible; only warn if unconnected
                    return null;
                }
                if (sclR > 10_000 || sdaR > 10_000) {
                    return {
                        severity: 'warning',
                        message:  `MAX30102 I2C pull-up resistance is high (SCL: ${sclR} Ω, SDA: ${sdaR} Ω). Recommended range is 1 kΩ – 10 kΩ.`,
                    };
                }
                return null;
            },
        },
        {
            id: 'max30102-5v-i2c',
            description: 'SDA / SCL lines must not exceed VIO (3.3 V default)',
            check(comp: any, _graph: any, validator: any) {
                const sclV = validator.calculateVoltageAtNode(`${comp.id}-SCL`);
                const sdaV = validator.calculateVoltageAtNode(`${comp.id}-SDA`);
                const max  = 3.6;

                if ((sclV && sclV > max) || (sdaV && sdaV > max)) {
                    return {
                        severity: 'error',
                        message:  `MAX30102 I2C pins are driven at 5 V logic. The chip's I/O is not 5 V tolerant — add a level-shifter.`,
                    };
                }
                return null;
            },
        },
    ],
};
