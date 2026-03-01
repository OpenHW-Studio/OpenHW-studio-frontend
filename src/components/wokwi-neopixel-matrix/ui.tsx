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
                const cols = parseInt(attrs?.cols || '8', 10);
                let anyLit = false;

                state.pixels.forEach((rgb: number, i: number) => {
                    const row = Math.floor(i / cols);
                    const col = i % cols;

                    // Convert integrated rgb number back to CSS format or Hex string 
                    // that wokwi-neopixel-matrix expects. Assuming the integer is 0xRRGGBB
                    let r = (rgb >> 16) & 0xFF;
                    let g = (rgb >> 8) & 0xFF;
                    let b = rgb & 0xFF;

                    if (rgb > 0) anyLit = true;
                    // Assuming setPixel works with `{r, g, b}` format.
                    // If it expects a CSS string, we can use rgb(...) instead. 
                    // According to Wokwi internals, it expects a `{r, g, b}` object
                    el.setPixel(row, col, { r, g, b });
                });
                if (anyLit) console.log(`[NeopixelUI] Rendered pixels updated!`);
            } else {
                console.warn(`[NeopixelUI] el.setPixel is not a function.`);
            }
        }
    }, [state?.pixels, attrs?.cols]);

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
