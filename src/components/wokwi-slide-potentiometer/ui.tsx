import React from 'react';

export const SlidePotUI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <div
            style={{ pointerEvents: 'auto' }}
            onInput={(e: any) => {
                if (attrs.onInteract) {
                    attrs.onInteract({ type: 'input', value: e.target.value });
                }
            }}
        >
            {React.createElement('wokwi-slide-potentiometer', {
                value: state?.value ?? attrs?.value ?? 50,
                ...attrs,
                style: { ...attrs.style, pointerEvents: 'auto' }
            })}
        </div>
    );
};
