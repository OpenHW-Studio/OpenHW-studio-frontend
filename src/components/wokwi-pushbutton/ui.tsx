import React, { useState } from 'react';

export const PushbuttonUI = ({ state, attrs }: { state: any, attrs: any }) => {
    // Local animation state for immediate feedback
    const [isPressed, setIsPressed] = useState(false);

    const handlePress = () => {
        setIsPressed(true);
        if (attrs.onInteract) attrs.onInteract('press');
    };

    const handleRelease = () => {
        setIsPressed(false);
        if (attrs.onInteract) attrs.onInteract('release');
    };

    // Use local state for fast UI response, or fallback to simulator state
    const pressed = isPressed || state?.pressed;

    return (
        <div
            onPointerDown={handlePress}
            onPointerUp={handleRelease}
            onPointerLeave={handleRelease}
            className={`btn-wrapper ${pressed ? 'pressed' : ''}`}
            style={{
                position: 'relative',
                width: 68,
                height: 44,
                transition: 'transform 0.05s cubic-bezier(0.4, 0, 0.2, 1), filter 0.05s',
                transform: pressed ? 'scale(0.92)' : 'scale(1)',
                filter: pressed ? 'brightness(0.8) drop-shadow(0 0 3px rgba(0,0,0,0.5))' : 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
                cursor: 'pointer'
            }}>
            {React.createElement('wokwi-pushbutton', {
                style: { pointerEvents: 'none' },
                ...attrs
            })}
        </div>
    );
};
