import React from 'react';

// Bounding box for the selection area
export const BOUNDS = { x: 0, y: 0, w: 121, h: 90 };

export const HCSR04UI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <div style={{ pointerEvents: 'none' }}>
            {React.createElement('wokwi-hc-sr04', {
                distance: attrs?.distance || 100,
                ...attrs
            })}
        </div>
    );
};
