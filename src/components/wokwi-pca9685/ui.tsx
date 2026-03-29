import React from 'react';

export const PCA9685UI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <svg width="80" height="60" viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg">
            <rect width="80" height="60" fill="#2980b9" rx="3" />

            {/* Terminal Block */}
            <rect x="30" y="2" width="20" height="8" fill="#2ecc71" rx="1" />
            <circle cx="35" cy="6" r="1.5" fill="#bdc3c7" />
            <circle cx="45" cy="6" r="1.5" fill="#bdc3c7" />
            <text x="35" y="4" fontSize="2" fill="white" textAnchor="middle">GND</text>
            <text x="45" y="4" fontSize="2" fill="white" textAnchor="middle">V+</text>

            {/* Left header pins (Control) */}
            {['VCC', 'GND', 'SCL', 'SDA'].map((l, i) => (
                <g key={l}>
                    <circle cx="5" cy={10 + i * 10} r="1.5" fill="#f1c40f" />
                    <text x="9" y={11 + i * 10} fontSize="3" fill="white">{l}</text>
                </g>
            ))}

            {/* PCA9685 IC */}
            <rect x="35" y="20" width="10" height="10" fill="#2c3e50" rx="0.5" />

            {/* 16 output channels columns at bottom */}
            {Array.from({ length: 16 }).map((_, ch) => (
                <g key={`ch${ch}`} transform={`translate(${10 + ch * 4}, 50)`}>
                    <circle cx="0" cy="5" r="1" fill="#ecf0f1" /> {/* PWM */}
                    <circle cx="0" cy="0" r="1" fill="#e74c3c" /> {/* V+ */}
                    <circle cx="0" cy="-5" r="1" fill="#34495e" /> {/* GND */}

                    {ch % 4 === 0 && (
                        <text x="0" y="-8" fontSize="2" fill="white" textAnchor="middle">{ch}</text>
                    )}
                </g>
            ))}
        </svg>
    );
};
