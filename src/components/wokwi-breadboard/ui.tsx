import React from 'react';
import manifest from './manifest.json';

// Bounding box for the board UI.
export const BOUNDS = { x: 0, y: 0, w: manifest.w, h: manifest.h };

export const BreadboardUI = () => {
    const { w, h, pins } = manifest;

    // Draw lines for power rails based on known Y coordinates
    const startX = 30;
    const endX = startX + 62 * 15;

    return (
        <svg 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${w} ${h}`} 
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: 'block' }}
        >
            {/* Base board */}
            <rect width={w} height={h} fill="#fbfbf6" rx="10" stroke="#dddddd" strokeWidth="2" />

            {/* Top Power Rail Lines */}
            <line x1={startX} y1={28} x2={endX} y2={28} stroke="#0000ff" strokeWidth="2" strokeOpacity="0.6" />
            <line x1={startX} y1={43} x2={endX} y2={43} stroke="#ff0000" strokeWidth="2" strokeOpacity="0.6" />

            {/* Bottom Power Rail Lines */}
            <line x1={startX} y1={252} x2={endX} y2={252} stroke="#ff0000" strokeWidth="2" strokeOpacity="0.6" />
            <line x1={startX} y1={267} x2={endX} y2={267} stroke="#0000ff" strokeWidth="2" strokeOpacity="0.6" />

            {/* Middle Valley Line */}
            <rect x={startX - 10} y={127} width={endX - startX + 20} height={10} fill="#eeeeee" />

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
            {Array.from({ length: 13 }).map((_, i) => {
                const col = i * 5 + 1;
                // Add column number every 5 cols
                const xBase = startX + (col - 1) * 15;
                return (
                    <g key={i}>
                        <text x={xBase} y={60} fontSize="8" fill="#555" textAnchor="middle">{col}</text>
                        <text x={xBase} y={230} fontSize="8" fill="#555" textAnchor="middle">{col}</text>
                    </g>
                );
            })}
        </svg>
    );
};
