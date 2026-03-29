import React from 'react';

export const L293DUI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <svg width="30" height="50" viewBox="0 0 30 50" xmlns="http://www.w3.org/2000/svg">
            <rect width="30" height="50" fill="#2c3e50" rx="2" />
            <circle cx="15" cy="5" r="2" fill="#34495e" />

            <path d="M 12 0 Q 15 5 18 0 Z" fill="#34495e" />

            {/* Left Pins (1-8) */}
            {[5, 10, 15, 20, 25, 30, 35, 40].map((y, i) => (
                <g key={`L${i}`}>
                    <circle cx="5" cy={y} r="1.5" fill="#ecf0f1" />
                    <line x1="0" y1={y} x2="5" y2={y} stroke="#bdc3c7" strokeWidth="1" />
                </g>
            ))}

            {/* Right Pins (16-9) */}
            {[5, 10, 15, 20, 25, 30, 35, 40].map((y, i) => (
                <g key={`R${i}`}>
                    <circle cx="25" cy={y} r="1.5" fill="#ecf0f1" />
                    <line x1="30" y1={y} x2="25" y2={y} stroke="#bdc3c7" strokeWidth="1" />
                </g>
            ))}

            <text x="15" y="25" fontSize="4" fill="white" textAnchor="middle" transform="rotate(-90 15 25)">L293D</text>
        </svg>
    );
};
