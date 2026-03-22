import React from 'react';

// TT Gear motor dimensions
export const BOUNDS = { x: 0, y: 0, w: 100, h: 50 };

export const MotorUI = ({ state, attrs }: { state: any, attrs: any }) => {
    // state.speed gives rotations per second or speed factor (-1 to 1)
    const speed = state?.speed || 0;
    const animationDuration = speed === 0 ? '0s' : `${Math.abs(1 / speed)}s`;
    const direction = speed < 0 ? 'reverse' : 'normal';

    return (
        <div style={{ position: 'relative', width: BOUNDS.w, height: BOUNDS.h, pointerEvents: 'none' }}>
            <svg width="100" height="50" viewBox="0 0 100 50">
                {/* Rear Black Housing */}
                <rect x="0" y="5" width="20" height="40" rx="3" fill="#222" />
                {/* Yellow Plastic Gearbox Body */}
                <rect x="20" y="5" width="60" height="40" rx="4" fill="#F1C40F" />
                <rect x="25" y="10" width="10" height="30" rx="2" fill="#F39C12" />
                <rect x="65" y="10" width="10" height="30" rx="2" fill="#F39C12" />

                {/* Rivets / Detail */}
                <circle cx="28" cy="15" r="1.5" fill="#333" />
                <circle cx="28" cy="35" r="1.5" fill="#333" />
                <circle cx="72" cy="15" r="1.5" fill="#333" />
                <circle cx="72" cy="35" r="1.5" fill="#333" />

                {/* Terminals (Red & Black) */}
                <path d="M 0 15 L -10 15" stroke="#E74C3C" strokeWidth="2" strokeLinecap="round" />
                <path d="M 0 35 L -10 35" stroke="#2C3E50" strokeWidth="2" strokeLinecap="round" />

                {/* White Plastic Shaft */}
                <rect x="80" y="18" width="12" height="14" rx="2" fill="#ECF0F1" />
                {/* Shaft Flat Ends */}
                <rect x="85" y="15" width="2" height="20" fill="#BDC3C7" />

                {/* Rubber Tire Wheel Wrapper for CSS Animation */}
                <foreignObject x="65" y="-10" width="70" height="70">
                    <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {/* Wheel Element */}
                        <div style={{
                            width: 60, height: 60,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, #E67E22 20%, #34495E 25%, #2C3E50 100%)',
                            border: '5px solid #111',
                            position: 'relative',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                            animation: speed !== 0 ? `spin ${animationDuration} linear infinite ${direction}` : 'none'
                        }}>
                            {/* Wheel Treads representing motion */}
                            <div style={{ position: 'absolute', top: 5, left: '50%', width: 4, height: 10, background: '#111', marginLeft: -2 }} />
                            <div style={{ position: 'absolute', bottom: 5, left: '50%', width: 4, height: 10, background: '#111', marginLeft: -2 }} />
                            <div style={{ position: 'absolute', left: 5, top: '50%', width: 10, height: 4, background: '#111', marginTop: -2 }} />
                            <div style={{ position: 'absolute', right: 5, top: '50%', width: 10, height: 4, background: '#111', marginTop: -2 }} />
                        </div>
                    </div>
                </foreignObject>
            </svg>

            <style>
                {`
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                `}
            </style>
        </div>
    );
};
