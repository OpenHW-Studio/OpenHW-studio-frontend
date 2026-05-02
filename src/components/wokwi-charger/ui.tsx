import React from 'react';

export const LEDContextMenu = ({ attrs, onUpdate }: { attrs: any, onUpdate: (key: string, value: any) => void }) => (
    <>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Charge Current (mA):</span>
        <select 
            value={attrs?.chargeCurrentMa || '1000'}
            onChange={e => onUpdate('chargeCurrentMa', e.target.value)}
            style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: 2, outline: 'none' }}
        >
            <option value="100">100mA</option>
            <option value="500">500mA</option>
            <option value="1000">1000mA</option>
        </select>
    </>
);

export const BOUNDS = { x: 0, y: 0, w: 80, h: 50 };

export const LEDUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const isCharging = state?.isCharging;
    const inputVoltage = state?.inputVoltage || 0;

    return (
        <div style={{ 
            width: 80, height: 50, 
            background: '#2c3e50', 
            border: '2px solid #34495e', 
            borderRadius: '6px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
        }}>
            {/* USB Port Visual */}
            <div style={{ position: 'absolute', left: 0, top: 15, width: 8, height: 20, background: '#7f8c8d', borderRadius: '0 2px 2px 0' }} />
            
            {/* Status LEDs */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 5 }}>
                {/* Red (Charging) */}
                <div style={{ 
                    width: 6, height: 6, borderRadius: '50%', 
                    background: isCharging ? '#ff4757' : '#333',
                    boxShadow: isCharging ? '0 0 8px #ff4757' : 'none'
                }} />
                {/* Blue (Full/Standby) */}
                <div style={{ 
                    width: 6, height: 6, borderRadius: '50%', 
                    background: (!isCharging && inputVoltage > 4) ? '#2e86de' : '#333',
                    boxShadow: (!isCharging && inputVoltage > 4) ? '0 0 8px #2e86de' : 'none'
                }} />
            </div>

            <div style={{ fontSize: '9px', color: '#bdc3c7', fontWeight: 'bold' }}>TP4056</div>
        </div>
    );
};
