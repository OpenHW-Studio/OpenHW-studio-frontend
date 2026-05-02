import React from 'react';

export const LEDContextMenu = ({ attrs, onUpdate }: { attrs: any, onUpdate: (key: string, value: any) => void }) => (
    <>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Capacity (mAh):</span>
        <input 
            type="number"
            value={attrs?.capacityMah || '2000'}
            onChange={e => onUpdate('capacityMah', e.target.value)}
            style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: 2, outline: 'none' }}
        />
    </>
);

export const BOUNDS = { x: 0, y: 0, w: 60, h: 40 };

export const LEDUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const percentage = Math.round((state?.charge / state?.capacity) * 100) || 0;
    const isDead = state?.isDead;

    return (
        <div style={{ 
            width: 60, height: 40, 
            background: '#333', 
            border: '2px solid #555', 
            borderRadius: '4px',
            position: 'relative',
            padding: '2px',
            boxSizing: 'border-box'
        }}>
            {/* Battery Terminal Tip */}
            <div style={{
                position: 'absolute', right: -6, top: 12,
                width: 6, height: 16, background: '#555',
                borderRadius: '0 2px 2px 0'
            }} />
            
            {/* Charge Bar */}
            <div style={{
                width: `${percentage}%`,
                height: '100%',
                background: isDead ? '#666' : (percentage < 20 ? '#ff4757' : '#2ed573'),
                borderRadius: '1px',
                transition: 'width 0.3s ease'
            }} />

            {/* Percentage Text */}
            <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', color: 'white', fontWeight: 'bold', pointerEvents: 'none'
            }}>
                {isDead ? 'EMPTY' : percentage + '%'}
            </div>
        </div>
    );
};
