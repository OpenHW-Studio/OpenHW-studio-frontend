import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 90, h: 50 };

export const NotGateUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const inputHigh = state?.inputHigh ?? false;
    const outputHigh = state?.outputHigh ?? true;
    const gateColor = '#a855f7';
    const wireColor = '#1e1e1e';
    const highColor = '#22c55e';

    return (
        <svg width="90" height="50" viewBox="0 0 90 50" style={{ pointerEvents: 'none' }}>
            {/* Input wire */}
            <line x1="0" y1="25" x2="20" y2="25" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />

            {/* Triangle body — filled with subtle gradient */}
            <defs>
                <linearGradient id="notGateFill" x1="20" y1="5" x2="62" y2="45" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                </linearGradient>
            </defs>
            <polygon
                points="20,5 62,25 20,45"
                fill="url(#notGateFill)"
                stroke={gateColor}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Inversion bubble */}
            <circle cx="68" cy="25" r="5.5" fill="none" stroke={gateColor} strokeWidth="3" />

            {/* Output wire */}
            <line x1="74" y1="25" x2="90" y2="25" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
};
