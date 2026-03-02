import React from 'react';

export const ServoUI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <div style={{ pointerEvents: 'none' }}>
            {React.createElement('wokwi-servo', {
                angle: state?.angle || attrs?.angle || 0,
                ...attrs
            })}
        </div>
    );
};
