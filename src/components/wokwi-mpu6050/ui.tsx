import React from 'react';

// Tighter bounds to fit the bare board
export const BOUNDS = { x: 0, y: 0, w: 126, h: 180 };

export const MPU6050ContextMenu = ({
    attrs,
    onUpdate,
}: {
    attrs: any;
    onUpdate: (key: string, value: any) => void;
}) => (
    <>
        <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 'bold' }}>Accelerometer (g):</span>
        <div style={{ display: 'flex', gap: 4 }}>
            {['accelX', 'accelY', 'accelZ'].map(k => (
                <input key={k} type="number" step="0.1" min="-4" max="4"
                    placeholder={k.replace('accel', '')}
                    value={attrs?.[k] ?? (k === 'accelZ' ? '1' : '0')}
                    onChange={e => onUpdate(k, e.target.value)}
                    style={{ width: 42, background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', outline: 'none', fontSize: 11 }}
                />
            ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 'bold', marginTop: 4 }}>Gyroscope (°/s):</span>
        <div style={{ display: 'flex', gap: 4 }}>
            {['gyroX', 'gyroY', 'gyroZ'].map(k => (
                <input key={k} type="number" step="1" min="-250" max="250"
                    placeholder={k.replace('gyro', '')}
                    value={attrs?.[k] ?? '0'}
                    onChange={e => onUpdate(k, e.target.value)}
                    style={{ width: 42, background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', outline: 'none', fontSize: 11 }}
                />
            ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>Temperature (°C):</span>
        <input type="number" step="1" min="-40" max="85"
            value={attrs?.temperature ?? '25'}
            onChange={e => onUpdate('temperature', e.target.value)}
            style={{ width: 60, background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', outline: 'none', fontSize: 11 }}
        />
    </>
);

export const MPU6050UI = ({
    state,
    attrs,
}: {
    state: any;
    attrs: any;
}) => {
    // Gracefully handle live state or fallback to static attributes
    const powered = state?.powered ?? false;
    const ax = parseFloat(state?.accelX ?? attrs?.accelX ?? 0).toFixed(1);
    const ay = parseFloat(state?.accelY ?? attrs?.accelY ?? 0).toFixed(1);
    const az = parseFloat(state?.accelZ ?? attrs?.accelZ ?? 1).toFixed(1);
    const gx = parseFloat(state?.gyroX  ?? attrs?.gyroX ?? 0).toFixed(0);
    const gy = parseFloat(state?.gyroY  ?? attrs?.gyroY ?? 0).toFixed(0);
    const gz = parseFloat(state?.gyroZ  ?? attrs?.gyroZ ?? 0).toFixed(0);
    const temp = parseFloat(state?.temperature ?? attrs?.temperature ?? 25).toFixed(1);

    return (
        <div style={{ position: 'relative', width: 126, height: 180 }}>
            <svg width="126" height="180" viewBox="0 0 126 180" style={{ fontFamily: 'sans-serif' }}>
                {/* Main Blue PCB */}
                <rect x="0" y="0" width="126" height="180" rx="4" fill="#0d47a1" />
                <rect x="0" y="0" width="126" height="180" rx="4" fill="none" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="1" />

                {/* Mounting Holes (Right side only) */}
                <circle cx="114" cy="14" r="4.5" fill="#0f172a" stroke="#d1d5db" strokeWidth="1.5"/>
                <circle cx="114" cy="166" r="4.5" fill="#0f172a" stroke="#d1d5db" strokeWidth="1.5"/>

                {/* Left Through-Hole Pads */}
                {[20, 40, 60, 80, 100, 120, 140, 160].map(y => (
                    <circle key={`pin-${y}`} cx="8" cy={y} r="3.5" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.5" />
                ))}

                {/* Left Silkscreen Pin Labels */}
                <g fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="start">
                    <text x="16" y={20 + 3}>VCC</text>
                    <text x="16" y={40 + 3}>GND</text>
                    <text x="16" y={60 + 3}>SCL</text>
                    <text x="16" y={80 + 3}>SDA</text>
                    <text x="16" y={100 + 3}>XDA</text>
                    <text x="16" y={120 + 3}>XCL</text>
                    <text x="16" y={140 + 3}>ADO</text>
                    <text x="16" y={160 + 3}>INT</text>
                </g>

                {/* Silkscreen Label ITG/MPU */}
                <text x="120" y="90" transform="rotate(-90 120 90)" textAnchor="middle" fontSize="8.5" fill="#ffffff" fontWeight="bold" letterSpacing="1">ITG/MPU</text>

                {/* XYZ Axis Indicator at the Bottom Center */}
                <g stroke="#ffffff" strokeWidth="1" fill="none">
                    {/* X Arrow */}
                    <path d="M 66 155 L 86 155 m -4 -3 l 4 3 l -4 3" strokeLinecap="round" strokeLinejoin="round" />
                    <text x="91" y="157" fill="#ffffff" fontSize="6" stroke="none" fontWeight="bold">X</text>
                    {/* Y Arrow */}
                    <path d="M 66 155 L 66 135 m -3 4 l 3 -4 l 3 4" strokeLinecap="round" strokeLinejoin="round" />
                    <text x="64" y="130" fill="#ffffff" fontSize="6" stroke="none" fontWeight="bold">Y</text>
                    {/* Z Circle */}
                    <circle cx="66" cy="155" r="3" />
                    <circle cx="66" cy="155" r="0.5" fill="#ffffff" stroke="none" />
                </g>

                {/* MPU-6050 Chip */}
                <rect x="38" y="70" width="36" height="36" rx="1.5" fill="#1e1e1e" />
                {/* Chip Pins */}
                <path d="M 36 75 v 26 m 40 -26 v 26 m -33 -7 h 26 m -26 40 h 26" stroke="#888" strokeWidth="1.5" strokeDasharray="1, 2"/>
                <circle cx="42" cy="74" r="1.5" fill="#333" />
                <text x="56" y="85" textAnchor="middle" fontSize="4" fill="#aaa">INVENSENSE</text>
                <text x="56" y="92" textAnchor="middle" fontSize="4.5" fill="#e2e8f0">MPU-6050</text>

                {/* Yellow/Tan Tantalum Capacitor */}
                <rect x="81" y="78" width="10" height="20" rx="1" fill="#d4ac0d" />
                <rect x="81" y="78" width="10" height="4" fill="#b7950b" />

                {/* Top Voltage Regulator & Capacitors */}
                <rect x="54" y="24" width="8" height="14" fill="#111" />
                <path d="M 52 26 v 10 m 12 -10 v 10" stroke="#888" strokeWidth="1.5" strokeDasharray="1, 2.5"/>
                <rect x="68" y="26" width="5" height="10" fill="#a8a29e" />
                <rect x="68" y="42" width="5" height="10" fill="#a8a29e" />

                {/* Digital HUD Screen */}
                <rect x="38" y="16" width="60" height="40" rx="3" fill="#0a0a0a" stroke="#333" strokeWidth="1" />
                <circle cx="92" cy="22" r="2.5" fill={powered ? '#2ecc71' : '#555'} stroke="#222" strokeWidth="0.5"/>
                
                <text x="42" y="26" fontSize="5" fill="#63b3ed" fontFamily="monospace">A:{ax},{ay},{az}g</text>
                <text x="42" y="36" fontSize="5" fill="#fc8181" fontFamily="monospace">G:{gx},{gy},{gz}°</text>
                <text x="42" y="46" fontSize="5" fill="#68d391" fontFamily="monospace">T:{temp}°C</text>
            </svg>
        </div>
    );
};