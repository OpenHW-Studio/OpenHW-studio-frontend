import React from 'react';

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area
// Bounding box for the blue selection ring.
export const BOUNDS = { x: 0, y: 0, w: 64, h: 90 };

export const BuzzerUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const nativeW = 64;
    const nativeH = 90;
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
            {React.createElement('wokwi-buzzer', {
                hasSignal: state?.isBuzzing ? true : undefined,
                ...attrs,
                style: {
                    display: 'block',
                    width: nativeW,
                    height: nativeH,
                    transform: `scale(${scaleX}, ${scaleY})`,
                    transformOrigin: '0 0'
                }
            })}
            {state?.isBuzzing && (
                <div style={{ 
                    position: 'absolute', 
                    top: -10 * scaleY, 
                    left: 10 * scaleX, 
                    color: 'orange', 
                    fontSize: 16 * scaleX 
                }}>♪</div>
            )}
        </div>
    );
};
