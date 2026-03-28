import React from 'react';

export const NeopixelRingUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const pixels = parseInt(attrs?.pixels || '16', 10);
    const radius = 30;
    const center = 40;

    return (
        <svg width="100%" height="100%" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
            <circle cx={center} cy={center} r={radius} fill="none" stroke="#222" strokeWidth="6" />

            {Array.from({ length: pixels }).map((_, i) => {
                const angle = (i * 360 / pixels) * (Math.PI / 180);
                const x = center + radius * Math.sin(angle);
                const y = center - radius * Math.cos(angle);

                const colorValue = state?.pixels?.[i] || 0;
                const r = (colorValue >> 16) & 0xFF;
                const g = (colorValue >> 8) & 0xFF;
                const b = colorValue & 0xFF;

                const isActive = (r > 0 || g > 0 || b > 0);
                const fill = isActive ? `rgb(${r},${g},${b})` : '#333';
                const shadow = isActive ? `drop-shadow(0 0 4px rgb(${r},${g},${b}))` : 'none';

                return (
                    <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="3"
                        fill={fill}
                        style={{ filter: shadow }}
                    />
                );
            })}
        </svg>
    );
};
