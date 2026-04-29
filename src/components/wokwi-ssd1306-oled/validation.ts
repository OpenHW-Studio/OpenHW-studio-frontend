export const validation = {
  rules: [
    {
      id: "oled-power-check",
      check(comp: any, graph: any, validator: any) {
        const vccVoltage = validator.calculateVoltageAtNode(comp.pins.VCC);
        const gndVoltage = validator.calculateVoltageAtNode(comp.pins.GND);
        
        const vDiff = vccVoltage - gndVoltage;

        if (vDiff < 3.0 && vDiff > 0) {
          return { type: 'warning', message: `${comp.label}: Voltage is too low. Requires at least 3.3V.` };
        }
        if (vDiff > 5.5) {
          return { type: 'error', message: `${comp.label}: Overvoltage! Maximum is 5.5V.` };
        }
        if (vDiff < -0.5) {
          return { type: 'error', message: `${comp.label}: Reverse polarity detected!` };
        }
        return null; // Passes validation
      }
    }
  ]
};