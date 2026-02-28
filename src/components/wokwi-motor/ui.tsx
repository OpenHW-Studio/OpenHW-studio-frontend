import React from 'react';

export const MotorUI = ({ state, attrs }: { state: any, attrs: any }) => {
    // state.speed gives rotations per second or just a speed factor (-1 to 1)
    const speed = state?.speed || 0;
    const animationDuration = speed === 0 ? '0s' : `${1 / Math.abs(speed)}s`;
    const direction = speed < 0 ? 'reverse' : 'normal';

    return (
        <div style={{ position: 'relative', width: 60, height: 60, pointerEvents: 'none' }}>
            {/* Base */}
            <div style={{ position: 'absolute', left: 10, top: 5, width: 40, height: 50, background: '#bdc3c7', borderRadius: 8, border: '2px solid #7f8c8d' }} />
            {/* Shaft */}
            <div style={{ position: 'absolute', left: 26, top: -5, width: 8, height: 10, background: '#95a5a6' }} />
            {/* Terminals */}
            <div style={{ position: 'absolute', left: -5, top: 18, width: 15, height: 6, background: '#e74c3c' }} />
            <div style={{ position: 'absolute', left: -5, top: 38, width: 15, height: 6, background: '#34495e' }} />

            {/* Rotating part (visual representation of spin) */}
            <div style={{
                position: 'absolute', left: 15, top: 15, width: 30, height: 30,
                borderRadius: '50%', border: '4px dashed #34495e',
                animation: speed !== 0 ? `spin ${animationDuration} linear infinite ${direction}` : 'none'
            }} />

            <style>
                {`
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                `}
            </style>
        </div>
    );
};
