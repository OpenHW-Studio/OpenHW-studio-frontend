export const validation = {
    rules: [
        {
            name: 'Check Charger Input Voltage',
            check: (comp, graph, validator) => {
                const vinNode = `${comp.id}.IN+`;
                const v = validator.calculateVoltageAtNode(vinNode);
                if (v > 6.0) {
                    return `🔥 [Charger ${comp.id}] Input voltage ${v.toFixed(1)}V exceeds 6V limit! Chip will be damaged.`;
                }
                return null;
            }
        }
    ]
};
