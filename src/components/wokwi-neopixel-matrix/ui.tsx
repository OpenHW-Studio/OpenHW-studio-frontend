import React, { useRef, useEffect } from 'react';

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area — matches manifest default (1x1 pixel cell)
export const BOUNDS = (attrs: any) => {
    const cols = parseInt(attrs?.cols || '1', 10);
    const rows = parseInt(attrs?.rows || '1', 10);
    return {
        x: 0,
        y: 0,
        w: Math.max(30, cols * 30),
        h: Math.max(30, rows * 30)
    };
};

// For Neopixels, we really just render the wokwi-neopixel-matrix element.
// In the frontend, the setPixel function is called directly on the DOM element if there's state changes.
export const NeopixelUI = ({ state, attrs, comp }: { state: any, attrs: any, comp?: any }) => {
    const elRef = useRef<HTMLElement>(null);
    const cols = parseInt(attrs?.cols || '8', 10);
    const rows = parseInt(attrs?.rows || '8', 10);

    const nativeW = Math.max(30, cols * 30);
    const nativeH = Math.max(30, rows * 30);
    const targetW = comp?.w ?? nativeW;
    const targetH = comp?.h ?? nativeH;
    const scaleX = targetW / nativeW;
    const scaleY = targetH / nativeH;

    // Apply pixel data if provided in state
    useEffect(() => {
        if (state?.pixels && Array.isArray(state.pixels) && elRef.current) {
            const el = elRef.current as any;
            if (typeof el.setPixel === 'function') {
                state.pixels.forEach((rgb: number, index: number) => {
                    const r_idx = Math.floor(index / cols);
                    const c_idx = index % cols;
                    const r = ((rgb >> 16) & 0xff) / 255;
                    const g = ((rgb >> 8) & 0xff) / 255;
                    const b = (rgb & 0xff) / 255;
                    el.setPixel(r_idx, c_idx, { r, g, b });
                });
            }
        }
    }, [state?.pixels, cols, rows]);

    const props = { ...attrs };
    if (props.rows) props.rows = parseInt(props.rows, 10);
    if (props.cols) props.cols = parseInt(props.cols, 10);

    return (
        <div style={{ 
            pointerEvents: 'none',
            width: targetW,
            height: targetH,
            position: 'relative'
        }}>
            {React.createElement('wokwi-neopixel-matrix', {
                ref: elRef,
                ...props,
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
