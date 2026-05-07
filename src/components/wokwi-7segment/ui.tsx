import React from 'react';

// Bounding box for the blue selection ring.
export const BOUNDS = { x: 0, y: 0, w: 260, h: 70 };

export const Wokwi7SegmentUI = ({ state, attrs }: { state: any, attrs: any }) => {
    // Parse attributes
    const numDigits = parseInt(attrs?.digits || '1', 10);
    const hasColon = attrs?.colon === '1' || attrs?.colon === 'true';
    const activeColor = attrs?.color || 'red';
    const offColor = '#333333';

    // Geometry layout
    const digitWidth = 50;
    const digitSpacing = 60; // 50 width + 10 gap
    const colonWidth = hasColon && numDigits >= 2 ? 20 : 0;
    
    // Total SVG canvas size
    const totalWidth = (numDigits * digitSpacing) + colonWidth;
    const totalHeight = 70;

    const getFill = (digitIndex: number, seg: string) => {
        return state?.digits?.[digitIndex]?.[seg] ? activeColor : offColor;
    };

    return (
        <svg 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${totalWidth} ${totalHeight}`} 
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: 'block' }}
        >
            {/* Background Base */}
            <rect width={totalWidth} height={totalHeight} fill="#1e1e1e" rx="4" />

            {/* Render Digits */}
            {Array.from({ length: numDigits }).map((_, i) => {
                // If it's the second half of the display and we have a colon, shift it right
                const isAfterColon = hasColon && numDigits >= 2 && i >= Math.floor(numDigits / 2);
                const xOffset = (i * digitSpacing) + (isAfterColon ? colonWidth : 0);

                return (
                    <g key={i} transform={`translate(${xOffset}, 0)`}>
                        <polygon points="12,10 38,10 34,14 16,14" fill={getFill(i, 'A')} />
                        <polygon points="40,12 40,33 36,29 36,16" fill={getFill(i, 'B')} />
                        <polygon points="40,37 40,58 36,54 36,41" fill={getFill(i, 'C')} />
                        <polygon points="12,60 38,60 34,56 16,56" fill={getFill(i, 'D')} />
                        <polygon points="10,37 10,58 14,54 14,41" fill={getFill(i, 'E')} />
                        <polygon points="10,12 10,33 14,29 14,16" fill={getFill(i, 'F')} />
                        <polygon points="12,35 16,33 34,33 38,35 34,37 16,37" fill={getFill(i, 'G')} />
                        <circle cx="44" cy="60" r="3" fill={getFill(i, 'DP')} />
                    </g>
                );
            })}

            {/* Render Colon */}
            {hasColon && numDigits >= 2 && (
                <g transform={`translate(${Math.floor(numDigits / 2) * digitSpacing}, 0)`}>
                    <circle cx="10" cy="25" r="4" fill={state?.colon ? activeColor : offColor} />
                    <circle cx="10" cy="45" r="4" fill={state?.colon ? activeColor : offColor} />
                </g>
            )}
        </svg>
    );
};