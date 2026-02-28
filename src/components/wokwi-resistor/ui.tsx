import React from 'react';

export const ResistorUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const value = attrs?.value || '220';

    return (
        <div style={{ position: 'relative', width: 60, height: 12 }}>
            {React.createElement('wokwi-resistor', {
                value: value,
                style: { pointerEvents: 'none' },
                ...attrs
            })}
            <div
                className="resistor-label"
                style={{
                    position: 'absolute',
                    top: -20, left: '50%', transform: 'translateX(-50%)',
                    background: '#222', padding: '2px 6px', borderRadius: 4,
                    fontSize: '0.75rem', color: '#aaa', pointerEvents: 'none'
                }}>
                {value}Ω
            </div>
        </div>
    );
};
