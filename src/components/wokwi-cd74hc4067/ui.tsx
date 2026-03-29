import React from 'react';

export const CD74HC4067UI = ({ state, attrs }: { state: any, attrs: any }) => {
    const active = state?.activeChannel ?? -1;

    return (
        <svg width="60" height="100" viewBox="0 0 60 100" xmlns="http://www.w3.org/2000/svg">
            {/* PCB Base */}
            <rect width="60" height="100" fill="#8e44ad" rx="3" />

            {/* Chip outline */}
            <rect x="25" y="20" width="10" height="60" fill="#2c3e50" rx="1" />

            {/* Left Pins (Control / Common) */}
            <circle cx="5" cy="10" r="2" fill="#e74c3c" />
            <text x="9" y="11" fontSize="3" fill="white">VCC</text>

            <circle cx="5" cy="20" r="2" fill="#34495e" />
            <text x="9" y="21" fontSize="3" fill="white">GND</text>

            <circle cx="5" cy="30" r="2" fill="#95a5a6" />
            <text x="9" y="31" fontSize="3" fill="white">EN</text>

            {[45, 55, 65, 75].map((y, i) => (
                <g key={`S${i}`}>
                    <circle cx="5" cy={y} r="2" fill="#f39c12" />
                    <text x="9" y={y + 1} fontSize="3" fill="white">S{i}</text>
                </g>
            ))}

            <circle cx="5" cy="90" r="2" fill="#3498db" />
            <text x="9" y="91" fontSize="3" fill="white" fontWeight="bold">SIG</text>

            {/* Right Pins (C0-C15) */}
            {Array.from({ length: 16 }).map((_, i) => (
                <g key={`C${i}`}>
                    <circle cx="55" cy={10 + i * 5} r="1.5" fill={active === i ? "#2ecc71" : "#ecf0f1"} />
                    <text x="51" y={11 + i * 5} fontSize="3" fill={active === i ? "#2ecc71" : "white"} textAnchor="end">C{i}</text>
                    {active === i && (
                        <line x1="35" y1={10 + i * 5} x2="52" y2={10 + i * 5} stroke="#2ecc71" strokeWidth="0.5" strokeDasharray="1,1" />
                    )}
                </g>
            ))}
        </svg>
    );
};
