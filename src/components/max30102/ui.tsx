import React from 'react';

// ─── Selection & hit-box bounds ────────────────────────────────────────────────
export const BOUNDS = { x: 13, y: 7, w: 74, h: 56 };

// ─── Sync flags (required for ZIP / dynamic loader) ────────────────────────────
export const contextMenuDuringRun = true;
export const contextMenuOnlyDuringRun = true;

// ─────────────────────────────────────────────────────────────────────────────────
//  Main component UI
// ─────────────────────────────────────────────────────────────────────────────────
export const MAX30102UI = ({
    state,
    attrs,
    isRunning,
}: {
    state: any;
    attrs: any;
    isRunning: boolean;
}) => {
    const redLedOn = isRunning && !!state?.redLedOn;
    const irLedOn = isRunning && !!state?.irLedOn;

    const redFill = redLedOn ? '#FF0000' : '#8B0000';
    const redGlowId = 'max30102-red-glow';
    const irFill = irLedOn ? '#7B3F00' : '#222222';

    return (
        <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}>
            <svg
                width="100"
                height="70"
                viewBox="0 0 200 160"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: 'block' }}
            >
                <defs>
                    {/* ── Red LED glow filter ── */}
                    <filter id={redGlowId} x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>

                    {/* ── IR LED glow filter ── */}
                    <filter id="max30102-ir-glow" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>

                    {/* ── PCB cutout mask (verbatim from original SVG) ── */}
                    <mask id="max30102-pcb-mask">
                        <rect x="0" y="0" width="200" height="160" fill="white" />
                        {/* Slot mounts */}
                        <rect x="18" y="40" width="8" height="80" rx="4" fill="black" />
                        <rect x="174" y="40" width="8" height="80" rx="4" fill="black" />
                        {/* Through-hole pads – inner pads */}
                        {[50, 83, 116, 150].map(cx => (
                            <React.Fragment key={`th-top-${cx}`}>
                                <circle cx={cx} cy={35} r={4} fill="black" />
                                <circle cx={cx} cy={125} r={4} fill="black" />
                            </React.Fragment>
                        ))}
                        {/* Through-hole pads – outer edge */}
                        {[50, 83, 116, 150].map(cx => (
                            <React.Fragment key={`th-edge-${cx}`}>
                                <circle cx={cx} cy={10} r={4.5} fill="black" />
                                <circle cx={cx} cy={150} r={4.5} fill="black" />
                            </React.Fragment>
                        ))}
                    </mask>
                </defs>

                <g mask="url(#max30102-pcb-mask)">
                    {/* ── PCB substrate ── */}
                    <rect x="10" y="10" width="180" height="140" rx="15" fill="#121212" />

                    {/* ── Slot mount outlines ── */}
                    <rect x="18" y="40" width="8" height="80" rx="4" fill="none" stroke="#D4AF37" strokeWidth="3" />
                    <rect x="174" y="40" width="8" height="80" rx="4" fill="none" stroke="#D4AF37" strokeWidth="3" />

                    {/* ── Inner via rings (both rows) ── */}
                    {[50, 83, 116, 150].map(cx => (
                        <React.Fragment key={`ring-${cx}`}>
                            <circle cx={cx} cy={35} r={5.5} fill="none" stroke="#D4AF37" strokeWidth="3" />
                            <circle cx={cx} cy={125} r={5.5} fill="none" stroke="#D4AF37" strokeWidth="3" />
                        </React.Fragment>
                    ))}

                    {/* ── Top connector pads (VIN / SCL / SDA / INT) ── */}
                    {[
                        { id: 'VIN', x: 42.5 }, { id: 'SCL', x: 75.5 },
                        { id: 'SDA', x: 108.5 }, { id: 'INT', x: 142.5 },
                    ].map(p => (
                        <g key={`pad-top-${p.id}`} id={`pin-${p.id}`}>
                            <rect x={p.x} y={10} width={15} height={14} fill="#D4AF37" />
                        </g>
                    ))}

                    {/* ── Bottom connector pads (IRD / RD / GND / NC) ── */}
                    {[
                        { id: 'IRD', x: 42.5 }, { id: 'RD', x: 75.5 },
                        { id: 'GND', x: 108.5 }, { id: 'NC', x: 142.5 },
                    ].map(p => (
                        <g key={`pad-bot-${p.id}`} id={`pin-${p.id}`}>
                            <rect x={p.x} y={136} width={15} height={14} fill="#D4AF37" />
                        </g>
                    ))}

                    {/* ── MAX30102 optical sensor IC package ── */}
                    <rect x="85" y="55" width="30" height="50" rx="2" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="2" />
                    {/* IC window */}
                    <rect x="90" y="65" width="20" height="30" fill="#050505" />

                    {/* ── RED LED (660 nm) – dynamic colour + glow ── */}
                    <rect
                        x="94" y="70" width="12" height="8"
                        fill={redFill}
                        filter={redLedOn ? `url(#${redGlowId})` : undefined}
                    />

                    {/* ── IR LED (880 nm) – subtle warm tint when active ── */}
                    <rect
                        x="94" y="82" width="12" height="10"
                        fill={irFill}
                        filter={irLedOn ? 'url(#max30102-ir-glow)' : undefined}
                    />

                    {/* IC lead fingers – left side */}
                    {[65, 75, 85].map(y => (
                        <rect key={`lead-l-${y}`} x="86" y={y} width="2" height="4" fill="#D4AF37" />
                    ))}
                    {/* IC lead fingers – right side */}
                    {[65, 75, 85].map(y => (
                        <rect key={`lead-r-${y}`} x="112" y={y} width="2" height="4" fill="#D4AF37" />
                    ))}

                    {/* ── Passive components (fixed decoration) ── */}
                    {/* 65K5 decoupling capacitor */}
                    <rect x="35" y="65" width="20" height="12" rx="1" fill="#222" />
                    <text x="45" y="73" fontSize="6" fill="#777" fontFamily="sans-serif" textAnchor="middle">65K5</text>
                    <rect x="35" y="50" width="10" height="6" fill="#C19A6B" />
                    <rect x="62" y="65" width="6" height="12" fill="#C19A6B" />

                    {/* 472Ω resistors */}
                    {[42, 56, 70].map(x => (
                        <g key={`res-${x}`}>
                            <rect x={x} y={95} width="8" height="14" fill="#111" stroke="#ccc" strokeWidth="1" />
                            <text
                                x={x + 4} y={104} fontSize="4" fill="#aaa" fontFamily="sans-serif"
                                textAnchor="middle"
                                transform={`rotate(-90 ${x + 4} 104)`}
                            >472</text>
                        </g>
                    ))}

                    {/* N1IF IC and surrounding caps */}
                    <rect x="135" y="85" width="20" height="14" rx="1" fill="#222" />
                    <text x="145" y="94" fontSize="6" fill="#777" fontFamily="sans-serif" textAnchor="middle">N1IF</text>
                    {[120, 135, 150].map(x => (
                        <rect key={`cap-${x}`} x={x} y={60} width="8" height="14" fill="#C19A6B" />
                    ))}
                    <rect x="125" y="85" width="6" height="12" fill="#C19A6B" />

                </g>
            </svg>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────────
