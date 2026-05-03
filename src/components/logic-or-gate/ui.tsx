import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 70, h: 50 };

export const OrGateUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const gateColor = '#a855f7';
    const wireColor = '#1e1e1e';

    return (
        <svg width="70" height="50" viewBox="0 0 70 50" style={{ pointerEvents: 'none' }}>
            {/* Input wires */}
            <line x1="0" y1="15" x2="22" y2="15" stroke={wireColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="35" x2="22" y2="35" stroke={wireColor} strokeWidth="2" strokeLinecap="round" />

            {/* OR-shape body */}
            <defs>
                <linearGradient id="orGateFill" x1="20" y1="10" x2="55" y2="25" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                </linearGradient>
            </defs>
            <path
                d="M 20 10 Q 25 25 20 40 Q 40 40 55 25 Q 40 10 20 10 Z"
                fill="url(#orGateFill)"
                stroke={gateColor}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Output wire */}
            <line x1="55" y1="25" x2="70" y2="25" stroke={wireColor} strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
};
