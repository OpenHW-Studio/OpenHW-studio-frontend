import React from 'react';

// Bounding box for the selection area
export const BOUNDS = { x: 0, y: 0, w: 172.5, h: 114 };

export const HCSR04ContextMenu = ({ attrs, onUpdate }: { attrs: any, onUpdate: (key: string, value: any) => void }) => {
    const distanceVal = attrs?.distance ?? 100;

    const handleSlider = (key: string, value: number) => {
        onUpdate(key, value);
        if (attrs && attrs.onInteract) {
            attrs.onInteract({ type: 'SET_ATTR', key, value });
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px' }} data-contextmenu="true">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '10px', color: 'var(--text2)', marginBottom: '2px' }}>Distance: {distanceVal} cm</label>
                <input
                    type="range" min="2" max="400" value={distanceVal}
                    onChange={(e) => handleSlider('distance', parseFloat(e.target.value))}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ width: '120px', cursor: 'pointer' }}
                />
            </div>
        </div>
    );
};

export const HCSR04UI = ({ state, attrs }: { state: any, attrs: any }) => {
    return (
        <div style={{ pointerEvents: 'none' }}>
            {React.createElement('wokwi-hc-sr04', {
                distance: attrs?.distance || 100,
                ...attrs
            })}
        </div>
    );
};
