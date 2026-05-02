import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 70, h: 50 };

export const XorGateUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const gateColor = '#a855f7';
    const wireColor = '#1e1e1e';

    return (
        <svg width="70" height="50" viewBox="0 0 70 50" style={{ pointerEvents: 'none' }}>
            {/* Input wires */}
            <line x1="0" y1="15" x2="17" y2="15" stroke={wireColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="35" x2="17" y2="35" stroke={wireColor} strokeWidth="2" strokeLinecap="round" />

            {/* Extra curve for XOR */}
            <path
                d="M 16 10 Q 21 25 16 40"
                fill="none"
                stroke={gateColor}
                strokeWidth="2"
                strokeLinecap="round"
            />

            {/* OR-shape body */}
            <defs>
                <linearGradient id="xorGateFill" x1="22" y1="10" x2="57" y2="25" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                </linearGradient>
            </defs>
            <path
                d="M 22 10 Q 27 25 22 40 Q 42 40 57 25 Q 42 10 22 10 Z"
                fill="url(#xorGateFill)"
                stroke={gateColor}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Output wire */}
            <line x1="57" y1="25" x2="70" y2="25" stroke={wireColor} strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
};
