import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 90, h: 80 };

export const DFlipFlopRUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const gateColor = '#a855f7';
    const wireColor = '#1e1e1e';

    return (
        <svg width="90" height="80" viewBox="0 0 90 80" style={{ pointerEvents: 'none' }}>
            {/* Input wires — D (top-left) and CLK (bottom-left) */}
            <line x1="0" y1="22" x2="18" y2="22" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />
            <line x1="0" y1="58" x2="18" y2="58" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />

            {/* Reset wire (bottom-center) */}
            <line x1="45" y1="80" x2="45" y2="74" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />

            {/* Rectangular body */}
            <defs>
                <linearGradient id="dffrFill" x1="18" y1="6" x2="72" y2="74" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                </linearGradient>
            </defs>
            <rect
                x="18" y="6" width="54" height="68" rx="3"
                fill="url(#dffrFill)"
                stroke={gateColor}
                strokeWidth="3"
            />

            {/* Labels inside */}
            <text x="24" y="27" fill={gateColor} fontSize="12" fontFamily="monospace" fontWeight="bold">D</text>

            {/* Clock triangle */}
            <polygon points="18,52 28,58 18,64" fill="none" stroke={gateColor} strokeWidth="2" strokeLinejoin="round" />

            {/* Reset label */}
            <text x="41" y="68" fill={gateColor} fontSize="12" fontFamily="monospace" fontWeight="bold">R</text>

            {/* Q label */}
            <text x="58" y="27" fill={gateColor} fontSize="12" fontFamily="monospace" fontWeight="bold">Q</text>

            {/* Qbar label — Q with overline */}
            <text x="58" y="58" fill={gateColor} fontSize="12" fontFamily="monospace" fontWeight="bold">Q</text>
            <line x1="58" y1="49" x2="68" y2="49" stroke={gateColor} strokeWidth="2" />

            {/* Output wires — Q and Qbar */}
            <line x1="72" y1="22" x2="90" y2="22" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />
            <line x1="72" y1="58" x2="90" y2="58" stroke={wireColor} strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
};
