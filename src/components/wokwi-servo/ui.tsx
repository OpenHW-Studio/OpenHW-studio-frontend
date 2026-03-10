import React from 'react';

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area
export const BOUNDS = { x: 0, y: 0, w: 165, h: 120 };

export const ServoUI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <div style={{ pointerEvents: 'none' }}>
            {React.createElement('wokwi-servo', {
                angle: state?.angle || attrs?.angle || 0,
                ...attrs
            })}
        </div>
    );
};
