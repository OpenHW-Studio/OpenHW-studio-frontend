import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 430, h: 228 };

export const MegaUI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <div style={{ position: 'relative', width: BOUNDS.w, height: BOUNDS.h }}>
            <wokwi-arduino-mega
                style={{ pointerEvents: 'none', width: '100%', height: '100%' }}
                {...attrs}
            />
        </div>
    );
};
