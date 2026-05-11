import React, { useState } from 'react';

// Physical simulator bounding box perfectly mapped to the new SVG half-scale
export const BOUNDS = { x: 0, y: 0, w: 80, h: 160 };

export const NTCComparatorContextMenu = ({ attrs, onUpdate }: { attrs: any; onUpdate: (key: string, value: any) => void }) => (
    <>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Simulated Temp (°C):</span>
        <input
            type="number"
            value={attrs?.temperature ?? '25'}
            step="1"
            onChange={e => onUpdate('temperature', e.target.value)}
            style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: 2, outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Pot. Threshold (0-1023):</span>
        <input
            type="number"
            value={attrs?.threshold ?? '512'}
            step="16"
            min="0"
            max="1023"
            onChange={e => onUpdate('threshold', e.target.value)}
            style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: 2, outline: 'none' }}
        />
    </>
);

export const NTCComparatorUI = ({ state, attrs, onEvent }: { state: any; attrs: any; onEvent?: (event: any) => void }) => {
    const powered = state?.powered ?? false;
    const transmitting = state?.transmitting ?? false; // DO LED state
    const [potRotation, setPotRotation] = useState(0);

    const handlePotClick = () => {
        const nextRotation = (potRotation + 45) % 360;
        setPotRotation(nextRotation);
        onEvent?.({ type: 'POT_CLICK', rotation: nextRotation });
    };

    return (
        <div style={{ position: 'relative', width: 80, height: 160 }}>
            <svg
                viewBox="0 0 160 320"
                width="100%"
                height="100%"
                style={{ cursor: 'pointer', display: 'block' }}
                onClick={() => onEvent?.({ type: 'NTC_CLICK' })}
            >
                {/* PCB Base */}
                <rect x="20" y="50" width="120" height="200" rx="6" fill="#004e98" stroke="#003b73" strokeWidth="2" />
                <rect x="24" y="54" width="112" height="192" rx="4" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.5" />
                
                {/* PCB Traces */}
                <path d="M 40 240 L 40 200 L 60 180 M 66 240 L 66 190 L 80 170 M 92 240 L 92 210 L 100 200 M 118 240 L 118 180" fill="none" stroke="#337ab7" strokeWidth="2" />
                
                {/* Header Plastic Block */}
                <rect x="25" y="245" width="110" height="15" rx="1" fill="#111111" />
                
                {/* Copper Pads */}
                <rect x="35" y="235" width="10" height="10" rx="1" fill="#eab308" />
                <rect x="61" y="235" width="10" height="10" rx="1" fill="#eab308" />
                <rect x="87" y="235" width="10" height="10" rx="1" fill="#eab308" />
                <rect x="113" y="235" width="10" height="10" rx="1" fill="#eab308" />
                
                {/* Silver Header Pins */}
                <rect x="37" y="260" width="6" height="45" rx="1" fill="#cbd5e1" />
                <rect x="63" y="260" width="6" height="45" rx="1" fill="#cbd5e1" />
                <rect x="89" y="260" width="6" height="45" rx="1" fill="#cbd5e1" />
                <rect x="115" y="260" width="6" height="45" rx="1" fill="#cbd5e1" />
                
                {/* Labels */}
                <text x="40" y="228" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">A0</text>
                <text x="66" y="228" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">D0</text>
                <text x="92" y="228" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">GND</text>
                <text x="118" y="228" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">VCC</text>
                
                {/* Mounting Hole */}
                <circle cx="80" cy="185" r="14" fill="#222222" />
                <circle cx="80" cy="185" r="17" fill="none" stroke="#eab308" strokeWidth="3" />
                
                {/* Potentiometer (3296W type) */}
                <rect x="55" y="65" width="50" height="35" fill="#1d4ed8" rx="2" />
                <circle cx="90" cy="75" r="6" fill="#facc15" stroke="#ca8a04" strokeWidth="1" onClick={handlePotClick}/>
                <line x1="86" y1="75" x2="94" y2="75" stroke="#a16207" strokeWidth="1.5" transform={`rotate(${potRotation} 90 75)`} />
                
                {/* LM393 IC */}
                <path d="M 55 120 L 65 120 M 55 128 L 65 128 M 55 136 L 65 136 M 55 144 L 65 144" stroke="#94a3b8" strokeWidth="3" />
                <path d="M 95 120 L 105 120 M 95 128 L 105 128 M 95 136 L 105 136 M 95 144 L 105 144" stroke="#94a3b8" strokeWidth="3" />
                <rect x="65" y="115" width="30" height="40" fill="#1e293b" rx="2" />
                <circle cx="70" cy="120" r="2" fill="#475569" />
                <text x="80" y="135" fill="#64748b" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle" transform="rotate(-90 80 135)">LM393</text>
                
                {/* SMD LEDs */}
                <rect x="32" y="125" width="10" height="16" fill="#f1f5f9" rx="1" />
                <rect x="32" y="129" width="10" height="8" fill={powered ? "#ef4444" : "#7f1d1d"} />
                <text x="37" y="118" fill="#ffffff" fontSize="7" fontFamily="sans-serif" textAnchor="middle">PWR</text>
                
                <rect x="118" y="125" width="10" height="16" fill="#f1f5f9" rx="1" />
                <rect x="118" y="129" width="10" height="8" fill={transmitting ? "#22c55e" : "#14532d"} />
                <text x="123" y="118" fill="#ffffff" fontSize="7" fontFamily="sans-serif" textAnchor="middle">DO</text>
                
                {/* NTC Thermistor */}
                <path d="M 60 50 L 60 20 M 100 50 L 100 20" stroke="#94a3b8" strokeWidth="4" />
                <ellipse cx="80" cy="15" rx="22" ry="14" fill="#0f172a" />
            </svg>
        </div>
    );
};