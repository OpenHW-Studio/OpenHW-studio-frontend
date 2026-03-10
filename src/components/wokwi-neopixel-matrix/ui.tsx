import React, { useRef, useEffect } from 'react';

const numberInput: React.CSSProperties = {
    width: 64,
    background: 'var(--card)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '3px 4px 3px 8px',
    fontSize: 13,
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 600,
    outline: 'none',
    textAlign: 'center',
    appearance: 'auto',
    WebkitAppearance: 'auto',
    cursor: 'default',
};

const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
};

const label: React.CSSProperties = {
    fontSize: 11, color: 'var(--text2)', width: 30, flexShrink: 0, fontWeight: 600,
};

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area — matches manifest default (1x1 pixel cell)
export const BOUNDS = (attrs: any) => {
    const cols = parseInt(attrs?.cols || '1', 10);
    const rows = parseInt(attrs?.rows || '1', 10);
    return {
        x: 0,
        y: 0,
        w: Math.max(20, cols * 25),
        h: Math.max(20, rows * 25)
    };
};

export const NeopixelContextMenu = ({ attrs, onUpdate }: { attrs: any, onUpdate: (key: string, value: any) => void }) => {
    const cols = Math.max(1, Math.min(16, parseInt(attrs?.cols ?? '8', 10)));
    const rows = Math.max(1, Math.min(16, parseInt(attrs?.rows ?? '8', 10)));

    const handleChange = (key: string, raw: string, min: number, max: number) => {
        const v = Math.max(min, Math.min(max, parseInt(raw, 10) || min));
        onUpdate(key, v);
    };

    return (
        <>
            <div style={rowStyle}>
                <span style={label}>Cols</span>
                <input
                    type="number"
                    min={1}
                    max={16}
                    value={cols}
                    onChange={e => handleChange('cols', e.target.value, 1, 16)}
                    onDoubleClick={e => e.stopPropagation()}
                    style={numberInput}
                />
            </div>
            <div style={rowStyle}>
                <span style={label}>Rows</span>
                <input
                    type="number"
                    min={1}
                    max={16}
                    value={rows}
                    onChange={e => handleChange('rows', e.target.value, 1, 16)}
                    onDoubleClick={e => e.stopPropagation()}
                    style={numberInput}
                />
            </div>
        </>
    );
};

// For Neopixels, we really just render the wokwi-neopixel-matrix element.
// In the frontend, the setPixel function is called directly on the DOM element if there's state changes.
export const NeopixelUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const elRef = useRef<HTMLElement>(null);

    // Apply pixel data if provided in state
    useEffect(() => {
        if (state?.pixels && Array.isArray(state.pixels) && elRef.current) {
            const el = elRef.current as any;
            if (typeof el.setPixel === 'function') {
                const cols = parseInt(attrs?.cols || '1', 10);
                state.pixels.forEach((rgb: number, index: number) => {
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    const r = ((rgb >> 16) & 0xff) / 255;
                    const g = ((rgb >> 8) & 0xff) / 255;
                    const b = (rgb & 0xff) / 255;
                    el.setPixel(row, col, { r, g, b });
                });
            }
        }
    }, [state?.pixels, attrs?.cols]);

    const props = { ...attrs };
    if (props.rows) props.rows = parseInt(props.rows, 10);
    if (props.cols) props.cols = parseInt(props.cols, 10);

    return (
        <div style={{ pointerEvents: 'none' }}>
            {React.createElement('wokwi-neopixel-matrix', {
                ref: elRef,
                ...props
            })}
        </div>
    );
};
