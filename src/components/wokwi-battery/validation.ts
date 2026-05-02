export const validation = {
    rules: [
        {
            name: 'Check Battery Short Circuit',
            check: (comp, graph, validator) => {
                const vccNode = `${comp.id}.VCC`;
                const gndNode = `${comp.id}.GND`;
                if (validator.findResistanceBetween(vccNode, gndNode) < 1.0) {
                    return `🔥 [Battery ${comp.id}] Dead short detected! Battery will overheat and catch fire.`;
                }
                return null;
            }
        }
    ]
};
