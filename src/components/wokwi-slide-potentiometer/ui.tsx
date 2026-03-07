import React, { useRef, useLayoutEffect } from 'react';

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area
export const BOUNDS = { x: 0, y: 20, w: 205, h: 70 };

export const SlidePotUI = ({ state, attrs, isRunning }: { state: any, attrs: any, isRunning: boolean }) => {
    const elRef = useRef<any>(null);

    useLayoutEffect(() => {
        const el = elRef.current;
        if (!el) return;

        const handleInput = (e: any) => {
            if (attrs.onInteract) {
                let val = undefined;
                if (typeof e.detail === 'number') val = e.detail;
                else if (e.detail && e.detail.value !== undefined) val = e.detail.value;
                else if (e.target && e.target.value !== undefined) val = e.target.value;
                else if (e.target && e.target.percent !== undefined) val = e.target.percent;

                if (val !== undefined) {
                    attrs.onInteract({ type: 'input', value: Number(val) });
                }
            }
        };

        el.addEventListener('input', handleInput);
        el.addEventListener('change', handleInput);
        return () => {
            el.removeEventListener('input', handleInput);
            el.removeEventListener('change', handleInput);
        };
    }, [attrs.onInteract]);

    return (
        <div style={{ pointerEvents: 'none' }}>
            {React.createElement('wokwi-slide-potentiometer', {
                ref: elRef,
                value: state?.value ?? attrs?.value ?? 50,
                ...attrs,
                style: { ...attrs.style, pointerEvents: isRunning ? 'auto' : 'none' },
                onMouseDown: (e: any) => e.stopPropagation(),
                onPointerDown: (e: any) => e.stopPropagation(),
                onDoubleClick: (e: any) => e.stopPropagation(),
            })}
        </div>
    );
};
