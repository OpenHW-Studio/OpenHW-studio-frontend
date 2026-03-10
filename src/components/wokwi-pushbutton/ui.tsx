import React, { useState } from 'react';

const BTN_COLORS = [
    { label: 'Green', value: 'green', hex: '#22c55e' },
    { label: 'Red', value: 'red', hex: '#ef4444' },
    { label: 'Blue', value: 'blue', hex: '#3b82f6' },
    { label: 'Yellow', value: 'yellow', hex: '#eab308' },
    { label: 'White', value: 'white', hex: '#f1f5f9' },
    { label: 'Black', value: 'black', hex: '#1e293b' },
];

export const PushbuttonContextMenu = ({ attrs, onUpdate }: { attrs: any, onUpdate: (key: string, value: any) => void }) => {
    const current = attrs?.color ?? 'green';
    return (
        <>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Color:</span>
            <select
                value={current}
                onChange={e => onUpdate('color', e.target.value)}
                style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: 2, outline: 'none' }}
            >
                {BTN_COLORS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                ))}
            </select>
        </>
    );
};

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area
export const BOUNDS = { x: 0, y: 0, w: 68, h: 44 };

export const PushbuttonUI = ({ state, attrs, isRunning }: { state: any, attrs: any, isRunning: boolean }) => {
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
        <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}>
            <div
                onPointerDown={(e) => { e.stopPropagation(); handlePress(); }}
                onMouseDown={(e) => e.stopPropagation()}
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
                    cursor: 'pointer',
                    pointerEvents: isRunning ? 'auto' : 'none'
                }}>
                {React.createElement('wokwi-pushbutton', {
                    style: { pointerEvents: 'none' },
                    ...attrs
                })}
            </div>
        </div>
    );
};
