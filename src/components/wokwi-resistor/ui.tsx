import React from 'react';

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area
export const BOUNDS = { x: 0, y: 0, w: 60, h: 12 };

export const ResistorUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const value = attrs?.value || '220';

    return (
        <div style={{ position: 'relative', width: 60, height: 12 }}>
            {React.createElement('wokwi-resistor', {
                value: value,
                style: { pointerEvents: 'none' },
                ...attrs
            })}
        </div>
    );
};
