import React from 'react';

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area
export const BOUNDS = { x: 3, y: 18, w: 58, h: 70 };

export const BuzzerUI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <div style={{ pointerEvents: 'none', position: 'relative' }}>
            {React.createElement('wokwi-buzzer', {
                hasSignal: state?.isBuzzing ? true : undefined,
                ...attrs
            })}
            {state?.isBuzzing && (
                <div style={{ position: 'absolute', top: -10, left: 10, color: 'orange', fontSize: 16 }}>♪</div>
            )}
        </div>
    );
};
