import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 90, h: 60 };

export const XnorGateUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const gateColor = '#a855f7';
    const wireColor = '#1e1e1e';

    return (
        <svg width="90" height="60" viewBox="0 0 90 60" style={{ pointerEvents: 'none' }}>
            {/* Input wires */}
            <line x1="0" y1="18" x2="20" y2="18" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />
            <line x1="0" y1="42" x2="20" y2="42" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />

            {/* XNOR gate body */}
            <defs>
                <linearGradient id="xnorGateFill" x1="15" y1="5" x2="70" y2="55" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                </linearGradient>
            </defs>

            {/* Extra curved line on the left (XOR/XNOR distinguishing feature) */}
            <path
                d="M 15,6 C 23,20 23,40 15,54"
                fill="none"
                stroke={gateColor}
                strokeWidth="3"
                strokeLinecap="round"
            />

            {/* OR-shaped body (shorter to make room for bubble) */}
            <path
                d="M 20,6 C 30,6 52,6 66,30 C 52,54 30,54 20,54 C 28,40 28,20 20,6 Z"
                fill="url(#xnorGateFill)"
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
