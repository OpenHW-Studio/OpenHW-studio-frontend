import React, { useRef, useEffect } from 'react';

export const ServoUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const elRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (elRef.current && state?.angle !== undefined) {
            (elRef.current as any).angle = state.angle;
        }
    }, [state?.angle]);

    return (
        <div style={{ pointerEvents: 'none' }}>
            {React.createElement('wokwi-servo', {
                ref: elRef,
                angle: attrs?.angle || 0,
                ...attrs
            })}
        </div>
    );
};
