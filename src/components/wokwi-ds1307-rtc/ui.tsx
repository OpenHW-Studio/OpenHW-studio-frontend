import React from 'react';

// Expanded bounds for longer pins to keep hover boxes away from text
export const BOUNDS = { x: 0, y: 0, w: 160, h: 160 };

export const DS1307RTCContextMenu = ({
    attrs,
    onUpdate,
}: {
    attrs: any;
    onUpdate: (key: string, value: any) => void;
}) => (
    <>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Date &amp; Time:</span>
        <input
            type="datetime-local"
            value={(attrs?.datetime ?? '2024-01-01T00:00:00').slice(0, 16)}
            onChange={e => onUpdate('datetime', e.target.value + ':00')}
            style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', outline: 'none', fontSize: 11 }}
        />
    </>
);

export const DS1307RTCUI = ({
    state,
    attrs,
    onEvent,
}: {
    state: any;
    attrs: any;
    onEvent?: (event: any) => void;
}) => {
    const powered = state?.powered ?? false;
    const display = state?.display ?? '2024-01-01 00:00:00';
    const [datePart, timePart] = display.split(' ');

    return (
        <div style={{ position: 'relative', width: 160, height: 160 }}>
            <svg width="160" height="160" viewBox="0 0 160 160" style={{ fontFamily: 'sans-serif' }}>
                {/* PCB Base - Centered, leaving 20px on each side for the long gold pins */}
                <rect x="20" y="0" width="120" height="160" rx="4" fill="#184a8c" />
                <rect x="20" y="0" width="120" height="160" rx="4" fill="none" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="1" />

                {/* Mounting Holes */}
                <circle cx="28" cy="10" r="3.5" fill="#0f172a" stroke="#d1d5db" strokeWidth="1"/>
                <circle cx="132" cy="150" r="3.5" fill="#0f172a" stroke="#d1d5db" strokeWidth="1"/>
                <circle cx="28" cy="150" r="3.5" fill="#0f172a" stroke="#d1d5db" strokeWidth="1"/>

                {/* Top Title */}
                <text x="80" y="16" textAnchor="middle" fontSize="10" fill="#ffffff" fontWeight="bold">Tiny RTC I2C</text>

                {/* Left Pins (Gold) & Holes - Extended to x=0 */}
                {[40, 60, 80, 100, 120].map(y => (
                    <circle key={`lpad-${y}`} cx="26" cy={y} r="2.5" fill="#0f172a" stroke="#fbbf24" strokeWidth="0.8" />
                ))}

                {/* Left Silkscreen - Pushed safely inward away from the hover zone */}
                <text x="34" y="42.5" textAnchor="start" fontSize="6.5" fill="#ffffff" fontWeight="bold">DS</text>
                <text x="34" y="62.5" textAnchor="start" fontSize="6.5" fill="#ffffff" fontWeight="bold">SCL</text>
                <text x="34" y="82.5" textAnchor="start" fontSize="6.5" fill="#ffffff" fontWeight="bold">SDA</text>
                <text x="34" y="102.5" textAnchor="start" fontSize="6.5" fill="#ffffff" fontWeight="bold">VCC</text>
                <text x="34" y="122.5" textAnchor="start" fontSize="6.5" fill="#ffffff" fontWeight="bold">GND</text>

                {/* Right Pins (Gold) & Holes - Extended to x=160 */}
                {[20, 40, 60, 80, 100, 120, 140].map(y => (
                    <circle key={`rpad-${y}`} cx="134" cy={y} r="2.5" fill="#0f172a" stroke="#fbbf24" strokeWidth="0.8" />
                ))}

                {/* Right Silkscreen - Pushed safely inward */}
                <text x="126" y="22.5" textAnchor="end" fontSize="6.5" fill="#ffffff" fontWeight="bold">SQ</text>
                <text x="126" y="42.5" textAnchor="end" fontSize="6.5" fill="#ffffff" fontWeight="bold">DS</text>
                <text x="126" y="62.5" textAnchor="end" fontSize="6.5" fill="#ffffff" fontWeight="bold">SCL</text>
                <text x="126" y="82.5" textAnchor="end" fontSize="6.5" fill="#ffffff" fontWeight="bold">SDA</text>
                <text x="126" y="102.5" textAnchor="end" fontSize="6.5" fill="#ffffff" fontWeight="bold">VCC</text>
                <text x="126" y="122.5" textAnchor="end" fontSize="6.5" fill="#ffffff" fontWeight="bold">GND</text>
                <text x="126" y="142.5" textAnchor="end" fontSize="6.5" fill="#ffffff" fontWeight="bold">BAT</text>

                {/* Crystal (X1) */}
                <rect x="54" y="25" width="14" height="34" rx="7" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.5" />
                <path d="M 58 59 L 58 68 M 64 59 L 64 68" stroke="#94a3b8" strokeWidth="2" />
                <text x="51" y="38" textAnchor="end" fontSize="5.5" fill="#ffffff">X1</text>

                {/* Diode D1 */}
                <rect x="85" y="26" width="18" height="7" fill="#ef4444" stroke="#7f1d1d" strokeWidth="0.5"/>
                <rect x="99" y="26" width="4" height="7" fill="#111" />
                <text x="82" y="30" textAnchor="end" fontSize="5.5" fill="#ffffff">D1</text>
                
                {/* SMD Resistors/Caps */}
                <g fill="#111" stroke="#333" strokeWidth="0.5">
                    <rect x="85" y="42" width="10" height="5" rx="1"/>
                    <rect x="85" y="52" width="10" height="5" rx="1"/>
                    <rect x="85" y="62" width="10" height="5" rx="1"/>
                    <rect x="75" y="42" width="5" height="10" rx="1"/>
                    <rect x="75" y="57" width="5" height="10" rx="1"/>
                </g>

                {/* U1: DS1307 Chip */}
                <rect x="44" y="82" width="20" height="16" rx="1" fill="#1e1e1e" />
                <text x="54" y="92" textAnchor="middle" fontSize="4.5" fill="#888">DS1307</text>
                <text x="42" y="92" textAnchor="end" fontSize="5" fill="#ffffff">U1</text>

                {/* U2: 24C32 EEPROM Chip */}
                <rect x="96" y="82" width="20" height="16" rx="1" fill="#1e1e1e" />
                <text x="106" y="92" textAnchor="middle" fontSize="4.5" fill="#888">24C32</text>
                <text x="118" y="92" textAnchor="start" fontSize="5" fill="#ffffff">U2</text>

                {/* Digital Screen (To display the time in simulator) - Scaled down and centered */}
                <rect x="55" y="122" width="50" height="16" rx="1.5" fill="#0a0a0a" stroke="#111" strokeWidth="1" />
                <text x="80" y="130" textAnchor="middle" fontSize="6" fill={powered ? '#2ecc71' : '#14532d'} fontFamily="monospace" fontWeight="bold">
                    {timePart ?? '00:00:00'}
                </text>
                <text x="80" y="136" textAnchor="middle" fontSize="4.5" fill={powered ? '#68d391' : '#052e16'} fontFamily="monospace">
                    {datePart ?? '2024-01-01'}
                </text>
            </svg>
        </div>
    );
};