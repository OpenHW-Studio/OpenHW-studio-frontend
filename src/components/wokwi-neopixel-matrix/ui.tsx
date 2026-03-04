import React, { useRef, useEffect } from 'react';

// For Neopixels, we really just render the wokwi-neopixel-matrix element.
// In the frontend, the setPixel function is called directly on the DOM element if there's state changes.
export const NeopixelUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const elRef = useRef<HTMLElement>(null);

    // Apply pixel data if provided in state
    useEffect(() => {
        if (state?.pixels && Array.isArray(state.pixels) && elRef.current) {
            const el = elRef.current as any;
            if (typeof el.setPixel === 'function') {
                const cols = parseInt(attrs?.cols || '1', 10);
                state.pixels.forEach((rgb: number, index: number) => {
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    const r = ((rgb >> 16) & 0xff) / 255;
                    const g = ((rgb >> 8) & 0xff) / 255;
                    const b = (rgb & 0xff) / 255;
                    el.setPixel(row, col, { r, g, b });
                });
            }
        }
    }, [state?.pixels, attrs?.cols]);

    const props = { ...attrs };
    if (props.rows) props.rows = parseInt(props.rows, 10);
    if (props.cols) props.cols = parseInt(props.cols, 10);

    return (
        <div style={{ pointerEvents: 'none' }}>
            {React.createElement('wokwi-neopixel-matrix', {
                ref: elRef,
                ...props
            })}
        </div>
    );
};
