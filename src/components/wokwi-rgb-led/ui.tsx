import React from 'react';

export const RGBLEDUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const r = state?.r || 0;
    const g = state?.g || 0;
    const b = state?.b || 0;
    const isActive = r > 0 || g > 0 || b > 0;
    const baseColor = isActive ? `rgb(${r}, ${g}, ${b})` : '#e0e0e0';

    return (
        <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(15, 12)">
                {/* Legs */}
                <path d="M -10 18 L -10 3" stroke="#95a5a6" strokeWidth="1" />
                <path d="M -3 18 L -3 0" stroke="#95a5a6" strokeWidth="1.5" />
                <path d="M 4 18 L 4 3" stroke="#95a5a6" strokeWidth="1" />
                <path d="M 11 18 L 11 3" stroke="#95a5a6" strokeWidth="1" />

                {/* Dome */}
                <path d="M -8 3 A 8 8 0 0 1 8 3 Z" fill={baseColor} opacity="0.9" />
                <rect x="-8" y="3" width="16" height="4" fill={baseColor} opacity="0.9" />
                <rect x="-9" y="7" width="18" height="2" fill={baseColor} />

                {/* Reflection effect */}
                <path d="M -4 -1 A 4 4 0 0 1 0 -3 A 6 6 0 0 0 -5 2 Z" fill="white" opacity="0.4" />

                {/* Active glow */}
                {isActive && (
                    <circle cx="0" cy="0" r="12" fill={baseColor} opacity="0.4" style={{ filter: 'blur(3px)' }} />
                )}
            </g>

            <circle cx="5" cy="30" r="1.5" fill="#e74c3c" />
            <circle cx="12" cy="30" r="1.5" fill="#34495e" />
            <circle cx="19" cy="30" r="1.5" fill="#2ecc71" />
            <circle cx="26" cy="30" r="1.5" fill="#3498db" />
        </svg>
    );
};
