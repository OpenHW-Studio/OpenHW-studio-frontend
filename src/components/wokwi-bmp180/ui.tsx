import React, { useState } from 'react';

// Defines the physical bounds for the simulator engine
export const BOUNDS = { x: 0, y: 0, w: 72, h: 50 };

// Context menu for part attributes (e.g., setting simulated readings)
export const BMP180ContextMenu = ({ attrs, onUpdate }: { attrs: any; onUpdate: (key: string, value: any) => void }) => (
    <>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Simulated Pressure (hPa):</span>
        <input
            type="number"
            value={attrs?.pressure ?? '1013.25'}
            step="0.1"
            onChange={e => onUpdate('pressure', e.target.value)}
            style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: 2, outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Simulated Temperature (°C):</span>
        <input
            type="number"
            value={attrs?.temperature ?? '25.0'}
            step="0.1"
            onChange={e => onUpdate('temperature', e.target.value)}
            style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: 2, outline: 'none' }}
        />
    </>
);

export const BMP180UI = ({ state, attrs, onEvent }: { state: any; attrs: any; onEvent?: (event: any) => void }) => {
    // Simulator states for visual feedback
    const pressure = state?.pressure ?? attrs?.pressure ?? 1013.25;
    const temperature = state?.temperature ?? attrs?.temperature ?? 25.0;

    return (
        <div style={{ position: 'relative', width: 72, height: 50 }}>
            <svg
                viewBox="0 0 72 50"
                width="100%"
                height="100%"
                style={{ cursor: 'pointer', display: 'block' }}
            >
                {/* Red PCB Background */}
                <rect x="1" y="1" width="70" height="48" rx="3" ry="3" fill="#B32424" stroke="#801919" strokeWidth="0.5" />

                {/* Mounting Holes */}
                <circle cx="8" cy="8" r="3.5" fill="#1e293b" />
                <circle cx="8" cy="8" r="2.5" fill="#e2e8f0" />
                <circle cx="64" cy="8" r="3.5" fill="#1e293b" />
                <circle cx="64" cy="8" r="2.5" fill="#e2e8f0" />

                {/* Trace routing (faint lines) */}
                <path d="M 10 20 L 10 40 M 25 20 L 25 40 M 40 20 L 40 40 M 55 20 L 55 40" fill="none" stroke="#60a5fa" strokeWidth="0.5" opacity="0.4" />

                {/* --- Components --- */}

                {/* Voltage Regulator (3.3V IC) */}
                <rect x="10" y="15" width="6" height="6" rx="0.5" fill="#1f2937" />
                <rect x="9.5" y="16" width="1" height="1" fill="#94a3b8" />
                <rect x="9.5" y="19" width="1" height="1" fill="#94a3b8" />
                <rect x="15.5" y="17.5" width="1" height="1" fill="#94a3b8" />

                {/* SMD Passives (Resistors & Capacitors) */}
                {/* Cluster 1 */}
                <rect x="20" y="15" width="2.5" height="4" fill="#94a3b8" rx="0.2" />
                <rect x="20" y="15" width="2.5" height="1" fill="#475569" rx="0.2" />
                <rect x="20" y="18" width="2.5" height="1" fill="#475569" rx="0.2" />

                <rect x="24" y="15" width="2.5" height="4" fill="#94a3b8" rx="0.2" />
                <rect x="24" y="15" width="2.5" height="1" fill="#475569" rx="0.2" />
                <rect x="24" y="18" width="2.5" height="1" fill="#475569" rx="0.2" />

                {/* Cluster 2 */}
                <rect x="42" y="15" width="2.5" height="4" fill="#94a3b8" rx="0.2" />
                <rect x="42" y="15" width="2.5" height="1" fill="#475569" rx="0.2" />
                <rect x="42" y="18" width="2.5" height="1" fill="#475569" rx="0.2" />

                <rect x="46" y="15" width="2.5" height="4" fill="#94a3b8" rx="0.2" />
                <rect x="46" y="15" width="2.5" height="1" fill="#475569" rx="0.2" />
                <rect x="46" y="18" width="2.5" height="1" fill="#475569" rx="0.2" />

                {/* BMP180 Sensor Package (Silver square with hole) */}
                <rect x="52" y="17" width="12" height="12" rx="1" ry="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.5" />
                <rect x="53" y="18" width="10" height="10" rx="0.5" ry="0.5" fill="#e2e8f0" />
                {/* Pressure port hole */}
                <circle cx="55.5" cy="25.5" r="1.5" fill="#020617" />
                {/* Silicon markings (simulated) */}
                <rect x="58" y="20" width="3" height="3" fill="#475569" />
                <rect x="58.5" y="20.5" width="2" height="2" fill="#1e293b" />
                {/* Label on sensor package */}
                <text x="58" y="19.5" fontFamily="sans-serif" fontSize="2.2" fill="#64748b" textAnchor="middle">BMP180</text>

                {/* --- Bottom Pins & Headers --- */}

                {/* Pin Headers Silkscreen Labels */}
                <text x="10" y="44" fontFamily="monospace" fontSize="4.5" fontWeight="bold" fill="#f8fafc" textAnchor="middle">VIN</text>
                <text x="25" y="44" fontFamily="monospace" fontSize="4.5" fontWeight="bold" fill="#f8fafc" textAnchor="middle">GND</text>
                <text x="40" y="44" fontFamily="monospace" fontSize="4.5" fontWeight="bold" fill="#f8fafc" textAnchor="middle">SCL</text>
                <text x="55" y="44" fontFamily="monospace" fontSize="4.5" fontWeight="bold" fill="#f8fafc" textAnchor="middle">SDA</text>

                {/* Header structure */}
                <path d="M 5 46 L 60 46 M 5 49 L 60 49" fill="none" stroke="#f8fafc" strokeWidth="0.5" />

                {/* Pin Pads */}
                {[10, 25, 40, 55].map((x) => (
                    <circle key={x} cx={x} cy="48" r="1.5" fill="#FFD700" stroke="#B8860B" strokeWidth="0.3" />
                ))}

            </svg>
        </div>
    );
};