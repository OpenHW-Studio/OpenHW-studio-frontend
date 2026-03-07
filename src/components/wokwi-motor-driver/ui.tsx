import React from 'react';

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area
export const BOUNDS = { x: 0, y: 0, w: 80, h: 80 };

export const MotorDriverUI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <div style={{ position: 'relative', width: 80, height: 80, background: '#c0392b', borderRadius: 4, border: '2px solid #a93226', color: 'white', fontFamily: 'monospace', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: 5, width: 60, height: 20, background: '#7f8c8d', borderRadius: 2 }} title="Heatsink" />
            <div style={{ zIndex: 1 }}>L298N<br />Driver</div>
        </div>
    );
};
