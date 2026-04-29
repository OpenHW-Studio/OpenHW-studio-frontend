import React from 'react';

export const LogicAnalyzerUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const isActive = state?.active || false;

    return (
        <svg width="50" height="30" viewBox="0 0 50 30" xmlns="http://www.w3.org/2000/svg">
            <rect width="50" height="30" fill="#2c3e50" rx="3" />
            <rect x="2" y="2" width="46" height="15" fill="#34495e" rx="1" />

            <text x="25" y="10" fontSize="4" fill="white" fontWeight="bold" textAnchor="middle">8-CH LOGIC</text>
            <text x="25" y="14" fontSize="3" fill="#bdc3c7" textAnchor="middle">ANALYZER</text>

            {/* Activity LED */}
            <circle cx="5" cy="10" r="1.5" fill={isActive ? "#2ecc71" : "#7f8c8d"} />
            {isActive && (
                <circle cx="5" cy="10" r="2.5" fill="none" stroke="#2ecc71" strokeWidth="0.5" style={{ filter: 'blur(1px)' }} />
            )}

            {/* Pins */}
            <circle cx="5" cy="30" r="1.5" fill="#34495e" />
            <text x="5" y="25" fontSize="2.5" fill="white" textAnchor="middle">GND</text>

            {[10, 15, 20, 25, 30, 35, 40, 45].map((x, i) => (
                <g key={`D${i}`}>
                    <circle cx={x} cy="30" r="1.5" fill="#f1c40f" />
                    <text x={x} y="25" fontSize="2.5" fill="white" textAnchor="middle">D{i}</text>
                </g>
            ))}
        </svg>
    );
};
