import React from 'react';

export const PhotodiodeUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const light = state?.light ?? 0;

    return (
        <svg width="15" height="30" viewBox="0 0 15 30" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(7.5, 10)">
                <path d="M -5 5 L -5 -2 A 5 5 0 0 1 5 -2 L 5 5 Z" fill="#2c3e50" opacity="0.8" />
                <rect x="-6" y="5" width="12" height="2" fill="#2c3e50" />

                {/* Simulated light collection area */}
                <circle cx="0" cy="0" r="2.5" fill={light > 50 ? "#f1c40f" : "#7f8c8d"} />
            </g>

            {/* Pins */}
            <line x1="2.5" y1="17" x2="0" y2="30" stroke="#95a5a6" strokeWidth="1" />
            <line x1="12.5" y1="17" x2="15" y2="30" stroke="#95a5a6" strokeWidth="1" />

            <circle cx="0" cy="30" r="1.5" fill="#ecf0f1" />
            <circle cx="15" cy="30" r="1.5" fill="#ecf0f1" />

            {/* Flat spot indicating cathode commonly */}
            <rect x="13.5" y="15" width="2" height="2" fill="#e74c3c" />

            <text x="0" y="35" fontSize="3" fill="black" textAnchor="middle">A</text>
            <text x="15" y="35" fontSize="3" fill="black" textAnchor="middle">C</text>
        </svg>
    );
};
