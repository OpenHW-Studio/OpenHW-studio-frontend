import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 120, h: 100 };

export const ATtiny85UI = ({ state, attrs, isRunning }: { state: any, attrs: any, isRunning?: boolean }) => {
    const ledOn = state?.ledActive ? true : false;
    const powerOn = isRunning;

    return (
        <div style={{
            position: 'relative',
            width: 120,
            height: 100,
            backgroundColor: '#004a80',
            borderRadius: '6px',
            border: '1px solid #003a60',
            boxShadow: '3px 3px 8px rgba(0,0,0,0.4)',
            fontFamily: 'JetBrains Mono, monospace',
            color: 'white',
            overflow: 'hidden'
        }}>
            {/* PCB Texture */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '4px 4px' }} />

            {/* Mounting Holes */}
            <div style={{ position: 'absolute', top: 10, left: 10, width: 12, height: 12, backgroundColor: '#e0e0e0', borderRadius: '50%', border: '2px solid #a0a0a0' }} />
            <div style={{ position: 'absolute', bottom: 10, left: 10, width: 12, height: 12, backgroundColor: '#e0e0e0', borderRadius: '50%', border: '2px solid #a0a0a0' }} />

            {/* Micro USB Port */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: -2,
                transform: 'translateY(-50%)',
                width: 18,
                height: 35,
                backgroundColor: '#dcdcdc',
                borderRadius: '2px 4px 4px 2px',
                border: '1px solid #a0a0a0'
            }} />

            {/* Voltage Regulator & Components */}
            <div style={{ position: 'absolute', top: 30, left: 35, width: 12, height: 8, backgroundColor: '#333', borderRadius: '1px' }} />
            <div style={{ position: 'absolute', top: 42, left: 35, width: 4, height: 4, backgroundColor: '#888' }} />
            <div style={{ position: 'absolute', top: 48, left: 35, width: 4, height: 4, backgroundColor: '#888' }} />

            {/* ATtiny85 Chip */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: 60,
                width: 28,
                height: 24,
                backgroundColor: '#1a1a1a',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '5px',
                fontWeight: 'bold',
                boxShadow: '1px 1px 3px rgba(0,0,0,0.6)'
            }}>
                <div style={{ textAlign: 'center', letterSpacing: '0.5px' }}>TINY<br />85</div>
                <div style={{ position: 'absolute', top: 3, left: 3, width: 3, height: 3, borderRadius: '50%', backgroundColor: '#444' }} />
            </div>

            {/* LEDs */}
            <div style={{ position: 'absolute', top: 55, left: 52, width: 4, height: 4, backgroundColor: powerOn ? '#ff3333' : '#440000', borderRadius: '1px', boxShadow: powerOn ? '0 0 6px #ff3333' : 'none' }} />
            <div style={{ position: 'absolute', top: 65, left: 52, width: 4, height: 4, backgroundColor: ledOn ? '#00bbff' : '#002244', borderRadius: '1px', boxShadow: ledOn ? '0 0 10px #00bbff' : 'none' }} />

            {/* Right Pins (P5 at top, P0 at bottom) - Center X: 108 */}
            {[5, 4, 3, 2, 1, 0].map((p, i) => {
                const centerX = 108;
                const centerY = 16 + i * 14;
                return (
                    <React.Fragment key={p}>
                        {/* Visual Pad (10x10) */}
                        <div style={{ position: 'absolute', top: centerY - 5, left: centerX - 5, width: 10, height: 10, backgroundColor: '#e6e6e6', borderRadius: '50%', border: '1px solid #999', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 4, height: 4, backgroundColor: '#333', borderRadius: '50%' }} />
                        </div>
                        {/* Label - shifted left slightly more */}
                        <div style={{ position: 'absolute', top: centerY - 5, right: 26, fontSize: 9, fontWeight: 'bold' }}>P{p}</div>
                    </React.Fragment>
                );
            })}

            {/* Bottom Pins (5V, GND, VIN) - Center Y: 88 */}
            {['5V', 'GND', 'VIN'].map((label, i) => {
                const centerX = 34 + i * 22;
                const centerY = 88;
                return (
                    <React.Fragment key={label}>
                        {/* Visual Pad (10x10) */}
                        <div style={{ position: 'absolute', top: centerY - 5, left: centerX - 5, width: 10, height: 10, backgroundColor: '#e6e6e6', borderRadius: '50%', border: '1px solid #999', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 4, height: 4, backgroundColor: '#333', borderRadius: '50%' }} />
                        </div>
                        {/* Label - moved higher and more center */}
                        <div style={{ position: 'absolute', top: centerY - 18, left: centerX - 12, width: 24, textAlign: 'center', fontSize: 8, fontWeight: 'bold' }}>{label}</div>
                    </React.Fragment>
                );
            })}

            {/* Brand Text - moved to clear area away from pins */}
            <div style={{ position: 'absolute', bottom: 42, left: 62, fontSize: 8, fontWeight: 'bold', letterSpacing: '1px', color: 'rgba(255,255,255,0.4)' }}>DIGISPARK</div>
        </div>
    );
};
