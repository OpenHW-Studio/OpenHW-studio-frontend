import React, { useState } from 'react';

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area
export const BOUNDS = { x: 0, y: 0, w: 275, h: 203 };

export const UnoUI = ({ state, attrs, isRunning }: { state: any, attrs: any, isRunning?: boolean }) => {
    // Assuming a global stylesheet provides the CSS classes from task3.html
    // or we inline them here. Since building a library, inlining CSS rules is safer,
    // but to match standard React convention, we use standard style props overriding where necessary.

    const [isResetPressed, setIsResetPressed] = useState(false);
    const txOn = state?.txActive ? true : false;
    const rxOn = state?.rxActive ? true : false;
    const powerOn = isRunning;

    const handleResetPress = (e: React.PointerEvent) => {
        if (!isRunning) return;
        e.stopPropagation();
        setIsResetPressed(true);
    };

    const handleResetRelease = () => {
        setIsResetPressed(false);
    };

    return (
        <div style={{ position: 'relative', width: 311, height: 228 }}>
            {/* Base Wokwi Component */}
            {React.createElement('wokwi-arduino-uno', {
                style: { transform: 'scale(0.7)', transformOrigin: '0 0', pointerEvents: 'none' },
                ...attrs
            })}

            {/* Custom Power LED overlay (ON) */}
            <div
                className="uno-power-led"
                style={{
                    position: 'absolute',
                    top: 61,
                    left: 233.9,
                    width: 5.5,
                    height: 5.5,
                    backgroundColor: powerOn ? '#00ff00' : 'transparent',
                    borderRadius: '10%',
                    pointerEvents: 'none',
                    boxShadow: powerOn ? '0 0 9px #00ff00' : 'none',
                    transition: 'background-color 0.1s, box-shadow 0.1s'
                }}
            />

            {/* TX LED overlay */}
            <div
                className="uno-tx-led"
                style={{
                    position: 'absolute',
                    top: 61,
                    left: 119,
                    width: 5,
                    height: 5,
                    backgroundColor: txOn ? '#ffaa00' : 'transparent',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    boxShadow: txOn ? '0 0 4px #ffaa00' : 'none',
                    transition: 'background-color 0.05s, box-shadow 0.05s'
                }}
            />

            {/* RX LED overlay */}
            <div
                className="uno-rx-led"
                style={{
                    position: 'absolute',
                    top: 70,
                    left: 119,
                    width: 5,
                    height: 5,
                    backgroundColor: rxOn ? '#ffaa00' : 'transparent',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    boxShadow: rxOn ? '0 0 4px #ffaa00' : 'none',
                    transition: 'background-color 0.05s, box-shadow 0.05s'
                }}
            />

            {/* Custom Reset Button overlay using wokwi-pushbutton */}
            <div
                className="uno-reset-btn"
                onPointerDown={handleResetPress}
                onPointerUp={handleResetRelease}
                onPointerLeave={handleResetRelease}
                onMouseDown={(e) => isRunning && e.stopPropagation()}
                onDoubleClick={(e) => isRunning && e.stopPropagation()}
                onClick={(e) => {
                    if (!isRunning) return;
                    e.stopPropagation();
                    attrs.onInteract?.('RESET');
                }}
                style={{
                    position: 'absolute',
                    top: 4,
                    left: 21,
                    width: 50,
                    height: 50,
                    cursor: isRunning ? 'pointer' : 'move',
                    pointerEvents: isRunning ? 'auto' : 'none',
                    zIndex: 20,
                    transform: isResetPressed ? 'scale(0.50)' : 'scale(0.55)',
                    transformOrigin: '0 0',
                    transition: 'transform 0.05s'
                }}
                title="Reset Arduino"
            >
                {React.createElement('wokwi-pushbutton', {
                    color: 'red',
                    pressed: isResetPressed,
                    style: { pointerEvents: 'none' }
                })}
            </div>
        </div>
    );
};
