import React from 'react';

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area
export const BOUNDS = { x: 0, y: 0, w: 165, h: 120 };

export const ServoUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const nativeW = 165;
    const nativeH = 120;
    const scaleX = BOUNDS.w / nativeW;
    const scaleY = BOUNDS.h / nativeH;

    return (
        <div style={{ 
            pointerEvents: 'none',
            width: BOUNDS.w,
            height: BOUNDS.h,
            position: 'relative',
            overflow: 'visible'
        }}>
            {React.createElement('wokwi-servo', {
                angle: state?.angle || attrs?.angle || 0,
                ...attrs,
                style: {
                    display: 'block',
                    width: nativeW,
                    height: nativeH,
                    transform: `scale(${scaleX}, ${scaleY})`,
                    transformOrigin: '0 0'
                }
            })}
        </div>
    );
};
