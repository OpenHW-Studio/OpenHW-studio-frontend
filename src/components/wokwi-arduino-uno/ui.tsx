import React, { useState } from 'react';

export const UnoUI = ({ state, attrs }: { state: any, attrs: any }) => {
    // Assuming a global stylesheet provides the CSS classes from task3.html
    // or we inline them here. Since building a library, inlining CSS rules is safer,
    // but to match standard React convention, we use standard style props overriding where necessary.

    const ledOn = state?.illuminated ? true : false; // Using state.illuminated or equivalent
    const [hoverReset, setHoverReset] = useState(false);

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
                }}
            />

            {/* Custom Reset Button overlay */}
            <div
                className="uno-reset-btn"
                onMouseEnter={() => setHoverReset(true)}
                onMouseLeave={() => setHoverReset(false)}
                onClick={(e) => {
                    e.stopPropagation();
                    attrs.onInteract?.('RESET');
                }}
                style={{
                    position: 'absolute',
                    top: 10,
                    left: 30,
                    width: 18,
                    height: 18,
                    cursor: 'pointer',
                    zIndex: 20,
                    borderRadius: '50%',
                    border: '2px solid rgba(255, 68, 68, 0.8)', // Made visible!
                    backgroundColor: hoverReset ? 'rgba(255, 68, 68, 0.4)' : 'rgba(255, 68, 68, 0.15)',
                    transition: 'all 0.2s',
                    boxShadow: hoverReset ? '0 0 8px rgba(255, 68, 68, 0.8)' : 'none'
                }}
                title="Reset Arduino"
            />
        </div>
    );
};
