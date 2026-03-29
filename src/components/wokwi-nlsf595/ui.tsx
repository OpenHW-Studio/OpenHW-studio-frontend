import React from 'react';

export const NLSF595UI = ({ state, attrs }: { state: any, attrs: any }) => {
    const r = state?.r || 0;
    const g = state?.g || 0;
    const b = state?.b || 0;
    const color = `rgb(${r}, ${g}, ${b})`;

    return (
        <svg width="60" height="30" viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
            {/* Board */}
            <rect width="60" height="30" fill="#2980b9" rx="3" />

            {/* Chip */}
            <rect x="20" y="5" width="20" height="20" fill="#2c3e50" rx="1" />
            <circle cx="23" cy="8" r="1.5" fill="#7f8c8d" />

            {/* LED visually tied to the output */}
            <circle cx="45" cy="15" r="5" fill={color} stroke="#34495e" strokeWidth="1" />

            {/* Glow effect if LED is on */}
            {(r > 0 || g > 0 || b > 0) && (
                <circle cx="45" cy="15" r="6" fill="none" stroke={color} strokeWidth="2" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            )}

            {/* Left Pins */}
            <circle cx="5" cy="5" r="2" fill="#e74c3c" />
            <circle cx="5" cy="12" r="2" fill="#34495e" />
            <circle cx="5" cy="19" r="2" fill="#f1c40f" />
            <circle cx="5" cy="26" r="2" fill="#3498db" />

            <text x="9" y="6" fontSize="3" fill="white" alignmentBaseline="middle">VCC</text>
            <text x="9" y="13" fontSize="3" fill="white" alignmentBaseline="middle">GND</text>
            <text x="9" y="20" fontSize="3" fill="white" alignmentBaseline="middle">MOSI</text>
            <text x="9" y="27" fontSize="3" fill="white" alignmentBaseline="middle">SCK</text>
            <text x="16" y="27" fontSize="3" fill="white" alignmentBaseline="middle">CS</text>

            <circle cx="12" cy="26" r="2" fill="#9b59b6" />

            {/* Right Pins */}
            <circle cx="55" cy="5" r="2" fill="#e74c3c" />
            <circle cx="55" cy="12" r="2" fill="#2ecc71" />
            <circle cx="55" cy="19" r="2" fill="#3498db" />

            <text x="51" y="6" fontSize="3" fill="white" textAnchor="end" alignmentBaseline="middle">R1</text>
            <text x="51" y="13" fontSize="3" fill="white" textAnchor="end" alignmentBaseline="middle">G1</text>
            <text x="51" y="20" fontSize="3" fill="white" textAnchor="end" alignmentBaseline="middle">B1</text>

        </svg>
    );
};
