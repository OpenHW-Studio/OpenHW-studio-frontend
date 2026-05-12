import React from 'react';

export const NtcUI = ({ state, attrs, onAttrChange, isRunning }: { state: any, attrs: any, onAttrChange?: (key: string, val: any) => void, isRunning: boolean }) => {
    const temp = attrs?.temperature ?? 25;

    const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onAttrChange) {
            onAttrChange('temperature', e.target.value);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30px', position: 'relative' }}>
            <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                <defs>
                    <radialGradient id="beadGrad" cx="40%" cy="30%" r="60%" fx="40%" fy="30%">
                        <stop offset="0%" style={{ stopColor: '#3498db', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: '#1a5276', stopOpacity: 1 }} />
                    </radialGradient>
                    <radialGradient id="beadHighlight" cx="30%" cy="20%" r="50%">
                        <stop offset="0%" style={{ stopColor: 'white', stopOpacity: 0.4 }} />
                        <stop offset="100%" style={{ stopColor: 'white', stopOpacity: 0 }} />
                    </radialGradient>
                </defs>

                {/* Pins */}
                <path d="M 12 15 L 6 30" stroke="#bdc3c7" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 18 15 L 24 30" stroke="#bdc3c7" strokeWidth="1.5" strokeLinecap="round" />

                {/* Epoxy Bead */}
                <path 
                    d="M 15 5 C 10 5, 8 10, 10 15 C 12 20, 18 20, 20 15 C 22 10, 20 5, 15 5 Z" 
                    fill="url(#beadGrad)" 
                    stroke="#2980b9" 
                    strokeWidth="0.5" 
                />
                
                {/* Glossy Highlight */}
                <ellipse cx="13" cy="10" rx="3" ry="4" fill="url(#beadHighlight)" transform="rotate(-20, 13, 10)" />
            </svg>

            {/* Hidden simulation slider (only shows when running) */}
            {isRunning && (
                <div style={{ 
                    position: 'absolute', 
                    top: '-45px', 
                    background: 'rgba(0,0,0,0.85)', 
                    padding: '6px 10px', 
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    pointerEvents: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}
                onMouseDown={(e) => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span>Temp</span>
                        <span>{temp}°C</span>
                    </div>
                    <input 
                        type="range" 
                        min="-40" 
                        max="125" 
                        value={temp} 
                        onChange={handleSlider}
                        style={{ width: '80px', height: '4px', cursor: 'pointer' }}
                    />
                </div>
            )}
        </div>
    );
};

export const BOUNDS = { x: 0, y: 0, w: 30, h: 30 };
