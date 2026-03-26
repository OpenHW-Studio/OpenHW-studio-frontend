import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 80, h: 60 };

export const ClockGeneratorUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const componentColor = '#9c27b0';
    const wireColor = '#000000';
    
    let freq = attrs?.frequency || '10';
    let units = attrs?.units || 'KHz';
    const dispTxt = `${freq}${units.replace('Hz', '').toLowerCase()}`;

    return (
        <svg width="80" height="60" viewBox="0 0 80 60" style={{ pointerEvents: 'none' }}>
            <rect
                x="3" y="3" width="54" height="54"
                fill="#e0e0e0"
                fillOpacity="0.4"
                stroke={componentColor}
                strokeWidth="3"
            />
            <path
                d="M 3 40 L 11 40 L 11 15 L 25 15 L 25 40 L 35 40 L 35 15 L 49 15 L 49 40 L 57 40"
                fill="none"
                stroke={componentColor}
                strokeWidth="3"
                strokeLinejoin="miter"
            />
            <text x="30" y="53" fill="#000" fontSize="13" fontFamily="sans-serif" textAnchor="middle">
                {dispTxt}
            </text>
            <line x1="57" y1="40" x2="80" y2="40" stroke={wireColor} strokeWidth="3" />
        </svg>
    );
};

export const ClockGeneratorContextMenu = ({ attrs, onUpdate }: { attrs: any, onUpdate: (k: string, v: any) => void }) => {
    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '0 4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)' }}>Frequency</span>
                <input
                    type="number"
                    min="1"
                    max="999"
                    value={attrs.frequency || 10}
                    onChange={e => onUpdate('frequency', e.target.value)}
                    style={{
                        width: 60, height: 26, background: 'var(--bg3)', border: '1px solid var(--border)',
                        color: 'var(--text)', borderRadius: 4, padding: '0 6px', fontSize: 12, outline: 'none'
                    }}
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)' }}>Units</span>
                <select
                    value={attrs.units || 'KHz'}
                    onChange={e => onUpdate('units', e.target.value)}
                    style={{
                        height: 26, background: 'var(--bg3)', border: '1px solid var(--border)',
                        color: 'var(--text)', borderRadius: 4, padding: '0 6px', fontSize: 12, outline: 'none'
                    }}
                >
                    <option value="Hz">Hz</option>
                    <option value="KHz">KHz</option>
                    <option value="MHz">MHz</option>
                </select>
            </div>
        </div>
    );
};
