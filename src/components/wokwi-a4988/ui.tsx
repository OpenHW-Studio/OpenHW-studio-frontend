import React from 'react';

export const A4988UI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <svg width="50" height="80" viewBox="0 0 50 80" xmlns="http://www.w3.org/2000/svg">
            {/* PCB Base */}
            <rect width="50" height="80" fill="#e74c3c" rx="2" />

            {/* Chip outline */}
            <rect x="15" y="30" width="20" height="20" fill="#2c3e50" rx="1" />
            <circle cx="20" cy="35" r="1" fill="#7f8c8d" />

            {/* Trimpot (at bottom) */}
            <circle cx="25" cy="65" r="5" fill="#f1c40f" />
            <line x1="22" y1="62" x2="28" y2="68" stroke="#d35400" strokeWidth="1" />
            <line x1="28" y1="62" x2="22" y2="68" stroke="#d35400" strokeWidth="1" />

            {/* Left Pins (1 to 8) */}
            {[10, 20, 30, 40, 50, 60, 70, 80].map((y, i) => (
                <g key={`l${i}`}>
                    <circle cx="5" cy={y} r="2.5" fill="#34495e" />
                    <circle cx="5" cy={y} r="1" fill="#ecf0f1" />
                </g>
            ))}

            {/* Right Pins (9 to 16) */}
            {[10, 20, 30, 40, 50, 60, 70, 80].map((y, i) => (
                <g key={`r${i}`}>
                    <circle cx="45" cy={y} r="2.5" fill="#34495e" />
                    <circle cx="45" cy={y} r="1" fill="#ecf0f1" />
                </g>
            ))}

            {/* Labels Left */}
            <text x="10" y="12" fontSize="3.5" fill="white" fontWeight="bold">EN</text>
            <text x="10" y="22" fontSize="3.5" fill="white" fontWeight="bold">MS1</text>
            <text x="10" y="32" fontSize="3.5" fill="white" fontWeight="bold">MS2</text>
            <text x="10" y="42" fontSize="3.5" fill="white" fontWeight="bold">MS3</text>
            <text x="10" y="52" fontSize="3.5" fill="white" fontWeight="bold">RST</text>
            <text x="10" y="62" fontSize="3.5" fill="white" fontWeight="bold">SLP</text>
            <text x="10" y="72" fontSize="3.5" fill="white" fontWeight="bold">STEP</text>
            <text x="10" y="82" fontSize="3.5" fill="white" fontWeight="bold">DIR</text>

            {/* Labels Right */}
            <text x="40" y="12" fontSize="3.5" fill="white" fontWeight="bold" textAnchor="end">VMOT</text>
            <text x="40" y="22" fontSize="3.5" fill="white" fontWeight="bold" textAnchor="end">GND</text>
            <text x="40" y="32" fontSize="3.5" fill="white" fontWeight="bold" textAnchor="end">2B</text>
            <text x="40" y="42" fontSize="3.5" fill="white" fontWeight="bold" textAnchor="end">2A</text>
            <text x="40" y="52" fontSize="3.5" fill="white" fontWeight="bold" textAnchor="end">1A</text>
            <text x="40" y="62" fontSize="3.5" fill="white" fontWeight="bold" textAnchor="end">1B</text>
            <text x="40" y="72" fontSize="3.5" fill="white" fontWeight="bold" textAnchor="end">VDD</text>
            <text x="40" y="82" fontSize="3.5" fill="white" fontWeight="bold" textAnchor="end">GND</text>

            {/* Active Indicator */}
            {state?.active && (
                <circle cx="25" cy="15" r="2" fill="#2ecc71" className="testing-pulse" style={{ filter: 'drop-shadow(0 0 2px #2ecc71)' }} />
            )}
        </svg>
    );
};