//  Context Menu  (shown ONLY while simulation is running)
// ─────────────────────────────────────────────────────────────────────────────────
export const MAX30102ContextMenu = ({
    attrs,
    onUpdate,
}: {
    attrs: any;
    onUpdate: (key: string, value: any) => void;
}) => {
    const redVal = parseInt(attrs?.redLed ?? '0', 10) || 0;
    const irVal = parseInt(attrs?.irLed ?? '0', 10) || 0;

    const toMA = (v: number) => ((v / 255) * 50).toFixed(1);

    const handleRed = (v: number) => {
        onUpdate('redLed', v);
        attrs.onInteract?.({ type: 'SET_RED_LED', value: v });
    };

    const handleIr = (v: number) => {
        onUpdate('irLed', v);
        attrs.onInteract?.({ type: 'SET_IR_LED', value: v });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
            {/* ── Red LED — line 1: label ── */}
            <span style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                🔴 Red LED  660nm
            </span>
            {/* ── Red LED — line 2: slider + value ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                    type="range" min={0} max={255} value={redVal}
                    onChange={e => handleRed(parseInt(e.target.value, 10))}
                    onPointerDown={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    style={{ flex: 1, accentColor: '#FF0000', cursor: 'pointer' }}
                />
                <span style={{
                    fontSize: 11, color: '#FF6666', minWidth: 46,
                    fontFamily: 'monospace', textAlign: 'right', flexShrink: 0,
                }}>
                    {toMA(redVal)} mA
                </span>
            </div>

            {/* Thin separator */}
            <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

            {/* ── IR LED — line 1: label ── */}
            <span style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                IR LED  880nm
            </span>
            {/* ── IR LED — line 2: slider + value ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                    type="range" min={0} max={255} value={irVal}
                    onChange={e => handleIr(parseInt(e.target.value, 10))}
                    onPointerDown={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    style={{ flex: 1, accentColor: '#8B4513', cursor: 'pointer' }}
                />
                <span style={{
                    fontSize: 11, color: '#A0522D', minWidth: 46,
                    fontFamily: 'monospace', textAlign: 'right', flexShrink: 0,
                }}>
                    {toMA(irVal)} mA
                </span>
            </div>
        </div>
    );
};
