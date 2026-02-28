import React, { useEffect, useRef } from 'react';

export const LEDUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const isLit = state?.illuminated;
    const color = attrs?.color || 'red';
    const ledRef = useRef<any>(null);

    useEffect(() => {
        if (ledRef.current) {
            ledRef.current.value = isLit ? true : false;
        }
    }, [isLit]);

    return (
        <div style={{ position: 'relative', width: 38, height: 38 }}>
            <wokwi-led
                ref={ledRef}
                color={color}
                style={{ pointerEvents: 'none' }}
                {...attrs}
            />
        </div>
    );
};
