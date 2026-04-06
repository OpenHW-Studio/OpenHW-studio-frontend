export const validation = {
  rules: [
    {
      name: 'RP2040 Power Input Check',
      check: (component: any, graph: Map<string, string[]>, validator: any) => {
        const vbusVolts = validator?.calculateVoltageAtNode(`${component.id}.VBUS`) || 0;
        const v3Volts = validator?.calculateVoltageAtNode(`${component.id}.3V3`) || 0;

        if (vbusVolts > 5.5) {
          return `FRIED [Pico ${component.id}]: ${vbusVolts}V applied to VBUS. Max expected is 5V USB input.`;
        }

        if (v3Volts > 3.6) {
          return `FRIED [Pico ${component.id}]: ${v3Volts}V applied to 3V3 rail.`;
        }

        return null;
      },
    },
  ],
};
