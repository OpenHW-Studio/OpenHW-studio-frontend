import React from 'react';

export const PhotoresistorUI = ({ state, attrs, onAttrChange, isRunning }: { state: any, attrs: any, onAttrChange?: (key: string, val: any) => void, isRunning: boolean }) => {
    const lux = attrs?.lux ?? 500;

    const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onAttrChange) {
            onAttrChange('lux', e.target.value);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30px', position: 'relative' }}>
            <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                <defs>
                    <radialGradient id="ceramicGrad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" style={{ stopColor: '#f9f9f9', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: '#e0e0e0', stopOpacity: 1 }} />
                    </radialGradient>
                    <linearGradient id="pinGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style={{ stopColor: '#bdc3c7', stopOpacity: 1 }} />
                        <stop offset="50%" style={{ stopColor: '#ecf0f1', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: '#95a5a6', stopOpacity: 1 }} />
                    </linearGradient>
                </defs>

                {/* Pins */}
                <rect x="4" y="15" width="2" height="15" fill="url(#pinGrad)" />
                <rect x="24" y="15" width="2" height="15" fill="url(#pinGrad)" />

                {/* Ceramic Substrate */}
                <circle cx="15" cy="15" r="10" fill="url(#ceramicGrad)" stroke="#bdc3c7" strokeWidth="0.5" />
                <circle cx="15" cy="15" r="8" fill="none" stroke="#dcdde1" strokeWidth="1" strokeDasharray="1,1" />

                {/* CdS Zigzag Track */}
                <path 
                    d="M 10 12 L 20 12 L 10 14 L 20 14 L 10 16 L 20 16 L 10 18 L 20 18" 
                    fill="none" 
                    stroke="#e67e22" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ opacity: 0.9 + (lux / 2000) }}
                />
                
                {/* Metallic Electrodes */}
                <path d="M 8 10 L 12 10" stroke="#7f8c8d" strokeWidth="2" strokeLinecap="round" />
                <path d="M 18 20 L 22 20" stroke="#7f8c8d" strokeWidth="2" strokeLinecap="round" />
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
                        <span>Light</span>
                        <span>{lux} lx</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max="1000" 
                        value={lux} 
                        onChange={handleSlider}
                        style={{ width: '80px', height: '4px', cursor: 'pointer' }}
                    />
                </div>
            )}
        </div>
    );
};

export const BOUNDS = { x: 0, y: 0, w: 30, h: 30 };
