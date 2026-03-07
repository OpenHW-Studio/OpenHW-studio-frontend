import React from 'react';

const spinBtn: React.CSSProperties = {
    width: 20, height: 20, border: '1px solid var(--border)', borderRadius: 4,
    background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0,
};

export const ResistorContextMenu = ({ attrs, onUpdate }: { attrs: any, onUpdate: (key: string, value: any) => void }) => {
    const raw = attrs?.value ?? '1000';
    const numeric = parseFloat(raw);
    const canStep = !isNaN(numeric);

    const step = (add: boolean) => {
        if (!canStep) return;
        const next = add ? numeric + 10 : Math.max(0, numeric - 10);
        onUpdate('value', String(Math.round(next)));
    };

    return (
        <>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Res (Ω):</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button style={spinBtn} title="−10" onClick={() => step(false)}>−</button>
                <input
                    type="text"
                    value={raw}
                    onChange={e => onUpdate('value', e.target.value)}
                    onDoubleClick={e => e.stopPropagation()}
                    style={{ width: 56, background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 4px', outline: 'none', textAlign: 'center', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
                />
                <button style={spinBtn} title="+10" onClick={() => step(true)}>+</button>
            </div>
        </>
    );
};

// Bounding box for the blue selection ring.
// x, y: offset from comp.x/comp.y (top-left corner of the visual area)
// w, h: width and height of the visual area
export const BOUNDS = { x: 0, y: 5, w: 60, h: 12 };

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
