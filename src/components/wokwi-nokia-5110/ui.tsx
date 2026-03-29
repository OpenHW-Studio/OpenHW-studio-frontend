import React, { useMemo } from 'react';

export const Nokia5110UI = ({ state, attrs }: { state: any, attrs: any }) => {

    const pathD = useMemo(() => {
        if (!state?.fbStr || state.fbStr.length !== 1008) return "";
        let d = "";
        for (let y = 0; y < 6; y++) {
            for (let x = 0; x < 84; x++) {
                const idx = y * 84 + x;
                const byte = parseInt(state.fbStr.substring(idx * 2, idx * 2 + 2), 16);
                for (let bit = 0; bit < 8; bit++) {
                    if (byte & (1 << bit)) {
                        const py = y * 8 + bit;
                        d += `M ${x * 0.5} ${py * 0.5} h 0.5 v 0.5 h -0.5 Z `;
                    }
                }
            }
        }
        return d;
    }, [state?.fbStr]);

    return (
        <svg width="50" height="50" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <rect width="50" height="50" fill="#c0392b" rx="2" />

            <rect x="2" y="2" width="46" height="38" fill="#bdc3c7" />
            <rect x="4" y="4" width="42" height="34" fill="#95a5a6" />

            {/* LCD Screen bounds: 84 * 0.5 = 42 width, 48 * 0.5 = 24 height */}
            <rect x="4" y="9" width="42" height="24" fill="#8da988" />

            <g transform="translate(4, 9)">
                <path d={pathD} fill="#111" />
            </g>

            {/* Pins */}
            {['RST', 'CE', 'DC', 'DIN', 'CLK', 'VCC', 'LIGHT', 'GND'].map((l, i) => (
                <g key={l}>
                    <circle cx={5 + i * 5} cy="48" r="1.5" fill="#f1c40f" />
                    <text x={5 + i * 5} y="45" fontSize="1.5" fill="white" textAnchor="middle">{l}</text>
                </g>
            ))}
        </svg>
    );
};
