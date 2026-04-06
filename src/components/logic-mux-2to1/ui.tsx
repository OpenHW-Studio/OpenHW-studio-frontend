import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 90, h: 80 };

export const Mux2to1UI = ({ state, attrs }: { state: any, attrs: any }) => {
    const gateColor = '#a855f7';
    const wireColor = '#1e1e1e';

    return (
        <svg width="90" height="80" viewBox="0 0 90 80" style={{ pointerEvents: 'none' }}>
            {/* Input wires — D0, D1 */}
            <line x1="0" y1="22" x2="24" y2="22" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />
            <line x1="0" y1="58" x2="24" y2="58" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />

            {/* Select wire — bottom center */}
            <line x1="45" y1="80" x2="45" y2="64" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />

            {/* Trapezoid body */}
            <defs>
                <linearGradient id="muxFill" x1="24" y1="8" x2="66" y2="72" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                </linearGradient>
            </defs>
            <polygon
                points="24,8 66,20 66,60 24,72"
                fill="url(#muxFill)"
                stroke={gateColor}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Labels inside */}
            <text x="32" y="26" fill={gateColor} fontSize="10" fontFamily="monospace" fontWeight="bold">0</text>
            <text x="32" y="62" fill={gateColor} fontSize="10" fontFamily="monospace" fontWeight="bold">1</text>

            {/* Output wire */}
            <line x1="66" y1="40" x2="90" y2="40" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
};
