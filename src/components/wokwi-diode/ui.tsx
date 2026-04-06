import React from 'react';

export const DiodeUI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <svg width="30" height="10" viewBox="0 0 30 10" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="5" x2="30" y2="5" stroke="#7f8c8d" strokeWidth="1" />

            {/* Body */}
            <rect x="5" y="2" width="20" height="6" fill="#e74c3c" rx="1" />
            {/* Cathode Stripe */}
            <rect x="21" y="2" width="2" height="6" fill="#2c3e50" />

            {/* Pins */}
            <circle cx="0" cy="5" r="1.5" fill="#ecf0f1" />
            <circle cx="30" cy="5" r="1.5" fill="#ecf0f1" />

            <text x="0" y="0" fontSize="2" fill="black" textAnchor="middle">A</text>
            <text x="30" y="0" fontSize="2" fill="black" textAnchor="middle">C</text>
        </svg>
    );
};
