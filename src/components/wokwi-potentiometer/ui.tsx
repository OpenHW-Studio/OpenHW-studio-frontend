import React, { useRef, useLayoutEffect } from 'react';

export const PotentiometerUI = ({ state, attrs }: { state: any, attrs: any }) => {
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
        <div style={{ pointerEvents: 'auto' }}>
            {React.createElement('wokwi-potentiometer', {
                ref: elRef,
                value: state?.value ?? attrs?.value ?? 50,
                ...attrs,
                style: { ...attrs.style, pointerEvents: 'auto' }
            })}
        </div>
    );
};
