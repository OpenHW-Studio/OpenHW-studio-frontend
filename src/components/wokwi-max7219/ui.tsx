import React from 'react';

export const MAX7219UI = ({ state, attrs }: { state: any, attrs: any }) => {
    const { matrix = new Array(8).fill(0), active = false } = state;
    const ledColor = attrs.color || '#FF0000';
    const offColor = '#444444'; // Matches Wokwi's dark grey
    const pinColor = '#C3BA9B'; // Matches Wokwi's beige metallic pins
    
    const leds = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const isOn = active && ((matrix[row] & (1 << (7 - col))) !== 0);
            leds.push(
                <circle 
                    key={`${row}-${col}`}
                    cx={25 + col * 10} 
                    cy={5 + row * 10} 
                    r={4} 
                    fill={isOn ? ledColor : offColor} 
                />
            );
        }
    }

    const pinYs = [20, 30, 40, 50, 60];

    return (
        <svg width="120" height="80" viewBox="0 0 120 80">
            {/* Left Pins (IN) */}
            {pinYs.map((y, i) => (
                <line key={`l-pin-${i}`} x1="0" y1={y} x2="20" y2={y} stroke={pinColor} strokeWidth="3" strokeLinecap="round" />
            ))}

            {/* Right Pins (OUT) */}
            {pinYs.map((y, i) => (
                <line key={`r-pin-${i}`} x1="100" y1={y} x2="120" y2={y} stroke={pinColor} strokeWidth="3" strokeLinecap="round" />
            ))}

            {/* Black Matrix Body */}
            <rect x="20" y="0" width="80" height="80" fill="#000000" />
            
            {/* 8x8 LED Grid */}
            {leds}
        </svg>
    );
};