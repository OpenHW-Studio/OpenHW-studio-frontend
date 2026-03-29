import React from 'react';

export const SoilMoistureSensorUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const moisture = state?.moisture ?? 50;

    return (
        <svg width="30" height="60" viewBox="0 0 30 60" xmlns="http://www.w3.org/2000/svg">
            {/* Prongs */}
            <rect x="8" y="0" width="4" height="30" fill="#f1c40f" rx="1" />
            <rect x="18" y="0" width="4" height="30" fill="#f1c40f" rx="1" />

            {/* Board */}
            <rect x="2" y="25" width="26" height="30" fill="#3498db" rx="2" />
            <circle cx="5" cy="30" r="1.5" fill="#2c3e50" />
            <circle cx="25" cy="30" r="1.5" fill="#2c3e50" />

            <text x="15" y="40" fontSize="3" fill="white" textAnchor="middle" fontWeight="bold">MOISTURE</text>
            <text x="15" y="45" fontSize="3" fill="#ecf0f1" textAnchor="middle">{moisture}%</text>

            <circle cx="20" cy="48" r="2" fill="#34495e" />
            <line x1="18" y1="46" x2="22" y2="50" stroke="#f1c40f" strokeWidth="0.5" />

            {/* LED indicator */}
            <circle cx="10" cy="48" r="1.5" fill={moisture > 50 ? "#2ecc71" : "#7f8c8d"} />

            {/* Pins */}
            {['A0', 'D0', 'GND', 'VCC'].map((l, i) => (
                <g key={l}>
                    <circle cx={5 + i * 7} cy="55" r="1.5" fill="#ecf0f1" />
                    <text x={5 + i * 7} y="52" fontSize="2" fill="white" textAnchor="middle">{l}</text>
                </g>
            ))}
        </svg>
    );
};
