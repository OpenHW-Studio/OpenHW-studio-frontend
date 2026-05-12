import React, { useRef, useLayoutEffect } from 'react';

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area
export const BOUNDS = { x: 0, y: 0, w: 75, h: 75 };

export const PotentiometerUI = ({ state, attrs, isRunning }: { state: any, attrs: any, isRunning: boolean }) => {
    const elRef = useRef<any>(null);

    const nativeW = 75;
    const nativeH = 75;
    const scaleX = BOUNDS.w / nativeW;
    const scaleY = BOUNDS.h / nativeH;

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
        <div style={{ 
            pointerEvents: 'none',
            width: BOUNDS.w,
            height: BOUNDS.h,
            position: 'relative',
            overflow: 'visible'
        }}>
            {React.createElement('wokwi-potentiometer', {
                ref: elRef,
                value: state?.value ?? attrs?.value ?? 50,
                ...attrs,
                style: { 
                    ...attrs.style, 
                    display: 'block',
                    width: nativeW,
                    height: nativeH,
                    transform: `scale(${scaleX}, ${scaleY})`,
                    transformOrigin: '0 0',
                    pointerEvents: isRunning ? 'auto' : 'none' 
                },
                onMouseDown: (e: any) => e.stopPropagation(),
                onPointerDown: (e: any) => e.stopPropagation(),
                onDoubleClick: (e: any) => e.stopPropagation(),
            })}
        </div>
    );
};
