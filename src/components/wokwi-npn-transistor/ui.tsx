import React from 'react';

export const NPNTransistorUI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <svg width="15" height="25" viewBox="0 0 15 25" xmlns="http://www.w3.org/2000/svg">
            <path d="M 1 10 C 1 -2, 14 -2, 14 10 Z" fill="#2c3e50" />
            <rect x="1" y="10" width="13" height="5" fill="#2c3e50" />

            {/* Legs */}
            <line x1="2" y1="15" x2="0" y2="25" stroke="#bdc3c7" strokeWidth="0.8" />
            <line x1="7.5" y1="15" x2="7.5" y2="25" stroke="#bdc3c7" strokeWidth="0.8" />
            <line x1="13" y1="15" x2="15" y2="25" stroke="#bdc3c7" strokeWidth="0.8" />

            {/* Pins */}
            <circle cx="0" cy="25" r="1" fill="#ecf0f1" />
            <circle cx="7.5" cy="25" r="1" fill="#ecf0f1" />
            <circle cx="15" cy="25" r="1" fill="#ecf0f1" />

            <text x="0" y="28" fontSize="2" fill="black" textAnchor="middle">E</text>
            <text x="7.5" y="28" fontSize="2" fill="black" textAnchor="middle">B</text>
            <text x="15" y="28" fontSize="2" fill="black" textAnchor="middle">C</text>
        </svg>
    );
};
