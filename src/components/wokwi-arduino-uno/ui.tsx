import React from 'react';

export const UnoUI = ({ state, attrs }: { state: any, attrs: any }) => {
    // Assuming a global stylesheet provides the CSS classes from task3.html
    // or we inline them here. Since building a library, inlining CSS rules is safer,
    // but to match standard React convention, we use standard style props overriding where necessary.

    const ledOn = state?.illuminated ? true : false; // Using state.illuminated or equivalent

    return (
        <div style={{ position: 'relative', width: 311, height: 228 }}>
            {/* Base Wokwi Component */}
            {React.createElement('wokwi-arduino-uno', {
                style: { transform: 'scale(0.7)', transformOrigin: '0 0', pointerEvents: 'none' },
                ...attrs
            })}

            {/* Custom Power LED overlay */}
            <div
                className="uno-power-led"
                style={{
                    position: 'absolute',
                    top: 61.16,
                    left: 233.9,
                    width: 5.5,
                    height: 5.5,
                    backgroundColor: ledOn ? '#00ff00' : '#061306',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    zIndex: 15,
                    transition: '0.3s',
                    boxShadow: ledOn ? '0 0 6px #00ff00, 0 0 10px #00ff00' : 'inset 0 0 1px #000'
                }}
            />
        </div>
    );
};
