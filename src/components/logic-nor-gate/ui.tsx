import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 90, h: 60 };

export const NorGateUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const gateColor = '#a855f7';
    const wireColor = '#1e1e1e';

    return (
        <svg width="90" height="60" viewBox="0 0 90 60" style={{ pointerEvents: 'none' }}>
            {/* Input wires — stop at the left curve edge */}
            <line x1="0" y1="18" x2="23" y2="18" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />
            <line x1="0" y1="42" x2="23" y2="42" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />

            {/* NOR gate body — curved left + pointed right */}
            <defs>
                <linearGradient id="norGateFill" x1="15" y1="5" x2="70" y2="55" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                </linearGradient>
            </defs>
            <path
                d="M 20,6 C 30,6 52,6 66,30 C 52,54 30,54 20,54 C 28,40 28,20 20,6 Z"
                fill="url(#norGateFill)"
                stroke={gateColor}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Inversion bubble */}
            <circle cx="71.5" cy="30" r="5.5" fill="none" stroke={gateColor} strokeWidth="3" />

            {/* Output wire */}
            <line x1="77" y1="30" x2="90" y2="30" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
};
