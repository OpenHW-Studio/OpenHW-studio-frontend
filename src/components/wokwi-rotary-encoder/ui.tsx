import React from 'react';

export const RotaryEncoderUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const rot = state?.rot || 0;
    const pressed = state?.sw || false;

    return (
        <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="50" fill="#34495e" rx="4" />
            <circle cx="20" cy="25" r="16" fill="#bdc3c7" />

            <g transform={`rotate(${rot}, 20, 25)`}>
                <circle cx="20" cy="25" r="14" fill={pressed ? "#95a5a6" : "#ecf0f1"} />
                {/* Grip marks */}
                {Array.from({ length: 12 }).map((_, i) => (
                    <line key={i} x1="20" y1="12" x2="20" y2="15" stroke="#7f8c8d" strokeWidth="1.5" transform={`rotate(${i * 30}, 20, 25)`} />
                ))}
            </g>

            {/* Pins */}
            {['CLK', 'DT', 'SW', 'VCC', 'GND'].map((l, i) => (
                <g key={l}>
                    <circle cx="5" cy={10 + i * 10} r="2" fill="#ecf0f1" />
                    <text x="9" y={11 + i * 10} fontSize="3" fill="white">{l}</text>
                </g>
            ))}
        </svg>
    );
};
