import React, { useRef, useEffect } from 'react';

// For Neopixels, we really just render the wokwi-neopixel-matrix element.
// In the frontend, the setPixel function is called directly on the DOM element if there's state changes.
export const NeopixelUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const elRef = useRef<HTMLElement>(null);

    // Apply pixel data if provided in state
    useEffect(() => {
        if (state?.pixels && elRef.current) {
            const el = elRef.current as any;
            if (typeof el.setPixel === 'function') {
                for (const [row, col, rgb] of state.pixels) {
                    el.setPixel(row, col, rgb);
                }
            }
        }
    }, [state?.pixels]);

    return (
        <div style={{ pointerEvents: 'none' }}>
            {React.createElement('wokwi-neopixel-matrix', {
                ref: elRef,
                rows: attrs?.rows || 1,
                cols: attrs?.cols || 1,
                ...attrs
            })}
        </div>
    );
};
