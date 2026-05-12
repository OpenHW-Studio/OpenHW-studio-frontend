import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 70, h: 50 };

export const BufferGateUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const gateColor = '#a855f7';
    const wireColor = '#1e1e1e';

    return (
        <svg width="70" height="50" viewBox="0 0 70 50" style={{ pointerEvents: 'none' }}>
            {/* Input wire */}
            <line x1="0" y1="25" x2="20" y2="25" stroke={wireColor} strokeWidth="2" strokeLinecap="round" />

            {/* Triangle body */}
            <defs>
                <linearGradient id="bufferGateFill" x1="20" y1="10" x2="50" y2="25" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                </linearGradient>
            </defs>
            <polygon
                points="20,10 50,25 20,40"
                fill="url(#bufferGateFill)"
                stroke={gateColor}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Output wire */}
            <line x1="50" y1="25" x2="70" y2="25" stroke={wireColor} strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
};
