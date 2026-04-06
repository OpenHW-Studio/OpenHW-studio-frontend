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
        <svg width="60" height="72" viewBox="0 0 60 72" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="metalFrame" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ecf0f1" />
                    <stop offset="50%" stopColor="#bdc3c7" />
                    <stop offset="100%" stopColor="#95a5a6" />
                </linearGradient>
            </defs>

            {/* PCB Board */}
            <rect width="60" height="72" fill="#a03020" rx="1.5" />

            {/* Mounting Holes */}
            <circle cx="4" cy="4" r="2.5" fill="white" opacity="0.9" />
            <circle cx="56" cy="4" r="2.5" fill="white" opacity="0.9" />
            <circle cx="4" cy="68" r="2.5" fill="white" opacity="0.9" />
            <circle cx="56" cy="68" r="2.5" fill="white" opacity="0.9" />

            {/* Top Pin Area */}
            <g transform="translate(14, 2)">
                <text x="-4" y="5" fill="white" fontSize="4" fontWeight="bold">1</text>
                {[...Array(8)].map((_, i) => (
                    <circle key={i} cx={i * 4.5} cy="4" r="2" fill="#444" stroke="#888" strokeWidth="0.5" />
                ))}
                <text x="36" y="5" fill="white" fontSize="4" fontWeight="bold">8</text>
                <text x="42" y="5" fill="white" fontSize="5" fontWeight="bold">↑</text>
            </g>

            {/* Bottom Pin Area (Functional & Decorative) */}
            <g transform="translate(14, 66)">
                <text x="-4" y="5" fill="white" fontSize="4" fontWeight="bold">1</text>
                {['VCC', 'GND', 'SCE', 'RST', 'DC', 'DN', 'SCLK', 'LED'].map((l, i) => (
                    <g key={l}>
                        <circle cx={i * 4.5} cy="4" r="2" fill="#444" stroke="#f1c40f" strokeWidth="0.8" />
                        <text x={i * 4.5} y="1.5" fontSize="1.5" fill="white" textAnchor="middle">{l}</text>
                    </g>
                ))}
                <text x="36" y="5" fill="white" fontSize="4" fontWeight="bold">8</text>
            </g>

            {/* Metal Frame */}
            <rect x="3" y="10" width="54" height="54" fill="#bdc3c7" rx="1" />
            <rect x="5" y="12" width="50" height="50" fill="url(#metalFrame)" rx="0.5" stroke="#7f8c8d" strokeWidth="0.3" />

            {/* Glass/LCD Screen Inner Area */}
            <rect x="7" y="18" width="46" height="38" fill="#333" rx="4" /> {/* Dark border */}
            <rect x="8" y="19" width="44" height="36" fill="#8da988" rx="3.5" /> {/* Greenish LCD */}

            {/* Pixel Content */}
            {/* Original content was 84x48 pixels. Each pixel was 0.5 units. 
                New LCD area is 44x36. Scale factor: 44/42 ~= 1.04. 
                We'll use a translation to center the original 42x24 content or scale it.
            */}
            <g transform="translate(9, 25) scale(1.04)">
                <path d={pathD} fill="#111" />
            </g>
        </svg>
    );
};
