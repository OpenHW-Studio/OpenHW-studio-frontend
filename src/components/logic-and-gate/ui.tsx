import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 90, h: 60 };

export const AndGateUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const gateColor = '#a855f7';
    const wireColor = '#1e1e1e';

    return (
        <svg width="90" height="60" viewBox="0 0 90 60" style={{ pointerEvents: 'none' }}>
            {/* Input wires */}
            <line x1="0" y1="18" x2="20" y2="18" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />
            <line x1="0" y1="42" x2="20" y2="42" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />

            {/* AND gate body — flat left + curved right */}
            <defs>
                <linearGradient id="andGateFill" x1="20" y1="5" x2="65" y2="55" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                </linearGradient>
            </defs>
            <path
                d="M 20,6 L 45,6 Q 72,6 72,30 Q 72,54 45,54 L 20,54 Z"
                fill="url(#andGateFill)"
                stroke={gateColor}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Output wire */}
            <line x1="72" y1="30" x2="90" y2="30" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
};
