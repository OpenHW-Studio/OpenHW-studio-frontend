import React from 'react';

export const WokwiTM1637UI = ({ state, attrs }: { state: any, attrs: any }) => {
    // Parse attributes
    const activeColor = attrs?.color || 'red';
    const offColor = '#333333';

    // TM1637 handles 4 digits internally
    const numDigits = 4;
    const hasColon = true;

    // Geometry layout (similar to standard 4-digit)
    const digitWidth = 50;
    const digitSpacing = 60; // 50 width + 10 gap
    const colonWidth = 20;

    // Total SVG canvas size
    const totalWidth = (numDigits * digitSpacing) + colonWidth;
    const totalHeight = 70;

    const displayOn = state?.displayOn !== false;

    const getFill = (digitIndex: number, bitMode: number) => {
        if (!displayOn) return offColor;
        const val = state?.digits?.[digitIndex] || 0;
        return (val & bitMode) ? activeColor : offColor;
    };

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${totalWidth} ${totalHeight}`} xmlns="http://www.w3.org/2000/svg">
            {/* Background Base */}
            <rect width={totalWidth} height={totalHeight} fill="#1e1e1e" rx="4" />

            {/* Render Digits */}
            {Array.from({ length: numDigits }).map((_, i) => {
                const isAfterColon = i >= 2;
                const xOffset = (i * digitSpacing) + (isAfterColon ? colonWidth : 0);

                return (
                    <g key={i} transform={`translate(${xOffset}, 0)`}>
                        <polygon points="12,10 38,10 34,14 16,14" fill={getFill(i, 0x01 /* A */)} />
                        <polygon points="40,12 40,33 36,29 36,16" fill={getFill(i, 0x02 /* B */)} />
                        <polygon points="40,37 40,58 36,54 36,41" fill={getFill(i, 0x04 /* C */)} />
                        <polygon points="12,60 38,60 34,56 16,56" fill={getFill(i, 0x08 /* D */)} />
                        <polygon points="10,37 10,58 14,54 14,41" fill={getFill(i, 0x10 /* E */)} />
                        <polygon points="10,12 10,33 14,29 14,16" fill={getFill(i, 0x20 /* F */)} />
                        <polygon points="12,35 16,33 34,33 38,35 34,37 16,37" fill={getFill(i, 0x40 /* G */)} />
                        {/* Decimal point logic, TM1637 often has colon tied to digit 1's DP bit or similar, but some have individual DP manually set via bit 7 */}
                        <circle cx="44" cy="60" r="3" fill={getFill(i, 0x80 /* DP */)} />
                    </g>
                );
            })}

            {/* Render Colon */}
            {hasColon && (
                <g transform={`translate(${2 * digitSpacing}, 0)`}>
                    <circle cx="10" cy="25" r="4" fill={displayOn && state?.colon ? activeColor : offColor} />
                    <circle cx="10" cy="45" r="4" fill={displayOn && state?.colon ? activeColor : offColor} />
                </g>
            )}
        </svg>
    );
};
