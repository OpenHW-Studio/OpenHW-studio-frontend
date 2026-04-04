import React from 'react';

export const RGBLEDUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const r = state?.r || 0;
    const g = state?.g || 0;
    const b = state?.b || 0;
    const isActive = r > 0 || g > 0 || b > 0;
    const baseColor = isActive ? `rgb(${r}, ${g}, ${b})` : '#e0e0e0';

    return (
        <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id={`led-body-${state.id || 'default'}`} cx="50%" cy="40%" r="50%" fx="35%" fy="35%">
                    <stop offset="0%" stopColor="white" stopOpacity="0.4" />
                    <stop offset="40%" stopColor={baseColor} stopOpacity="1" />
                    <stop offset="100%" stopColor={baseColor} stopOpacity="0.8" />
                </radialGradient>
                <linearGradient id={`leg-shadow-${state.id || 'default'}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7f8c8d" />
                    <stop offset="50%" stopColor="#bdc3c7" />
                    <stop offset="100%" stopColor="#95a5a6" />
                </linearGradient>
            </defs>

            <g transform="translate(15, 12)">
                {/* Legs */}
                <rect x="-10.5" y="3" width="1" height="15" fill={`url(#leg-shadow-${state.id || 'default'})`} />
                <rect x="-3.5" y="0" width="1.5" height="18" fill={`url(#leg-shadow-${state.id || 'default'})`} />
                <rect x="3.5" y="3" width="1" height="15" fill={`url(#leg-shadow-${state.id || 'default'})`} />
                <rect x="10.5" y="3" width="1" height="15" fill={`url(#leg-shadow-${state.id || 'default'})`} />

                {/* Main Dome Body */}
                <path
                    d="M -8 3 A 8 8 0 0 1 8 3 L 8 7 L -8 7 Z"
                    fill={`url(#led-body-${state.id || 'default'})`}
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth="0.5"
                />
                <rect x="-9" y="7" width="18" height="2" rx="0.5" fill={baseColor} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />

                {/* Glossy Top Highlight */}
                <path d="M -5 -2 A 5 5 0 0 1 2 -3" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />

                {/* Active glow effects */}
                {isActive && (
                    <g opacity="0.6">
                        <circle cx="0" cy="0" r="14" fill={baseColor} style={{ filter: 'blur(5px)' }} />
                        <circle cx="0" cy="0" r="8" fill="white" style={{ filter: 'blur(4px)' }} opacity="0.3" />
                    </g>
                )}
            </g>

            {/* Pin Indicators */}
            <circle cx="5" cy="30" r="1.5" fill="#e74c3c" />
            <circle cx="12" cy="30" r="1.5" fill="#34495e" />
            <circle cx="19" cy="30" r="1.5" fill="#2ecc71" />
            <circle cx="26" cy="30" r="1.5" fill="#3498db" />
        </svg>
    );
};
