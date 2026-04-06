import React from 'react';
import manifest from './manifest.json';

export const MiniBreadboardUI = () => {
    const { w, h, pins } = manifest;

    // Draw lines for power rails based on known Y coordinates
    const startX = 15;
    const endX = startX + 16 * 15;
    const startY = 15;

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
            {/* Base board */}
            <rect width={w} height={h} fill="#fbfbf6" rx="10" stroke="#dddddd" strokeWidth="2" />

            {/* Middle Valley Line */}
            <rect x={startX - 10} y={startY + 15 * 5} width={endX - startX + 20} height={10} fill="#eeeeee" />

            {/* Mapping pins to visual holes */}
            {pins.map((pin: any) => (
                <rect
                    key={pin.id}
                    x={pin.x - 3}
                    y={pin.y - 3}
                    width="6"
                    height="6"
                    fill="#333333"
                    rx="1"
                />
            ))}

            {/* Number indicators */}
            {Array.from({ length: 4 }).map((_, i) => {
                const col = i * 5 + 1;
                // Add column number every 5 cols
                const xBase = startX + (col - 1) * 15;
                if (col > 17) return null; // Safety check
                return (
                    <g key={i}>
                        <text x={xBase} y={startY - 5} fontSize="8" fill="#555" textAnchor="middle">{col}</text>
                        <text x={xBase} y={startY + 15 * 10 + 5} fontSize="8" fill="#555" textAnchor="middle">{col}</text>
                    </g>
                );
            })}
        </svg>
    );
};
