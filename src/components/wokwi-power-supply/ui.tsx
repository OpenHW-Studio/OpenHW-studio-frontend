import React from 'react';

const spinBtn: React.CSSProperties = {
    width: 20, height: 20, border: '1px solid var(--border)', borderRadius: 4,
    background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0,
};

export const PowerSupplyContextMenu = ({ attrs, onUpdate }: { attrs: any, onUpdate: (key: string, value: any) => void }) => {
    const voltage = parseFloat(attrs?.voltage ?? '5.0');
    const step = (delta: number) => {
        const next = Math.round((voltage + delta) * 10) / 10;
        onUpdate('voltage', next.toFixed(1));
    };
    return (
        <>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Voltage:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button style={spinBtn} onClick={() => step(-0.5)}>−</button>
                <input
                    type="text"
                    value={attrs?.voltage ?? '5.0'}
                    onChange={e => onUpdate('voltage', e.target.value)}
                    style={{ width: 38, background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', outline: 'none', textAlign: 'center', fontSize: 12 }}
                />
                <button style={spinBtn} onClick={() => step(+0.5)}>+</button>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>V</span>
        </>
    );
};

export const PowerSupplyUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const voltage = attrs?.voltage || '5.0';
    return (
        <div style={{ position: 'relative', width: 60, height: 60, background: '#2c3e50', borderRadius: 8, border: '2px solid #34495e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around', color: 'white', fontFamily: 'monospace' }}>
            <div style={{ fontSize: 10, fontWeight: 'bold' }}>POWER</div>
            <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 4 }}>{voltage}V</div>
            <div style={{ fontSize: 12, color: '#95a5a6', marginBottom: 4 }}>GND</div>

            {/* Visual pins matching manifest locations roughly */}
            <div style={{ position: 'absolute', right: -5, top: 12, width: 10, height: 6, background: '#bdc3c7', borderRadius: 2 }} />
            <div style={{ position: 'absolute', right: -5, top: 42, width: 10, height: 6, background: '#bdc3c7', borderRadius: 2 }} />
        </div>
    );
};
