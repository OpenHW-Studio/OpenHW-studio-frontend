import React from 'react';

// Bounding box for the selection area
export const BOUNDS = { x: 0, y: 0, w: 244.1, h: 161.3 };

export const HCSR04UI = ({ state, attrs }: { state: any, attrs: any }) => {
    // Precise Wokwi HC-SR04 native dimensions from doc viewBox
    const nativeW = 172.5;
    const nativeH = 114;
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
            {React.createElement('wokwi-hc-sr04', {
                distance: attrs?.distance || 100,
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
