import React from 'react';

export const BuzzerUI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <div style={{ pointerEvents: 'none', position: 'relative' }}>
            {React.createElement('wokwi-buzzer', {
                hasSignal: state?.isBuzzing ? true : undefined,
                ...attrs
            })}
            {state?.isBuzzing && (
                <div style={{ position: 'absolute', top: -10, left: 10, color: 'orange', fontSize: 16 }}>♪</div>
            )}
        </div>
    );
};
