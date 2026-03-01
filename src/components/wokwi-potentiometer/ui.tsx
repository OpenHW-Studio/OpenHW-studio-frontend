import React, { useRef, useEffect } from 'react';

export const PotentiometerUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const elRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const el = elRef.current;
        if (!el) return;

        const handleInput = (e: Event) => {
            const target = e.target as any;
            if (attrs.onInteract) {
                attrs.onInteract({ type: 'input', value: target.value });
            }
        };

        el.addEventListener('input', handleInput);
        return () => el.removeEventListener('input', handleInput);
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
