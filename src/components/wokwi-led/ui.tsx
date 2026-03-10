import React, { useEffect, useRef } from 'react';

export const LEDContextMenu = ({ attrs, onUpdate }: { attrs: any, onUpdate: (key: string, value: any) => void }) => (
    <>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Color:</span>
        <select
            value={attrs?.color || 'red'}
            onChange={e => onUpdate('color', e.target.value)}
            style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: 2, outline: 'none' }}
        >
            <option value="red">Red</option>
            <option value="green">Green</option>
            <option value="blue">Blue</option>
            <option value="yellow">Yellow</option>
            <option value="orange">Orange</option>
            <option value="white">White</option>
        </select>
    </>
);

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area
export const BOUNDS = { x: 12, y: 11, w: 16, h: 30 };

export const LEDUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const isLit = state?.illuminated;
    const color = attrs?.color || 'red';
    const ledRef = useRef<any>(null);

    useEffect(() => {
        if (ledRef.current) {
            ledRef.current.value = isLit ? true : false;
        }
    }, [isLit]);

    return (
        <div style={{ position: 'relative', width: 38, height: 38 }}>
            <wokwi-led
                ref={ledRef}
                color={color}
                style={{ pointerEvents: 'none' }}
                {...attrs}
            />
        </div>
    );
};
